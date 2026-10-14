-- Migration: 00085_payroll_closure_immutability_and_versioning_p7.sql
-- Description: Fase P7 - Fechamento imutável, reabertura controlada com perfil autorizado e versionamento de holerite

-- 1. Adicionar colunas de fechamento e auditoria em payroll_periods
ALTER TABLE public.payroll_periods 
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS closure_notes TEXT,
    ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;

-- 2. Adicionar versionamento e hash de fechamento em payslips
ALTER TABLE public.payslips 
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closure_hash TEXT;

-- 3. Criar tabela de auditoria e governança de reaberturas de folha
CREATE TABLE IF NOT EXISTS public.payroll_period_reopenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    reopened_by UUID NOT NULL REFERENCES auth.users(id),
    reopened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    previous_closed_at TIMESTAMPTZ,
    previous_closed_by UUID,
    previous_version INTEGER NOT NULL DEFAULT 1,
    new_version INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS em payroll_period_reopenings
ALTER TABLE public.payroll_period_reopenings ENABLE ROW LEVEL SECURITY;

-- Política de RLS: usuários do mesmo tenant podem ler histórico de reabertura
DROP POLICY IF EXISTS "tenant_users_read_reopenings" ON public.payroll_period_reopenings;
CREATE POLICY "tenant_users_read_reopenings" ON public.payroll_period_reopenings
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

-- Política de inserção: somente via funções ou usuários autorizados
DROP POLICY IF EXISTS "authorized_users_insert_reopenings" ON public.payroll_period_reopenings;
CREATE POLICY "authorized_users_insert_reopenings" ON public.payroll_period_reopenings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND role IN ('system_admin', 'tenant_admin', 'dp_manager', 'dp_analyst')
        )
    );

-- 4. Trigger de Imutabilidade Total em Registros de Folha Fechada (CLOSED)
CREATE OR REPLACE FUNCTION public.check_payroll_period_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_id UUID;
    v_status TEXT;
BEGIN
    -- Identificar o period_id dependendo da tabela de origem
    IF TG_TABLE_NAME = 'payslips' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payslip_items' THEN
        SELECT period_id INTO v_period_id FROM public.payslips WHERE id = COALESCE(OLD.payslip_id, NEW.payslip_id);
    ELSIF TG_TABLE_NAME = 'payroll_company_taxes' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payroll_memory_calc' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    END IF;

    IF v_period_id IS NOT NULL THEN
        SELECT status INTO v_status FROM public.payroll_periods WHERE id = v_period_id;
        IF v_status = 'CLOSED' THEN
            RAISE EXCEPTION 'Operação bloqueada (Imutabilidade Legal CLT): O período de folha % está FECHADO (CLOSED). Nenhum holerite, item ou imposto pode ser alterado ou excluído sem reabertura formal autorizada.', v_period_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Triggers de bloqueio
DROP TRIGGER IF EXISTS trg_immutable_closed_payslips ON public.payslips;
CREATE TRIGGER trg_immutable_closed_payslips
    BEFORE UPDATE OR DELETE ON public.payslips
    FOR EACH ROW
    EXECUTE FUNCTION public.check_payroll_period_immutability();

DROP TRIGGER IF EXISTS trg_immutable_closed_payslip_items ON public.payslip_items;
CREATE TRIGGER trg_immutable_closed_payslip_items
    BEFORE UPDATE OR DELETE ON public.payslip_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_payroll_period_immutability();

DROP TRIGGER IF EXISTS trg_immutable_closed_company_taxes ON public.payroll_company_taxes;
CREATE TRIGGER trg_immutable_closed_company_taxes
    BEFORE UPDATE OR DELETE ON public.payroll_company_taxes
    FOR EACH ROW
    EXECUTE FUNCTION public.check_payroll_period_immutability();

DROP TRIGGER IF EXISTS trg_immutable_closed_memory_calc ON public.payroll_memory_calc;
CREATE TRIGGER trg_immutable_closed_memory_calc
    BEFORE UPDATE OR DELETE ON public.payroll_memory_calc
    FOR EACH ROW
    EXECUTE FUNCTION public.check_payroll_period_immutability();

