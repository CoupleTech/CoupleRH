-- Migration: 00022_payroll_market_engine
-- Description: Tabelas de Encargos 2026, Lançamentos Fixos/Variáveis e Refatoração do Motor de Cálculo para Padrão de Mercado

-- 1. Tabelas de Encargos (INSS, IRRF)
CREATE TABLE IF NOT EXISTS public.payroll_tax_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_type TEXT NOT NULL CHECK (tax_type IN ('INSS', 'IRRF', 'SALARIO_FAMILIA')),
    valid_from DATE NOT NULL,
    valid_to DATE,
    min_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_value NUMERIC(10, 2) NOT NULL DEFAULT 99999999,
    percentage NUMERIC(5, 2) NOT NULL,
    deduction_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Reduções (Para a nova regra de 2026 do IRRF)
CREATE TABLE IF NOT EXISTS public.payroll_tax_reductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_type TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    min_income NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_income NUMERIC(10, 2) NOT NULL DEFAULT 99999999,
    reduction_fixed NUMERIC(10, 2) DEFAULT 0,
    reduction_multiplier NUMERIC(10, 6) DEFAULT 0,
    make_zero BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Popula Tabela de INSS (Competência 2026)
INSERT INTO public.payroll_tax_tables (tax_type, valid_from, min_value, max_value, percentage)
VALUES 
('INSS', '2026-01-01', 0, 1621.00, 7.5),
('INSS', '2026-01-01', 1621.00, 2902.84, 9.0),
('INSS', '2026-01-01', 2902.84, 4354.27, 12.0),
('INSS', '2026-01-01', 4354.27, 8475.55, 14.0);

-- Popula Tabela de IRRF (Competência 2026)
INSERT INTO public.payroll_tax_tables (tax_type, valid_from, min_value, max_value, percentage, deduction_amount)
VALUES 
('IRRF', '2026-01-01', 0, 2428.80, 0, 0),
('IRRF', '2026-01-01', 2428.80, 2826.65, 7.5, 182.16),
('IRRF', '2026-01-01', 2826.65, 3751.05, 15.0, 394.16),
('IRRF', '2026-01-01', 3751.05, 4664.68, 22.5, 675.49),
('IRRF', '2026-01-01', 4664.68, 99999999, 27.5, 908.73);

-- Popula Regra de Redução de 2026 do IRRF
INSERT INTO public.payroll_tax_reductions (tax_type, valid_from, min_income, max_income, make_zero, reduction_fixed, reduction_multiplier)
VALUES
('IRRF', '2026-01-01', 0, 5000.00, TRUE, 0, 0),
('IRRF', '2026-01-01', 5000.01, 7350.00, FALSE, 978.62, 0.133145);


-- 2. Lançamentos Fixos (Eventos que repetem todo mês para o Colaborador)
CREATE TABLE IF NOT EXISTS public.payroll_fixed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Lançamentos Variáveis (Eventos pontuais da competência)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, 
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.payroll_tax_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_tax_reductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_fixed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tax tables" ON public.payroll_tax_tables FOR SELECT USING (true);
CREATE POLICY "Anyone can view tax reductions" ON public.payroll_tax_reductions FOR SELECT USING (true);
CREATE POLICY "Users can view fixed events" ON public.payroll_fixed_events FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));
CREATE POLICY "Users can manage fixed events" ON public.payroll_fixed_events FOR ALL USING (tenant_id = ANY(public.user_tenant_ids()));
CREATE POLICY "Users can view variable events" ON public.payroll_variable_events FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));
CREATE POLICY "Users can manage variable events" ON public.payroll_variable_events FOR ALL USING (tenant_id = ANY(public.user_tenant_ids()));

