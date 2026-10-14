-- Migration: 00086_payroll_block_closure_on_errors_p7.sql
-- Description: Fase P7 - Trava no banco de dados para bloquear fechamento de folha quando houver colaboradores em erro, líquido negativo ou divergência de totais

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
    v_error_count INTEGER := 0;
    v_negative_net_count INTEGER := 0;
    v_math_error_count INTEGER := 0;
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

    -- 2. Validar se existem holerites no período
    SELECT count(*) INTO v_payslip_count FROM public.payslips WHERE period_id = p_period_id;
    IF v_payslip_count = 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado: Nenhum holerite foi gerado ou processado para este período.';
    END IF;

    -- 3. BLOQUEIO CLT/COMPLIANCE: Colaboradores com status de erro
    SELECT count(*) INTO v_error_count 
    FROM public.payslips 
    WHERE period_id = p_period_id 
      AND (status IN ('ERROR', 'CALCULATION_ERROR', 'ERRO_CALCULO') OR status ILIKE '%ERROR%');

    IF v_error_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (Compliance/CLT): Existem % colaboradores com cálculo em erro no período. Regularize os cálculos antes de fechar a folha.', v_error_count;
    END IF;

    -- 4. BLOQUEIO CLT Art. 462: Colaboradores com salário líquido negativo
    SELECT count(*) INTO v_negative_net_count 
    FROM public.payslips 
    WHERE period_id = p_period_id AND net_salary < 0;

    IF v_negative_net_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (CLT Art. 462): Existem % colaboradores com salário líquido negativo. Não é permitido fechar a folha com descontos superiores ao rendimento total.', v_negative_net_count;
    END IF;

    -- 5. BLOQUEIO Invariante Matemática T6: Diferença entre Líquido e (Proventos - Descontos)
    SELECT count(*) INTO v_math_error_count 
    FROM public.payslips 
    WHERE period_id = p_period_id 
      AND abs(net_salary - (total_earnings - total_deductions)) > 0.01;

    IF v_math_error_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (Invariante T6): Existem % holerites com divergência matemática entre salário líquido e (Proventos - Descontos).', v_math_error_count;
    END IF;

    -- 6. Validar permissão do usuário
    SELECT role INTO v_user_role FROM public.tenant_users 
    WHERE user_id = v_user_id AND tenant_id = v_period.tenant_id;

    IF v_user_role NOT IN ('system_admin', 'tenant_admin', 'dp_manager', 'dp_analyst') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não tem permissão para fechar folha de pagamento.', COALESCE(v_user_role, 'Sem Perfil');
    END IF;

    -- 7. Atualizar período para CLOSED
    UPDATE public.payroll_periods SET
        status = 'CLOSED',
        closed_at = NOW(),
        closed_by = v_user_id,
        closure_notes = p_notes
    WHERE id = p_period_id;

    -- 8. Atualizar holerites com status CLOSED e garantir versão
    UPDATE public.payslips SET
        status = 'CLOSED',
        version = COALESCE(version, v_period.current_version, 1),
        is_latest = true
    WHERE period_id = p_period_id;

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
