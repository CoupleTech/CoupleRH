-- Migration: 00039_expand_audit_engine
-- Description: Extensão da engine de auditoria para capturar motivo, versão do motor e expor logs via view.

-- 1. Adicionar colunas em audit.logs
ALTER TABLE audit.logs 
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS engine_version TEXT;

-- 2. Atualizar a função de trigger para injetar as sessões
CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
    v_reason TEXT;
    v_engine TEXT;
BEGIN
    -- Capturar motivo e engine injetados via set_config, se existirem
    BEGIN
        v_reason := current_setting('app.audit_reason', true);
    EXCEPTION WHEN OTHERS THEN
        v_reason := NULL;
    END;

    BEGIN
        v_engine := current_setting('app.engine_version', true);
    EXCEPTION WHEN OTHERS THEN
        v_engine := NULL;
    END;

    -- Capturar o tenant_id da linha modificada, se existir
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        BEGIN
            current_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
    ELSE
        v_new := to_jsonb(NEW);
        BEGIN
            current_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
        
        IF TG_OP = 'UPDATE' THEN
            v_old := to_jsonb(OLD);
            -- Não auditar se nada mudou de fato
            IF v_old = v_new THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    -- Inserir o log com SYSTEM_USER (bypass RLS)
    INSERT INTO audit.logs (
        tenant_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        reason,
        engine_version
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
        TG_OP,
        TG_TABLE_NAME::TEXT,
        COALESCE((v_new->>'id'), (v_old->>'id'), 'unknown'),
        v_old,
        v_new,
        v_reason,
        v_engine
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar a view exposta publicamente para consumir no Frontend via PostgREST
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
    id,
    timestamp,
    tenant_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    reason,
    engine_version
FROM audit.logs;

-- Migration: 00039_expand_audit_engine
-- Description: Extensão da engine de auditoria para capturar motivo, versão do motor e expor logs via view.

-- 1. Adicionar colunas em audit.logs
ALTER TABLE audit.logs 
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS engine_version TEXT;

-- 2. Atualizar a função de trigger para injetar as sessões
CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
    v_reason TEXT;
    v_engine TEXT;
BEGIN
    -- Capturar motivo e engine injetados via set_config, se existirem
    BEGIN
        v_reason := current_setting('app.audit_reason', true);
    EXCEPTION WHEN OTHERS THEN
        v_reason := NULL;
    END;

    BEGIN
        v_engine := current_setting('app.engine_version', true);
    EXCEPTION WHEN OTHERS THEN
        v_engine := NULL;
    END;

    -- Capturar o tenant_id da linha modificada, se existir
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        BEGIN
            current_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
    ELSE
        v_new := to_jsonb(NEW);
        BEGIN
            current_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
        
        IF TG_OP = 'UPDATE' THEN
            v_old := to_jsonb(OLD);
            -- Não auditar se nada mudou de fato
            IF v_old = v_new THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    -- Inserir o log com SYSTEM_USER (bypass RLS)
    INSERT INTO audit.logs (
        tenant_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        reason,
        engine_version
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
        TG_OP,
        TG_TABLE_NAME::TEXT,
        COALESCE((v_new->>'id'), (v_old->>'id'), 'unknown'),
        v_old,
        v_new,
        v_reason,
        v_engine
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar a view exposta publicamente para consumir no Frontend via PostgREST
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
    id,
    timestamp,
    tenant_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    reason,
    engine_version
FROM audit.logs;

-- Atribuir grants na View
GRANT SELECT ON public.audit_logs_view TO authenticated, anon;

-- 4. Anexar trigger de auditoria nas tabelas solicitadas (apenas se não existirem ainda)

DO $$
BEGIN
    -- payroll_rubrics
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_rubrics') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_rubrics_trigger') THEN
            CREATE TRIGGER audit_payroll_rubrics_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
        END IF;
    END IF;

    -- employment_contracts
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employment_contracts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employment_contracts_trigger') THEN
            CREATE TRIGGER audit_employment_contracts_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.employment_contracts
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
        END IF;
    END IF;

    -- salary_adjustments
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'salary_adjustments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_salary_adjustments_trigger') THEN
            CREATE TRIGGER audit_salary_adjustments_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.salary_adjustments
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
        END IF;
    END IF;

    -- payroll_variable_events
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_variable_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_variable_events_trigger') THEN
            CREATE TRIGGER audit_payroll_variable_events_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
        END IF;
    END IF;

    -- employee_fixed_events
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_fixed_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_fixed_events_trigger') THEN
            CREATE TRIGGER audit_employee_fixed_events_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
        END IF;
    END IF;

    -- payroll_periods
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_periods') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_periods_trigger') THEN
            CREATE TRIGGER audit_payroll_periods_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
        END IF;
    END IF;
