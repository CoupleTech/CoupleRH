-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;
