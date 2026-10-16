-- Migration: 00099_employee_loans_and_consignments.sql
-- Description: Gestão de Empréstimos Consignados (Crédito do Trabalhador / FGTS Digital)
-- com provisionamento no adiantamento (rubrica 807), estorno na folha mensal (rubrica 407)
-- e desconto da parcela integral (rubrica 805).

-- 1. Criação da tabela de contratos de empréstimo consignado
CREATE TABLE IF NOT EXISTS public.employee_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    contract_number TEXT,
    installment_amount NUMERIC(12, 2) NOT NULL CHECK (installment_amount > 0),
    total_installments INT NOT NULL CHECK (total_installments > 0),
    current_installment INT NOT NULL DEFAULT 1 CHECK (current_installment >= 1),
    start_date DATE NOT NULL,
    end_date DATE,
    provision_on_advance BOOLEAN NOT NULL DEFAULT true,
    advance_provision_percentage NUMERIC(5, 2) NOT NULL DEFAULT 40.00 CHECK (advance_provision_percentage >= 0 AND advance_provision_percentage <= 100),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'SETTLED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitação de RLS e Políticas de Segurança Multitenant
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_loans' AND policyname = 'View employee_loans') THEN
        CREATE POLICY "View employee_loans" ON public.employee_loans
            FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_loans' AND policyname = 'Manage employee_loans') THEN
        CREATE POLICY "Manage employee_loans" ON public.employee_loans
            FOR ALL USING (
                tenant_id = ANY (public.user_tenant_ids())
                AND EXISTS (
                    SELECT 1 FROM public.tenant_users 
                    WHERE user_id = auth.uid() 
                      AND tenant_id = employee_loans.tenant_id 
                      AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
                )
            );
    END IF;
END $$;

-- 3. Gatilho de Auditoria do Sistema (BaaS Security Constitution)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_loans_trigger') THEN
        CREATE TRIGGER audit_employee_loans_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_loans
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- 4. Seed das Rubricas Oficiais de Suporte ao Consignado:
--    - 807: Provisão Consignado Adiantamento (DEDUCTION no Vale)
--    - 407: Estorno Provisão Consignado (EARNING na Folha Mensal)
DO $$
DECLARE
    t RECORD;
    v_r807_id UUID;
    v_r407_id UUID;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- 807 - Provisão Consignado Adiantamento
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '807') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, rubric_kind, calculation_form, calculation_type,
                calculation_order, is_system, status, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, esocial_nature, origin, valid_from, is_active
            ) VALUES (
                t.id, '807', 'Provisão Consignado Adiantamento', 'Reserva proporcional da parcela de empréstimo consignado no vale/adiantamento',
                'DEDUCTION', 'DEDUCTION', 'OTHER', 'LOAN', 'FIXO', 'FIXED',
                85, true, 'ACTIVE', false, false, false,
                false, false, false, false, false, false,
                '9214', '9214', 'AUTOMATICA', '2026-01-01', true
            ) RETURNING id INTO v_r807_id;
        ELSE
            SELECT id INTO v_r807_id FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '807';
        END IF;

        -- 407 - Estorno Provisão Consignado
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '407') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, rubric_kind, calculation_form, calculation_type,
                calculation_order, is_system, status, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, esocial_nature, origin, valid_from, is_active
            ) VALUES (
                t.id, '407', 'Estorno Provisão Consignado', 'Devolução/estorno na folha mensal da provisão retida no adiantamento quinzenal',
                'EARNING', 'EARNING', 'OTHER', 'LOAN', 'FIXO', 'FIXED',
                40, true, 'ACTIVE', false, false, false,
                false, false, false, false, false, false,
                '1409', '1409', 'AUTOMATICA', '2026-01-01', true
            ) RETURNING id INTO v_r407_id;
        ELSE
            SELECT id INTO v_r407_id FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '407';
        END IF;

        -- Inserir incidências zeradas em rubric_incidences
        IF v_r807_id IS NOT NULL THEN
            INSERT INTO public.rubric_incidences (
                tenant_id, rubric_id, context, inss, irrf, fgts, irrf_mode, integra_dsr, media_ferias, media_13, inss_patronal, rat, terceiros
            ) VALUES (
                t.id, v_r807_id, 'ALL', false, false, false, 'ISENTO', false, false, false, false, false, false
            ) ON CONFLICT (rubric_id, context) DO NOTHING;
        END IF;

        IF v_r407_id IS NOT NULL THEN
            INSERT INTO public.rubric_incidences (
                tenant_id, rubric_id, context, inss, irrf, fgts, irrf_mode, integra_dsr, media_ferias, media_13, inss_patronal, rat, terceiros
            ) VALUES (
                t.id, v_r407_id, 'ALL', false, false, false, 'ISENTO', false, false, false, false, false, false
            ) ON CONFLICT (rubric_id, context) DO NOTHING;
        END IF;
    END LOOP;
END $$;