END $$;


-- MISSING MIGRATIONS RECOVERY SCRIPT

-- ==========================================
-- Source: 00025_create_employee_scales.sql
-- ==========================================

-- Migration: 00025_create_employee_scales
-- Description: Criação da tabela de escalas para relacionar empregados às jornadas e ciclos de trabalho.

CREATE TABLE IF NOT EXISTS public.employee_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    work_schedule_id UUID NOT NULL REFERENCES public.work_schedules(id) ON DELETE RESTRICT,
    
    cycle_type TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (cycle_type IN ('WEEKLY', '12X36', '24X48', 'CUSTOM')),
    
    -- Para ciclos alternados (ex: 12x36 -> 1 dia trabalho, 1 folga)
    worked_days INTEGER,
    free_days INTEGER,
    
    -- Para ciclos semanais fixos (Array de inteiros: 0=Dom, 1=Seg... 6=Sáb)
    weekly_schedule JSONB,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE public.employee_scales ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Users can view employee scales in their tenants" ON public.employee_scales;
CREATE POLICY "Users can view employee scales in their tenants" 
    ON public.employee_scales FOR SELECT 
    USING (tenant_id = ANY (public.user_tenant_ids()));

DROP POLICY IF EXISTS "Tenant Admins and DP can manage employee scales" ON public.employee_scales;
CREATE POLICY "Tenant Admins and DP can manage employee scales" 
    ON public.employee_scales FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = public.employee_scales.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Gatilho de auditoria
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_scales') THEN
        DROP TRIGGER IF EXISTS audit_employee_scales_trigger ON public.employee_scales;
    END IF;
END $$;
CREATE TRIGGER audit_employee_scales_trigger 
AFTER INSERT OR UPDATE OR DELETE ON public.employee_scales 
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();


-- ==========================================
-- Source: 00026_payroll_overtime_rubrics.sql
-- ==========================================

-- Migration: 00026_payroll_overtime_rubrics
-- Description: Cria rubricas padrões de Horas Extras e DSR para todos os tenants.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00048_fix_rubrics_schema.sql
-- ==========================================

-- Migration: 00048_fix_rubrics_schema
-- Description: Alinha o schema da tabela payroll_rubrics com os nomes de colunas 
-- esperados pela tela Rubrics.tsx e pelo motor de cálculo (Edge Function).
-- Resolve o BUG R1 (colunas com nomes incompatíveis entre frontend e banco).

-- 1. Adicionar colunas que a tela Rubrics.tsx espera mas não existem
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- 2. Adicionar colunas com os nomes corretos que a tela usa para incidências patronais
-- (A tela envia: incidence_inss_patronal, incidence_rat, incidence_third_parties)
-- (O banco antigo tinha: inss_patronal_incidence, rat_incidence, terceiros_incidence)
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN DEFAULT false;

-- 3. Adicionar colunas com os nomes corretos que a tela usa para bases geradas
-- (A tela envia: generates_base_inss, generates_base_irrf, generates_base_fgts)
-- (O banco antigo tinha: generates_inss_base, generates_irrf_base, generates_fgts_base)
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN DEFAULT false;