-- 5. RPC Transacional de Fechamento da Folha (close_payroll_period)
CREATE OR REPLACE FUNCTION public.close_payroll_period(
    p_period_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_period RECORD;
    v_user_role TEXT;
    v_payslip_count INTEGER := 0;
BEGIN
    -- 1. Validar período
    SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Período de folha % não encontrado.', p_period_id;
    END IF;

    IF v_period.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Período de folha % já se encontra fechado.', p_period_id;
    END IF;

    IF v_period.status NOT IN ('CALCULATED', 'CONFERENCE') THEN
        RAISE EXCEPTION 'Somente folhas calculadas ou em conferência podem ser fechadas (status atual: %).', v_period.status;
    END IF;

    -- 2. Validar permissão do usuário
    SELECT role INTO v_user_role FROM public.tenant_users 
    WHERE user_id = v_user_id AND tenant_id = v_period.tenant_id;

    IF v_user_role NOT IN ('system_admin', 'tenant_admin', 'dp_manager', 'dp_analyst') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não tem permissão para fechar folha de pagamento.', COALESCE(v_user_role, 'Sem Perfil');
    END IF;

    -- 3. Atualizar período
    UPDATE public.payroll_periods SET
        status = 'CLOSED',
        closed_at = NOW(),
        closed_by = v_user_id,
        closure_notes = p_notes
    WHERE id = p_period_id;

    -- 4. Atualizar holerites com status CLOSED e garantir versão
    UPDATE public.payslips SET
        status = 'CLOSED',
        version = COALESCE(version, v_period.current_version, 1),
        is_latest = true
    WHERE period_id = p_period_id;

    GET DIAGNOSTICS v_payslip_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'CLOSED',
        'closed_at', NOW(),
        'payslips_closed', v_payslip_count,
        'version', v_period.current_version
    );
END;
$$;

-- 6. RPC Transacional de Reabertura com Justificativa e Perfil Autorizado (reopen_payroll_period)
CREATE OR REPLACE FUNCTION public.reopen_payroll_period(
    p_period_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_period RECORD;
    v_user_role TEXT;
    v_trimmed_reason TEXT := trim(p_reason);
    v_prev_version INTEGER;
    v_new_version INTEGER;
BEGIN
    -- 1. Validar justificativa
    IF length(v_trimmed_reason) < 15 THEN
        RAISE EXCEPTION 'A justificativa de reabertura deve conter no mínimo 15 caracteres explicando o motivo legal/contábil.';
    END IF;

    -- 2. Validar período
    SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Período de folha % não encontrado.', p_period_id;
    END IF;

    IF v_period.status != 'CLOSED' THEN
        RAISE EXCEPTION 'Apenas folhas fechadas (CLOSED) podem passar por reabertura formal (status atual: %).', v_period.status;
    END IF;

    -- 3. Validar perfil autorizado estrito (somente DP Manager ou Administradores)
    SELECT role INTO v_user_role FROM public.tenant_users 
    WHERE user_id = v_user_id AND tenant_id = v_period.tenant_id;

    IF v_user_role NOT IN ('system_admin', 'tenant_admin', 'dp_manager') THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores ou gestores de DP (dp_manager) podem reabrir folhas fechadas (seu perfil: %).', COALESCE(v_user_role, 'Sem Perfil');
    END IF;

    v_prev_version := COALESCE(v_period.current_version, 1);
    v_new_version := v_prev_version + 1;

    -- 4. Gravar na trilha imutável de reaberturas
    INSERT INTO public.payroll_period_reopenings (
        tenant_id,
        period_id,
        reopened_by,
        reopened_at,
        reason,
        previous_closed_at,
        previous_closed_by,
        previous_version,
        new_version
    ) VALUES (
        v_period.tenant_id,
        p_period_id,
        v_user_id,
        NOW(),
        v_trimmed_reason,
        v_period.closed_at,
        v_period.closed_by,
        v_prev_version,
        v_new_version
    );

    -- 5. Atualizar período para REOPENED e incrementar current_version
    UPDATE public.payroll_periods SET
        status = 'REOPENED',
        current_version = v_new_version,
        closed_at = NULL,
        closed_by = NULL
    WHERE id = p_period_id;

    -- 6. Atualizar holerites vigentes para status DRAFT e versionar
    UPDATE public.payslips SET
        status = 'DRAFT',
        version = v_new_version,
        superseded_at = NOW()
    WHERE period_id = p_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'REOPENED',
        'previous_version', v_prev_version,
        'new_version', v_new_version,
        'reopened_at', NOW(),
        'reopened_by', v_user_id,
        'reason', v_trimmed_reason
    );
END;
$$;