-- 4. O Novo Motor de Folha Progressivo
CREATE OR REPLACE FUNCTION public.process_payroll_period(p_period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
    v_period_type TEXT;
    
    contract_rec RECORD;
    v_payslip_id UUID;
    v_base_salary NUMERIC;
    
    -- Bases Acumuladas
    v_base_inss NUMERIC;
    v_base_irrf NUMERIC;
    v_base_fgts NUMERIC;
    
    v_total_earn NUMERIC;
    v_total_ded NUMERIC;
    v_net NUMERIC;
    
    -- Cálculos de Impostos
    v_inss_discount NUMERIC;
    v_irrf_discount NUMERIC;
    v_taxable_in_bracket NUMERIC;
    v_reduction_amount NUMERIC;
    tax_rec RECORD;
    red_rec RECORD;
    
    -- Rubricas Dinâmicas
    rubric_inss_id UUID;
    rubric_irrf_id UUID;
    rubric_base_id UUID;
    
    event_rec RECORD;
    ben_rec RECORD;
BEGIN
    -- Valida Período
    SELECT tenant_id, status, type INTO v_tenant_id, v_status, v_period_type FROM public.payroll_periods WHERE id = p_period_id;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Período não encontrado';
    END IF;
    IF v_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Folha já está fechada e não pode ser reprocessada';
    END IF;

    -- Limpa processamento anterior
    DELETE FROM public.payslips WHERE period_id = p_period_id;

    -- Localiza as rubricas essenciais do sistema (Impostos)
    SELECT id INTO rubric_inss_id FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'DEDUCTION' AND (name ILIKE '%INSS%' OR category = 'TAX') LIMIT 1;
    SELECT id INTO rubric_irrf_id FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'DEDUCTION' AND (name ILIKE '%IRRF%' OR name ILIKE '%Imposto de Renda%') LIMIT 1;
    SELECT id INTO rubric_base_id FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'EARNING' AND category = 'SALARY' LIMIT 1;
    
    IF rubric_inss_id IS NULL THEN
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, category) VALUES (v_tenant_id, '901', 'INSS', 'DEDUCTION', 'TAX') RETURNING id INTO rubric_inss_id;
    END IF;
    IF rubric_irrf_id IS NULL THEN
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, category) VALUES (v_tenant_id, '902', 'IRRF', 'DEDUCTION', 'TAX') RETURNING id INTO rubric_irrf_id;
    END IF;
    IF rubric_base_id IS NULL THEN
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, category) VALUES (v_tenant_id, '100', 'Salário Base', 'EARNING', 'SALARY') RETURNING id INTO rubric_base_id;
    END IF;

    -- Loop em todos os contratos ativos
    FOR contract_rec IN 
        SELECT id, base_salary 
        FROM public.employment_contracts 
        WHERE tenant_id = v_tenant_id AND status = 'ACTIVE'
    LOOP
        v_total_earn := 0;
        v_total_ded := 0;
        v_base_inss := 0;
        v_base_irrf := 0;
        v_base_fgts := 0;
        
        INSERT INTO public.payslips (tenant_id, period_id, contract_id)
        VALUES (v_tenant_id, p_period_id, contract_rec.id)
        RETURNING id INTO v_payslip_id;

        -- 1. SALÁRIO BASE
        IF v_period_type = 'MONTHLY' THEN
            v_base_salary := COALESCE(contract_rec.base_salary, 0);
            INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
            VALUES (v_tenant_id, v_payslip_id, rubric_base_id, '30 dias', v_base_salary, 'EARNING');
            
            v_total_earn := v_total_earn + v_base_salary;
            v_base_inss := v_base_inss + v_base_salary;
            v_base_irrf := v_base_irrf + v_base_salary;
            v_base_fgts := v_base_fgts + v_base_salary;
        END IF;

        -- 2. LANÇAMENTOS FIXOS (Eventos do Colaborador)
        FOR event_rec IN
            SELECT fe.amount, r.id as rubric_id, r.name, r.type, r.inss_incidence, r.irrf_incidence, r.fgts_incidence
            FROM public.payroll_fixed_events fe
            JOIN public.payroll_rubrics r ON r.id = fe.rubric_id
            WHERE fe.contract_id = contract_rec.id AND fe.status = 'ACTIVE'
        LOOP
            INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
            VALUES (v_tenant_id, v_payslip_id, event_rec.rubric_id, 'Fixo', event_rec.amount, event_rec.type);
            
            IF event_rec.type = 'EARNING' THEN
                v_total_earn := v_total_earn + event_rec.amount;
                IF event_rec.inss_incidence THEN v_base_inss := v_base_inss + event_rec.amount; END IF;
                IF event_rec.irrf_incidence THEN v_base_irrf := v_base_irrf + event_rec.amount; END IF;
                IF event_rec.fgts_incidence THEN v_base_fgts := v_base_fgts + event_rec.amount; END IF;
            ELSE
                v_total_ded := v_total_ded + event_rec.amount;
                IF event_rec.irrf_incidence THEN v_base_irrf := v_base_irrf - event_rec.amount; END IF;
            END IF;
        END LOOP;
        
        -- Retrocompatibilidade com Módulo de Benefícios
        FOR ben_rec IN
            SELECT b.name, b.type, eb.custom_discount_value
            FROM public.employee_benefits eb
            JOIN public.benefits_catalog b ON b.id = eb.benefit_id
            WHERE eb.contract_id = contract_rec.id AND eb.status = 'ACTIVE'
        LOOP
            DECLARE
                v_ben_amount NUMERIC := 0;
                v_ben_rubric_id UUID;
            BEGIN
                IF ben_rec.type = 'PERCENTAGE' THEN
                    v_ben_amount := (v_base_salary * ben_rec.custom_discount_value) / 100;
                ELSE
                    v_ben_amount := ben_rec.custom_discount_value;
                END IF;

                IF v_ben_amount > 0 THEN
                    SELECT id INTO v_ben_rubric_id FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'DEDUCTION' AND name ILIKE '%' || ben_rec.name || '%' LIMIT 1;
                    IF v_ben_rubric_id IS NULL THEN
                        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, category) VALUES (v_tenant_id, '200', ben_rec.name, 'DEDUCTION', 'OTHER') RETURNING id INTO v_ben_rubric_id;
                    END IF;
                    
                    INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
                    VALUES (v_tenant_id, v_payslip_id, v_ben_rubric_id, 
                            CASE WHEN ben_rec.type = 'PERCENTAGE' THEN ben_rec.custom_discount_value || '%' ELSE 'Fixo' END, 
                            v_ben_amount, 'DEDUCTION');
                    v_total_ded := v_total_ded + v_ben_amount;
                END IF;
            END;
        END LOOP;

        -- 3. LANÇAMENTOS VARIÁVEIS (Eventos do Mês)
        FOR event_rec IN
            SELECT ve.amount, ve.reference, r.id as rubric_id, r.name, r.type, r.inss_incidence, r.irrf_incidence, r.fgts_incidence
            FROM public.payroll_variable_events ve
            JOIN public.payroll_rubrics r ON r.id = ve.rubric_id
            WHERE ve.contract_id = contract_rec.id AND ve.period_id = p_period_id
        LOOP
            INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
            VALUES (v_tenant_id, v_payslip_id, event_rec.rubric_id, COALESCE(event_rec.reference, 'Variável'), event_rec.amount, event_rec.type);
            
            IF event_rec.type = 'EARNING' THEN
                v_total_earn := v_total_earn + event_rec.amount;
                IF event_rec.inss_incidence THEN v_base_inss := v_base_inss + event_rec.amount; END IF;
                IF event_rec.irrf_incidence THEN v_base_irrf := v_base_irrf + event_rec.amount; END IF;
                IF event_rec.fgts_incidence THEN v_base_fgts := v_base_fgts + event_rec.amount; END IF;
            ELSE
                v_total_ded := v_total_ded + event_rec.amount;
                IF event_rec.irrf_incidence THEN v_base_irrf := v_base_irrf - event_rec.amount; END IF;
            END IF;
        END LOOP;

        -- 4. CÁLCULO DE IMPOSTOS (INSS Progressivo)
        v_inss_discount := 0;
        IF v_base_inss > 0 THEN
            FOR tax_rec IN SELECT * FROM public.payroll_tax_tables WHERE tax_type = 'INSS' AND CURRENT_DATE >= valid_from ORDER BY min_value
            LOOP
                IF v_base_inss > tax_rec.min_value THEN
                    v_taxable_in_bracket := LEAST(v_base_inss, tax_rec.max_value) - tax_rec.min_value;
                    v_inss_discount := v_inss_discount + (v_taxable_in_bracket * (tax_rec.percentage / 100));
                END IF;
            END LOOP;
            
            IF v_inss_discount > 0 THEN
                INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
                VALUES (v_tenant_id, v_payslip_id, rubric_inss_id, 'Progressivo', ROUND(v_inss_discount, 2), 'DEDUCTION');
                v_total_ded := v_total_ded + ROUND(v_inss_discount, 2);
                
                -- INSS deduz da base do IRRF
                v_base_irrf := v_base_irrf - ROUND(v_inss_discount, 2);
            END IF;
        END IF;

        -- 5. CÁLCULO DE IMPOSTOS (IRRF com Redução de 2026)
        v_irrf_discount := 0;
        IF v_base_irrf > 0 THEN
            -- No IRRF, aplica-se a alíquota da faixa que ele se encontra e subtrai a dedução
            SELECT percentage, deduction_amount INTO tax_rec FROM public.payroll_tax_tables 
            WHERE tax_type = 'IRRF' AND v_base_irrf > min_value AND v_base_irrf <= max_value AND CURRENT_DATE >= valid_from LIMIT 1;
            
            IF tax_rec IS NOT NULL AND tax_rec.percentage > 0 THEN
                v_irrf_discount := (v_base_irrf * (tax_rec.percentage / 100)) - tax_rec.deduction_amount;
                
                IF v_irrf_discount > 0 THEN
                    -- Verifica a nova regra de Redução 2026 sobre os rendimentos tributáveis
                    SELECT make_zero, reduction_fixed, reduction_multiplier INTO red_rec FROM public.payroll_tax_reductions 
                    WHERE tax_type = 'IRRF' AND v_base_irrf > min_income AND v_base_irrf <= max_income AND CURRENT_DATE >= valid_from LIMIT 1;

                    IF FOUND THEN
                        IF red_rec.make_zero THEN
                            v_irrf_discount := 0; -- Zera imposto
                        ELSE
                            v_reduction_amount := red_rec.reduction_fixed - (red_rec.reduction_multiplier * v_base_irrf);
                            v_irrf_discount := GREATEST(0, v_irrf_discount - v_reduction_amount);
                        END IF;
                    END IF;
                    
                    IF v_irrf_discount > 0 THEN
                        INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
                        VALUES (v_tenant_id, v_payslip_id, rubric_irrf_id, tax_rec.percentage || '%', ROUND(v_irrf_discount, 2), 'DEDUCTION');
                        v_total_ded := v_total_ded + ROUND(v_irrf_discount, 2);
                    END IF;
                END IF;
            END IF;
        END IF;

        -- 6. FECHAMENTO DO HOLERITE
        v_net := v_total_earn - v_total_ded;
        
        UPDATE public.payslips 
        SET 
            total_earnings = ROUND(v_total_earn, 2),
            total_deductions = ROUND(v_total_ded, 2),
            net_salary = ROUND(v_net, 2),
            base_inss = ROUND(v_base_inss, 2),
            base_irrf = ROUND(v_base_irrf, 2),
            base_fgts = ROUND(v_base_fgts, 2)
        WHERE id = v_payslip_id;

    END LOOP;
END;
$$;