-- 4. Migrar dados existentes das colunas antigas para as novas (se existirem)
DO $$
BEGIN
  -- Migrar incidências patronais
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'inss_patronal_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_inss_patronal = COALESCE(inss_patronal_incidence, false)
    WHERE inss_patronal_incidence IS NOT NULL AND inss_patronal_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'rat_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_rat = COALESCE(rat_incidence, false)
    WHERE rat_incidence IS NOT NULL AND rat_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'terceiros_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_third_parties = COALESCE(terceiros_incidence, false)
    WHERE terceiros_incidence IS NOT NULL AND terceiros_incidence = true;
  END IF;
  
  -- Migrar bases geradas
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_inss_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_inss = COALESCE(generates_inss_base, false)
    WHERE generates_inss_base IS NOT NULL AND generates_inss_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_irrf_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_irrf = COALESCE(generates_irrf_base, false)
    WHERE generates_irrf_base IS NOT NULL AND generates_irrf_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_fgts_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_fgts = COALESCE(generates_fgts_base, false)
    WHERE generates_fgts_base IS NOT NULL AND generates_fgts_base = true;
  END IF;
END $$;

-- 5. Garantir que a coluna calculation_order existe com um bom default
ALTER TABLE public.payroll_rubrics 
  ALTER COLUMN calculation_order SET DEFAULT 50;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00049_fix_rubrics_and_codes.sql
-- ==========================================

-- Migration: 00049_fix_rubrics_and_codes
-- Description: Seed de Rubricas Padrão Corrigido

-- 1. Limpar rubricas duplicadas (1001 vs 101, 2001 vs 901)
-- Se as antigas (1001) não têm vínculos, as deletamos. (Evitando FK violation na payroll_rubrics se já foi usada).
DO $$
BEGIN
  BEGIN
    -- DELETE FROM public.payroll_rubrics WHERE code IN ('1001', '2001', '2002', '2005');
  EXCEPTION WHEN OTHERS THEN
    -- Soft delete se não for possível hard delete (por foreign key constraint)
    UPDATE public.payroll_rubrics SET is_active = false WHERE code IN ('1001', '2001', '2002', '2005');
  END;
END $$;

