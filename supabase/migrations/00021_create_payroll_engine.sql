-- Migration: 00021_create_payroll_engine
-- Description: Tabelas de fechamento de folha (Holerites) e a Procedure de processamento.

DROP TABLE IF EXISTS public.payslip_items CASCADE;
DROP TABLE IF EXISTS public.payslips CASCADE;
DROP TABLE IF EXISTS public.payroll_periods CASCADE;

-- 1. Períodos de Folha (Competência)
CREATE TABLE public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'VACATION')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CLOSED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Cabeçalho do Holerite
CREATE TABLE public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    total_earnings NUMERIC(10, 2) DEFAULT 0,
    total_deductions NUMERIC(10, 2) DEFAULT 0,
    net_salary NUMERIC(10, 2) DEFAULT 0,
    
    base_inss NUMERIC(10, 2) DEFAULT 0,
    base_irrf NUMERIC(10, 2) DEFAULT 0,
    base_fgts NUMERIC(10, 2) DEFAULT 0,
    fgts_month NUMERIC(10, 2) DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'CALCULATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 3. Itens do Holerite (Linhas)
CREATE TABLE public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    reference TEXT, -- Ex: "30 dias", "10%", "220h"
    amount NUMERIC(10, 2) NOT NULL, -- Valor real em R$ que vai somar ou subtrair
    type TEXT NOT NULL, -- EARNING, DEDUCTION, BASE
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View payroll_periods" ON public.payroll_periods FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Manage payroll_periods" ON public.payroll_periods FOR ALL USING (
    tenant_id = ANY (public.user_tenant_ids()) 
    AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = payroll_periods.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
);

CREATE POLICY "View payslips" ON public.payslips FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Manage payslips" ON public.payslips FOR ALL USING (
    tenant_id = ANY (public.user_tenant_ids()) 
    AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = payslips.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
);

CREATE POLICY "View payslip_items" ON public.payslip_items FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Manage payslip_items" ON public.payslip_items FOR ALL USING (
    tenant_id = ANY (public.user_tenant_ids()) 
    AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = payslip_items.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
);

-- 4. Função Motor de Folha (RPC)
CREATE OR REPLACE FUNCTION public.process_payroll_period(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
    
    contract_rec RECORD;
    v_payslip_id UUID;
    v_base_salary NUMERIC;
    
    rubric_base UUID;
    rubric_vt UUID;
    rubric_inss UUID;
    
    benefit_rec RECORD;
    
    v_total_earn NUMERIC := 0;
    v_total_ded NUMERIC := 0;
    v_net NUMERIC := 0;
BEGIN
    -- Valida Período
    SELECT tenant_id, status INTO v_tenant_id, v_status FROM public.payroll_periods WHERE id = p_period_id;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Período não encontrado';
    END IF;
    IF v_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Folha já está fechada e não pode ser reprocessada';
    END IF;

    -- Limpa processamento anterior (Idempotência)
    DELETE FROM public.payslips WHERE period_id = p_period_id;

    -- Tenta encontrar rubricas básicas cadastradas para o motor usar (fallback p/ rubricas se existirem)
    SELECT id INTO rubric_base FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'EARNING' AND category = 'SALARY' LIMIT 1;
    
    -- Busca rubrica de INSS (pelo nome ou pega a primeira de TAX)
    SELECT id INTO rubric_inss FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'DEDUCTION' AND (name ILIKE '%INSS%' OR category = 'TAX') LIMIT 1;
    
    -- Busca rubrica genérica de Desconto (para VT e outros benefícios)
    SELECT id INTO rubric_vt FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'DEDUCTION' AND (name ILIKE '%transporte%' OR name ILIKE '%benef%' OR category = 'ALLOWANCE' OR category = 'OTHER') LIMIT 1;

    -- Se ainda não achou rubric_vt, pega QUALQUER rubrica de desconto para não falhar
    IF rubric_vt IS NULL THEN
        SELECT id INTO rubric_vt FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND type = 'DEDUCTION' LIMIT 1;
    END IF;

    -- Loop em todos os contratos ativos
    FOR contract_rec IN 
        SELECT id, base_salary 
        FROM public.employment_contracts 
        WHERE tenant_id = v_tenant_id AND status = 'ACTIVE'
    LOOP
        v_total_earn := 0;
        v_total_ded := 0;
        
        -- Cria Cabeçalho do Holerite
        INSERT INTO public.payslips (tenant_id, period_id, contract_id)
        VALUES (v_tenant_id, p_period_id, contract_rec.id)
        RETURNING id INTO v_payslip_id;

        -- 1. PROVENTO: Salário Base
        v_base_salary := contract_rec.base_salary;
        IF rubric_base IS NOT NULL THEN
            INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
            VALUES (v_tenant_id, v_payslip_id, rubric_base, '30 dias', v_base_salary, 'EARNING');
            v_total_earn := v_total_earn + v_base_salary;
        END IF;

        -- 2. DESCONTO: INSS Simulado (Tabela 2024 simplificada - 7.5 a 14)
        -- Para MVP, vamos fixar 9% sobre base como exemplo didático se a rubrica INSS existir
        IF rubric_inss IS NOT NULL THEN
            INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
            VALUES (v_tenant_id, v_payslip_id, rubric_inss, '9%', (v_base_salary * 0.09), 'DEDUCTION');
            v_total_ded := v_total_ded + (v_base_salary * 0.09);
        END IF;

        -- 3. DESCONTO: Benefícios (Catálogo)
        FOR benefit_rec IN 
            SELECT eb.custom_discount_value, bc.default_discount_value, bc.discount_type, bc.benefit_type, bc.name, bc.id as b_id
            FROM public.employee_benefits eb
            JOIN public.benefits_catalog bc ON eb.benefit_id = bc.id
            WHERE eb.contract_id = contract_rec.id AND eb.status = 'ACTIVE'
        LOOP
            DECLARE
                v_disc_val NUMERIC;
                v_final_amount NUMERIC := 0;
            BEGIN
                v_disc_val := COALESCE(benefit_rec.custom_discount_value, benefit_rec.default_discount_value);
                
                IF benefit_rec.discount_type = 'PERCENTAGE' THEN
                    v_final_amount := (v_base_salary * (v_disc_val / 100.0));
                ELSIF benefit_rec.discount_type = 'FIXED_VALUE' THEN
                    v_final_amount := v_disc_val;
                END IF;

                IF v_final_amount > 0 AND rubric_vt IS NOT NULL THEN
                    INSERT INTO public.payslip_items (tenant_id, payslip_id, rubric_id, reference, amount, type)
                    VALUES (v_tenant_id, v_payslip_id, rubric_vt, benefit_rec.name, v_final_amount, 'DEDUCTION');
                    v_total_ded := v_total_ded + v_final_amount;
                END IF;
            END;
        END LOOP;

        -- Atualiza totais no cabeçalho
        v_net := v_total_earn - v_total_ded;
        UPDATE public.payslips 
        SET total_earnings = v_total_earn, 
            total_deductions = v_total_ded, 
            net_salary = v_net,
            base_inss = v_total_earn,
            base_fgts = v_total_earn,
            fgts_month = (v_total_earn * 0.08)
        WHERE id = v_payslip_id;
        
    END LOOP;

    -- Marca período como processado
    UPDATE public.payroll_periods SET processing_date = NOW() WHERE id = p_period_id;

    RETURN TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
