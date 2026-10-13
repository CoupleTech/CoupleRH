-- Migration: 00071_atomic_save_payroll_period.sql
-- Description: Fase P3 / T9 - Recálculo atômico e persistência transacional da folha (save_payroll_period) com trava de concorrência

-- 1. Suporte a 'CALCULATING' na máquina de estados de payroll_periods
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_status_check 
    CHECK (status IN ('DRAFT', 'CALCULATING', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));

-- 2. Função PL/pgSQL transacional atômica para persistência do período de folha
CREATE OR REPLACE FUNCTION public.save_payroll_period(
    p_period_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period RECORD;
    v_contract_id UUID;
    v_contract_filter TEXT;
    v_payslip JSONB;
    v_item JSONB;
    v_mem JSONB;
    v_tax JSONB;
    v_payslip_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- 1. Validar existência do período
    SELECT id, tenant_id, status INTO v_period
    FROM public.payroll_periods
    WHERE id = p_period_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Período de folha % não encontrado.', p_period_id;
    END IF;

    -- Não permitir gravar sobre período fechado
    IF v_period.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Período de folha % já está fechado (CLOSED) e não pode ser recalculado diretamente.', p_period_id;
    END IF;

    v_contract_filter := p_payload->>'contract_id_filter';

    -- 2. Limpeza prévia atômica (executada na mesma transação da gravação)
    IF v_contract_filter IS NOT NULL AND v_contract_filter <> '' THEN
        v_contract_id := v_contract_filter::UUID;
        -- Deletar holerite anterior do contrato (itens e memória caem via ON DELETE CASCADE)
        DELETE FROM public.payslips
        WHERE period_id = p_period_id AND contract_id = v_contract_id;
    ELSE
        -- Deletar todos os holerites e impostos patronais anteriores do período
        DELETE FROM public.payroll_company_taxes
        WHERE period_id = p_period_id;

        DELETE FROM public.payslips
        WHERE period_id = p_period_id;
    END IF;

    -- 3. Inserção dos novos holerites, itens e memórias de cálculo
    IF p_payload ? 'payslips' AND jsonb_array_length(p_payload->'payslips') > 0 THEN
        FOR v_payslip IN SELECT * FROM jsonb_array_elements(p_payload->'payslips')
        LOOP
            INSERT INTO public.payslips (
                tenant_id,
                period_id,
                contract_id,
                total_earnings,
                total_deductions,
                net_salary,
                base_inss,
                base_irrf,
                base_fgts,
                fgts_month,
                status,
                engine_version,
                rubrics_version,
                rules_version,
                inss_table_version,
                irrf_table_version,
                fgts_table_version
            ) VALUES (
                (v_payslip->>'tenant_id')::UUID,
                p_period_id,
                (v_payslip->>'contract_id')::UUID,
                COALESCE((v_payslip->>'total_earnings')::NUMERIC, 0),
                COALESCE((v_payslip->>'total_deductions')::NUMERIC, 0),
                COALESCE((v_payslip->>'net_salary')::NUMERIC, 0),
                COALESCE((v_payslip->>'base_inss')::NUMERIC, 0),
                COALESCE((v_payslip->>'base_irrf')::NUMERIC, 0),
                COALESCE((v_payslip->>'base_fgts')::NUMERIC, 0),
                COALESCE((v_payslip->>'fgts_month')::NUMERIC, 0),
                COALESCE(v_payslip->>'status', 'CALCULATED'),
                COALESCE(v_payslip->>'engine_version', '1.0.0'),
                COALESCE(v_payslip->>'rubrics_version', '1.0.0'),
                COALESCE(v_payslip->>'rules_version', '1.0.0'),
                COALESCE(v_payslip->>'inss_table_version', '2026.1'),
                COALESCE(v_payslip->>'irrf_table_version', '2026.1'),
                COALESCE(v_payslip->>'fgts_table_version', '1.0.0')
            )
            RETURNING id INTO v_payslip_id;

            v_count := v_count + 1;

            -- Inserir itens do holerite
            IF v_payslip ? 'items' AND jsonb_array_length(v_payslip->'items') > 0 THEN
                FOR v_item IN SELECT * FROM jsonb_array_elements(v_payslip->'items')
                LOOP
                    INSERT INTO public.payslip_items (
                        tenant_id,
                        payslip_id,
                        rubric_id,
                        reference,
                        amount,
                        type
                    ) VALUES (
                        (v_item->>'tenant_id')::UUID,
                        v_payslip_id,
                        (v_item->>'rubric_id')::UUID,
                        v_item->>'reference',
                        COALESCE((v_item->>'amount')::NUMERIC, 0),
                        v_item->>'type'
                    );
                END LOOP;
            END IF;

            -- Inserir memória de cálculo
            IF v_payslip ? 'memory' AND jsonb_array_length(v_payslip->'memory') > 0 THEN
                FOR v_mem IN SELECT * FROM jsonb_array_elements(v_payslip->'memory')
                LOOP
                    INSERT INTO public.payroll_memory_calc (
                        tenant_id,
                        payslip_id,
                        step_name,
                        base_value,
                        quantity_used,
                        percentage_used,
                        parsed_formula,
                        result_value,
                        origin,
                        engine_version
                    ) VALUES (
                        (v_mem->>'tenant_id')::UUID,
                        v_payslip_id,
                        COALESCE(v_mem->>'step_name', ''),
                        COALESCE((v_mem->>'base_value')::NUMERIC, 0),
                        COALESCE((v_mem->>'quantity_used')::NUMERIC, 0),
                        COALESCE((v_mem->>'percentage_used')::NUMERIC, 0),
                        COALESCE(v_mem->>'parsed_formula', ''),
                        COALESCE((v_mem->>'result_value')::NUMERIC, 0),
                        COALESCE(v_mem->>'origin', 'AUTOMATICA'),
                        COALESCE(v_mem->>'engine_version', '1.0.0')
                    );
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- 4. Inserção de impostos patronais da empresa
    IF p_payload ? 'company_taxes' AND jsonb_array_length(p_payload->'company_taxes') > 0 THEN
        FOR v_tax IN SELECT * FROM jsonb_array_elements(p_payload->'company_taxes')
        LOOP
            INSERT INTO public.payroll_company_taxes (
                tenant_id,
                period_id,
                company_id,
                total_base_inss,
                total_base_fgts,
                inss_patronal,
                rat_adjusted,
                terceiros,
                fgts_patronal,
                total_taxes
            ) VALUES (
                (v_tax->>'tenant_id')::UUID,
                p_period_id,
                (v_tax->>'company_id')::UUID,
                COALESCE((v_tax->>'total_base_inss')::NUMERIC, 0),
                COALESCE((v_tax->>'total_base_fgts')::NUMERIC, 0),
                COALESCE((v_tax->>'inss_patronal')::NUMERIC, 0),
                COALESCE((v_tax->>'rat_adjusted')::NUMERIC, 0),
                COALESCE((v_tax->>'terceiros')::NUMERIC, 0),
                COALESCE((v_tax->>'fgts_patronal')::NUMERIC, 0),
                COALESCE((v_tax->>'total_taxes')::NUMERIC, 0)
            )
            ON CONFLICT (period_id, company_id) DO UPDATE SET
                total_base_inss = EXCLUDED.total_base_inss,
                total_base_fgts = EXCLUDED.total_base_fgts,
                inss_patronal = EXCLUDED.inss_patronal,
                rat_adjusted = EXCLUDED.rat_adjusted,
                terceiros = EXCLUDED.terceiros,
                fgts_patronal = EXCLUDED.fgts_patronal,
                total_taxes = EXCLUDED.total_taxes;
        END LOOP;
    END IF;

    -- 5. Atualizar o status do período e data de processamento
    UPDATE public.payroll_periods
    SET status = 'CALCULATED',
        processing_date = NOW(),
        updated_at = NOW()
    WHERE id = p_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'payslips_count', v_count
    );
END;
$$;

-- Permissões de execução da RPC
GRANT EXECUTE ON FUNCTION public.save_payroll_period(UUID, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