-- 2. Inserir rubricas 150 (HE50) e 160 (HE100) para o Espelho de Ponto
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Percorre todos os tenants para garantir as rubricas
  FOR v_tenant_id IN SELECT id FROM public.tenants LOOP
    
    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '150') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '150', 'Hora Extra 50%', 'Hora Extra Padrão (50%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 1.5, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '160') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '160', 'Hora Extra 100%', 'Hora Extra Domingos/Feriados (100%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 2.0, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

  END LOOP;
END $$;


-- ==========================================
-- Source: 00051_employee_portal_rpc.sql
-- ==========================================

-- Migration: 00051_employee_portal_rpc
-- Description: Criação de RPCs para o Portal do Colaborador acessar seus dados com segurança

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_vacation_balance(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00052_employee_portal_profile_rpc.sql
-- ==========================================

-- Migration: 00052_employee_portal_profile_rpc
-- Description: RPC para o Portal do Colaborador acessar seus dados de perfil, benefícios e contrato

-- 1. Dados completos do perfil do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_profile(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        -- Dados pessoais
        'full_name', p.full_name,
        'social_name', p.social_name,
        'cpf', p.cpf,
        'birth_date', p.birth_date,
        'gender', p.gender,
        'email', p.email,
        'phone', p.phone,
        'mobile', p.mobile,
        -- Endereço
        'address', json_build_object(
            'zip_code', p.zip_code,
            'street', p.street,
            'number', p.number,
            'complement', p.complement,
            'neighborhood', p.neighborhood,
            'city', p.city,
            'state', p.state,
            'country', p.country
        ),
        -- Contato de emergência
        'emergency_contact', json_build_object(
            'name', p.emergency_contact_name,
            'phone', p.emergency_contact_phone,
            'relation', p.emergency_contact_relation
        ),
        -- Dados bancários
        'bank', json_build_object(
            'bank_name', w.bank_name,
            'agency', w.agency,
            'account_number', w.account_number,
            'account_digit', w.account_digit,
            'account_type', w.account_type,
            'pix_key', w.pix_key,
            'pix_type', w.pix_type
        ),
        -- Dados do contrato
        'contract', json_build_object(
            'id', ec.id,
            'contract_type', ct.name,
            'contract_category', ct.category,
            'admission_date', ec.admission_date,
            'base_salary', ec.base_salary,
            'status', ec.status,
            'position_title', pos.title,
            'position_cbo', pos.cbo,
            'department_name', dept.name
        )
    ) INTO v_result
    FROM public.workers w
    JOIN public.people p ON p.id = w.person_id
    LEFT JOIN public.employment_contracts ec ON ec.worker_id = w.id AND ec.status = 'ACTIVE'
    LEFT JOIN public.positions pos ON pos.id = ec.position_id
    LEFT JOIN public.departments dept ON dept.id = ec.department_id
    LEFT JOIN public.contract_types ct ON ct.id = ec.contract_type_id
    WHERE w.id = p_worker_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 2. Benefícios ativos do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_benefits(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', eb.id,
            'benefit_name', bc.name,
            'benefit_type', bc.benefit_type,
            'provider_name', bc.provider_name,
            'discount_type', bc.discount_type,
            'discount_value', COALESCE(eb.custom_discount_value, bc.default_discount_value),
            'card_number', eb.card_number,
            'dependent_count', eb.dependent_count,
            'status', eb.status
        ) ORDER BY bc.name
    ) INTO v_result
    FROM public.employee_benefits eb
    JOIN public.benefits_catalog bc ON bc.id = eb.benefit_id
    WHERE eb.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id AND status = 'ACTIVE'
    )
    AND eb.status = 'ACTIVE';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_benefits(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00053_fix_payslips_rpc.sql
-- ==========================================

-- Migration: 00053_fix_payslips_rpc
-- Description: Adiciona SECURITY DEFINER à função get_employee_payslips para o Portal do Colaborador

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00054_payslip_details_rpc.sql
-- ==========================================

-- Migration: 00054_payslip_details_rpc
-- Description: RPC para obter os detalhes analíticos de um holerite (rubricas, totais e bases)

CREATE OR REPLACE FUNCTION public.get_employee_payslip_details(p_payslip_id UUID, p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Segurança: Garante que o holerite solicitado pertence ao contrato do colaborador
    IF NOT EXISTS (
        SELECT 1 FROM public.payslips p
        JOIN public.employment_contracts ec ON ec.id = p.contract_id
        WHERE p.id = p_payslip_id AND ec.worker_id = p_worker_id
    ) THEN
        RETURN '{}'::JSON;
    END IF;

    SELECT json_build_object(
        'totals', json_build_object(
            'total_earnings', p.total_earnings,
            'total_deductions', p.total_deductions,
            'net_salary', p.net_salary,
            'base_inss', p.base_inss,
            'base_irrf', p.base_irrf,
            'base_fgts', p.base_fgts,
            'fgts_month', p.fgts_month
        ),
        'items', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'code', pr.code,
                    'name', pr.name,
                    'reference', pi.reference,
                    'amount', pi.amount,
                    'type', pi.type
                ) ORDER BY pi.type DESC, pr.code ASC
            ), '[]'::JSON)
            FROM public.payslip_items pi
            JOIN public.payroll_rubrics pr ON pr.id = pi.rubric_id
            WHERE pi.payslip_id = p.id
        )
    ) INTO v_result
    FROM public.payslips p
    WHERE p.id = p_payslip_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslip_details(UUID, UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00055_vacation_requests_rpc.sql
-- ==========================================

-- Migration: 00055_vacation_requests_rpc
-- Description: Atualiza a RPC get_employee_vacation_balance para incluir as solicitações/férias programadas (vacation_requests)

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status,
            'requests', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', vr.id,
                        'start_date', vr.start_date,
                        'end_date', vr.end_date,
                        'days_taken', vr.days_taken,
                        'status', vr.status
                    ) ORDER BY vr.start_date ASC
                ), '[]'::JSON)
                FROM public.vacation_requests vr
                WHERE vr.vesting_period_id = vp.id
            )
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00042_add_employee_contacts_banks_docs.sql
-- ==========================================

