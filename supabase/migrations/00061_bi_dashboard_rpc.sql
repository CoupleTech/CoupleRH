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
