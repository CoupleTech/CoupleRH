-- Migration: 00009_payroll_engine_schema
-- Description: Motor da Folha de Pagamento, Memória de Cálculo, Tabelas Progressivas e Rescisão

-- 1. Tabelas Progressivas (INSS, IRRF, Salário Família) - Versionadas
CREATE TABLE public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL, -- Ex: Validade a partir de 01/01/2024
    competence_end DATE, -- Nulo = Vigente
    
    -- Configuração em JSON para escalabilidade de N faixas
    -- Estrutura: [{ "min": 0, "max": 1412.00, "percentage": 7.5, "deduction": 0 }, ...]
    ranges_jsonb JSONB NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Eventos da Folha (O Holerite Item a Item)
CREATE TABLE public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    reference_value NUMERIC(10,2), -- Ex: 220 (horas) ou 5 (dias)
    calculated_amount NUMERIC(10,2) NOT NULL, -- O Valor R$ monetário final
    
    is_manual_entry BOOLEAN NOT NULL DEFAULT false, -- Se foi digitado na mão pelo RH
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Memória de Cálculo (Segurança e Auditoria Absoluta)
-- Explica como o motor chegou no valor do "calculated_amount"
CREATE TABLE public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    
    formula_used TEXT NOT NULL, -- A Expressão DSL (ex: "(BASE_SALARY / 220) * OVERTIME_HOURS * 1.5")
    variables_snapshot JSONB NOT NULL, -- O valor de cada variável naquele instante
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id), -- Se usou INSS/IRRF, qual versão de tabela usou
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Rescisão / Desligamento (Offboarding)
CREATE TABLE public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    
    fgts_fine_percentage NUMERIC(5,2), -- 40%, 20%, 0%
    is_exam_required BOOLEAN NOT NULL DEFAULT true, -- Exame Demissional
    
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(contract_id) -- Uma rescisão por contrato
);

-- RLS e Auditoria
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