-- Migration: 00042_add_employee_contacts_banks_docs
-- Description: Adiciona campos de contato à pessoa, dados bancários ao trabalhador e cria tabela de documentos pessoais

-- 1. Contatos na tabela people
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS corporate_email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- 2. Dados bancários na tabela workers (Vínculo da pessoa com a empresa)
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS bank_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS agency TEXT,
ADD COLUMN IF NOT EXISTS agency_digit TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_digit TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT, -- 'CORRENTE', 'POUPANCA', 'SALARIO'
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS pix_type TEXT; -- 'CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'

-- 3. Nova tabela de Documentos do Colaborador (worker_personal_documents)
CREATE TABLE IF NOT EXISTS public.worker_personal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'RG', 'CPF', 'CNH', 'PIS', 'ASO_ADMISSIONAL', 'COMPROVANTE_RESIDENCIA', etc
    document_number TEXT,
    issuer TEXT, -- Órgão emissor
    issue_date DATE,
    expiration_date DATE,
    file_url TEXT, -- Preparado para futuro storage
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ativar RLS
ALTER TABLE public.worker_personal_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para worker_personal_documents
DROP POLICY IF EXISTS "Users can view worker_personal_documents in their tenants" ON public.worker_personal_documents;
CREATE POLICY "Users can view worker_personal_documents in their tenants" 
    ON public.worker_personal_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

DROP POLICY IF EXISTS "Tenant Admins and DP can manage worker_personal_documents" ON public.worker_personal_documents;
CREATE POLICY "Tenant Admins and DP can manage worker_personal_documents" 
    ON public.worker_personal_documents FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = worker_personal_documents.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- Anexar ao motor de auditoria (Triggers)
DROP TRIGGER IF EXISTS audit_worker_personal_documents_trigger ON public.worker_personal_documents;
CREATE TRIGGER audit_worker_personal_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.worker_personal_documents
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();


-- ==========================================
-- Source: 00056_employee_documents_storage.sql
-- ==========================================

-- Migration: 00056_employee_documents_storage
-- Description: Criação do bucket employee-documents, políticas de storage e RPCs para a Central de Documentos

-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Storage para o bucket employee-documents
-- Permitir leitura pública (já que o bucket é public, mas garantindo acesso)
DROP POLICY IF EXISTS "employee_docs_public_access" ON storage.objects;
CREATE POLICY "employee_docs_public_access" ON storage.objects FOR SELECT 
USING (bucket_id = 'employee-documents');

-- Permitir upload pelo portal do colaborador (como usa autenticação customizada, precisamos liberar para anon)
DROP POLICY IF EXISTS "employee_docs_anon_upload" ON storage.objects;
CREATE POLICY "employee_docs_anon_upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'employee-documents');

-- Permitir upload e gerência pelo admin (autenticado)
DROP POLICY IF EXISTS "employee_docs_admin_full_access" ON storage.objects;
CREATE POLICY "employee_docs_admin_full_access" ON storage.objects FOR ALL 
USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');

-- 3. RPC para buscar documentos pessoais (Portal)
CREATE OR REPLACE FUNCTION public.get_worker_personal_documents(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', d.id,
            'document_type', d.document_type,
            'status', d.status,
            'file_url', d.file_url,
            'issue_date', d.issue_date,
            'expiration_date', d.expiration_date,
            'created_at', d.created_at,
            'updated_at', d.updated_at
        ) ORDER BY d.created_at DESC
    ) INTO v_result
    FROM public.worker_personal_documents d
    WHERE d.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 4. RPC para o colaborador enviar um documento
CREATE OR REPLACE FUNCTION public.submit_worker_personal_document(
    p_worker_id UUID,
    p_document_type TEXT,
    p_file_url TEXT
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_doc_id UUID;
BEGIN
    -- Pegar o tenant_id do worker
    SELECT tenant_id INTO v_tenant_id FROM public.employment_contracts WHERE worker_id = p_worker_id LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Worker not found';
    END IF;

    -- Verificar se já existe um documento pendente ou rejeitado deste tipo
    SELECT id INTO v_doc_id
    FROM public.worker_personal_documents
    WHERE worker_id = p_worker_id AND document_type = p_document_type
    LIMIT 1;

    IF v_doc_id IS NOT NULL THEN
        -- Atualizar existente
        UPDATE public.worker_personal_documents
        SET file_url = p_file_url,
            status = 'SUBMITTED',
            updated_at = NOW()
        WHERE id = v_doc_id;
    ELSE
        -- Inserir novo
        INSERT INTO public.worker_personal_documents (
            tenant_id,
            worker_id,
            document_type,
            file_url,
            status
        ) VALUES (
            v_tenant_id,
            p_worker_id,
            p_document_type,
            p_file_url,
            'SUBMITTED'
        ) RETURNING id INTO v_doc_id;
    END IF;

    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC para o Analista de RH atualizar o status do documento (Aprovar/Rejeitar)
CREATE OR REPLACE FUNCTION public.update_worker_document_status(
    p_document_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.worker_personal_documents
    SET status = p_status,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00057_worker_signatures_rpc.sql
-- ==========================================

-- Migration: 00057_worker_signatures_rpc

CREATE OR REPLACE FUNCTION public.get_worker_signatures(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', ed.id,
            'title', ed.title,
            'status', ed.status,
            'file_url', ed.file_url,
            'requires_employee_signature', ed.requires_employee_signature,
            'created_at', ed.created_at
        ) ORDER BY ed.created_at DESC
    ) INTO v_result
    FROM public.employee_documents ed
    WHERE ed.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sign_worker_document(p_document_id UUID, p_worker_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.employee_documents
    SET status = 'SIGNED',
        updated_at = NOW()
    WHERE id = p_document_id AND worker_id = p_worker_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00058_alter_worker_docs_status.sql
-- ==========================================

-- Migration: 00058_alter_worker_docs_status
-- Description: Altera a constraint de status em worker_personal_documents para suportar o fluxo de upload e auditoria

-- Migration: 00058_alter_worker_docs_status
-- Description: Altera a constraint de status em worker_personal_documents para suportar o fluxo de upload e auditoria

ALTER TABLE public.worker_personal_documents
DROP CONSTRAINT IF EXISTS worker_personal_documents_status_check;

ALTER TABLE public.worker_personal_documents
ADD CONSTRAINT worker_personal_documents_status_check 
CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']));


-- ==========================================
-- Source: 00059_payroll_periods_company.sql
-- ==========================================

-- Migration: 00042_payroll_periods_company
-- Description: Adiciona company_id aos períodos de folha para permitir que cada empresa tenha seus próprios fechamentos.

-- 1. Adiciona a coluna company_id (permitindo null inicialmente para dados antigos)
-- ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Limpa os períodos existentes para evitar inconsistências (como estamos em dev/MVP e a folha deve ser por empresa)
-- Obs: Isso vai apagar os holerites calculados, será necessário rodar o motor novamente.
-- TRUNCATE TABLE public.payroll_periods CASCADE;

-- 3. Torna a coluna NOT NULL após a limpeza
-- ALTER TABLE public.payroll_periods ALTER COLUMN company_id SET NOT NULL;

-- 4. Atualiza a constraint de unicidade para incluir a empresa
-- ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_tenant_id_month_year_type_key;

-- Dependendo de como a constraint foi nomeada, pode ser "payroll_periods_tenant_id_competence_month_competence_y_key"
-- Vamos garantir removendo qualquer constraint de unique nas colunas antigas:
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'payroll_periods' AND constraint_type = 'UNIQUE') 
    LOOP
        EXECUTE '-- ALTER TABLE public.payroll_periods DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_tenant_company_month_year_type_key UNIQUE (tenant_id, company_id, month, year, type);

NOTIFY pgrst, 'reload schema';


NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00060_employee_documents_metadata.sql
-- ==========================================

-- Migration: 00060_employee_documents_metadata
-- Description: Adiciona colunas para renderização dinâmica (Paperless) e atualiza RPC de assinatura para validade legal (IP, Hash)

-- 1. Adicionar metadata e tipo em employee_documents
ALTER TABLE public.employee_documents
ADD COLUMN IF NOT EXISTS document_type TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE OR REPLACE FUNCTION public.get_worker_signatures(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', ed.id,
            'title', ed.title,
            'status', ed.status,
            'file_url', ed.file_url,
            'requires_employee_signature', ed.requires_employee_signature,
            'document_type', ed.document_type,
            'metadata', ed.metadata,
            'created_at', ed.created_at
        ) ORDER BY ed.created_at DESC
    ) INTO v_result
    FROM public.employee_documents ed
    WHERE ed.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 2. Atualizar a RPC de assinatura para logar evidências com validade jurídica
DROP FUNCTION IF EXISTS public.sign_worker_document(UUID, UUID);

CREATE OR REPLACE FUNCTION public.sign_worker_document(
    p_document_id UUID,
    p_worker_id UUID,
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_document_hash TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
    v_signer_user_id UUID;
BEGIN
    SELECT tenant_id, status INTO v_tenant_id, v_status
    FROM public.employee_documents
    WHERE id = p_document_id AND worker_id = p_worker_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Document not found or does not belong to worker';
    END IF;

    IF v_status = 'SIGNED' THEN
        RAISE EXCEPTION 'Document is already signed';
    END IF;

    v_signer_user_id := auth.uid();
    IF v_signer_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    INSERT INTO public.signatures_log (
        tenant_id,
        employee_document_id,
        signer_user_id,
        signer_role,
        ip_address,
        user_agent,
        document_hash_at_signing
    ) VALUES (
        v_tenant_id,
        p_document_id,
        v_signer_user_id,
        'EMPLOYEE',
        p_ip_address,
        p_user_agent,
        p_document_hash
    );

    UPDATE public.employee_documents
    SET status = 'SIGNED',
        document_hash = p_document_hash,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.sign_worker_document(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ==========================================
-- Source: 00061_bi_dashboard_rpc.sql
-- ==========================================

-- Migration: 00061_bi_dashboard_rpc
-- Description: Criação da RPC get_bi_dashboard_analytics para popular os gráficos de BI

CREATE OR REPLACE FUNCTION public.get_bi_dashboard_analytics(p_tenant_id UUID DEFAULT NULL, p_company_id UUID DEFAULT NULL)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_headcount_evolution JSON;
    v_turnover JSON;
    v_absenteeism JSON;
    v_salary_distribution JSON;
    v_months_to_analyze INT := 7;
    v_start_date DATE;
    v_end_date DATE;
    v_current_month DATE;
    
    -- Variables for looping
    i INT;
    v_month_label TEXT;
    v_month_start DATE;
    v_month_end DATE;
    
    -- Aggregators
    v_month_active INT;
    v_month_admissions INT;
    v_month_resignations INT;
    v_month_leaves INT;
    
    v_turnover_array JSONB := '[]'::JSONB;
    v_headcount_array JSONB := '[]'::JSONB;
    v_absenteeism_array JSONB := '[]'::JSONB;
BEGIN
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO p_tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
    END IF;

    -- Determinar a janela de tempo (últimos 7 meses)
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    FOR i IN REVERSE 6..0 LOOP
        v_month_start := (v_current_month - (i || ' months')::INTERVAL)::DATE;
        v_month_end := (v_month_start + '1 month'::INTERVAL - '1 day'::INTERVAL)::DATE;
        v_month_label := TO_CHAR(v_month_start, 'MM/YYYY');
        
        -- Headcount (Trabalhadores ativos em algum momento do mês)
        SELECT COUNT(id) INTO v_month_active
        FROM public.employment_contracts
        WHERE tenant_id = p_tenant_id
          AND (p_company_id IS NULL OR company_id = p_company_id)
          AND admission_date <= v_month_end
          AND (resignation_date IS NULL OR resignation_date >= v_month_start);
          
        v_headcount_array := v_headcount_array || jsonb_build_object(
            'month', v_month_label,
            'count', COALESCE(v_month_active, 0)
        );
        
        -- Turnover (Admissões vs Demissões)
        SELECT COUNT(id) INTO v_month_admissions
        FROM public.employment_contracts
        WHERE tenant_id = p_tenant_id
          AND (p_company_id IS NULL OR company_id = p_company_id)
          AND admission_date >= v_month_start AND admission_date <= v_month_end;
          
        SELECT COUNT(id) INTO v_month_resignations
        FROM public.employment_contracts
        WHERE tenant_id = p_tenant_id
          AND (p_company_id IS NULL OR company_id = p_company_id)
          AND resignation_date >= v_month_start AND resignation_date <= v_month_end;
          
        v_turnover_array := v_turnover_array || jsonb_build_object(
            'month', v_month_label,
            'admissions', COALESCE(v_month_admissions, 0),
            'resignations', COALESCE(v_month_resignations, 0),
            'rate', CASE WHEN COALESCE(v_month_active, 0) > 0 THEN 
                        ROUND(((COALESCE(v_month_admissions,0) + COALESCE(v_month_resignations,0)) / 2.0 / v_month_active * 100)::NUMERIC, 2)
                    ELSE 0 END
        );
        
        -- Absenteísmo (Dias de afastamento / Dias de trabalho esperados)
        SELECT SUM(
            LEAST(end_date, v_month_end) - GREATEST(start_date, v_month_start) + 1
        ) INTO v_month_leaves
        FROM public.leaves
        WHERE tenant_id = p_tenant_id
          AND start_date <= v_month_end
          AND (end_date IS NULL OR end_date >= v_month_start)
          AND status = 'APPROVED'; -- Consideramos apenas faltas/afastamentos aprovados/reais
          
        v_absenteeism_array := v_absenteeism_array || jsonb_build_object(
            'month', v_month_label,
            'missed_days', COALESCE(v_month_leaves, 0),
            'rate', CASE WHEN COALESCE(v_month_active, 0) > 0 THEN 
                        ROUND((COALESCE(v_month_leaves,0)::NUMERIC / (v_month_active * 30.0) * 100)::NUMERIC, 2)
                    ELSE 0 END
        );
    END LOOP;
    
    -- Distribuição Salarial (Apenas Ativos atuais)
    WITH SalaryGroups AS (
        SELECT 
            CASE 
                WHEN base_salary <= 2000 THEN 'Até R$ 2.000'
                WHEN base_salary > 2000 AND base_salary <= 4000 THEN 'R$ 2.001 - R$ 4.000'
                WHEN base_salary > 4000 AND base_salary <= 7000 THEN 'R$ 4.001 - R$ 7.000'
                WHEN base_salary > 7000 AND base_salary <= 12000 THEN 'R$ 7.001 - R$ 12.000'
                ELSE 'Acima de R$ 12.000'
            END as range,
            CASE 
                WHEN base_salary <= 2000 THEN 1
                WHEN base_salary > 2000 AND base_salary <= 4000 THEN 2
                WHEN base_salary > 4000 AND base_salary <= 7000 THEN 3
                WHEN base_salary > 7000 AND base_salary <= 12000 THEN 4
                ELSE 5
            END as sort_order,
            COUNT(*) as count
        FROM public.employment_contracts
        WHERE tenant_id = p_tenant_id
          AND (p_company_id IS NULL OR company_id = p_company_id)
          AND status = 'ACTIVE'
        GROUP BY 1, 2
        ORDER BY 2
    )
    SELECT json_agg(json_build_object('range', range, 'count', count))
    INTO v_salary_distribution
    FROM SalaryGroups;

    RETURN json_build_object(
        'headcount_evolution', v_headcount_array,
        'turnover', v_turnover_array,
        'absenteeism', v_absenteeism_array,
        'salary_distribution', COALESCE(v_salary_distribution, '[]'::JSON)
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_bi_dashboard_analytics(UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
