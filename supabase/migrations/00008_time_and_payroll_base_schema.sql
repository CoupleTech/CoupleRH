-- Migration: 00008_time_and_payroll_base_schema
-- Description: Gestão de Ponto (Portaria 671), Banco de Horas e Base da Folha de Pagamento

-- ==========================================
-- 1. FASE 3: PONTO E JORNADA (Portaria 671 MTP)
-- ==========================================

-- A. Marcações de Ponto (A batida bruta)
CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    -- Marcação Original Imutável (Nunca pode ser apagada ou editada após criada)
    original_timestamp TIMESTAMPTZ NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
    device_info TEXT, -- IP, Geolocation, UserAgent, Device ID (REP-P)
    
    -- Marcação Ajustada (Caso o RH ou Gestor faça uma correção/inserção manual)
    adjusted_timestamp TIMESTAMPTZ,
    is_manual_adjustment BOOLEAN NOT NULL DEFAULT false,
    adjustment_reason TEXT,
    adjusted_by UUID, -- ID do usuário que aprovou o ajuste
    
    -- Status no fluxo
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Impede DELETE em marcações originais para garantir compliance com MTP
CREATE RULE prevent_time_entry_deletion AS 
    ON DELETE TO public.time_entries 
    DO INSTEAD NOTHING;

-- B. Banco de Horas
CREATE TABLE public.time_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    balance_minutes INTEGER NOT NULL DEFAULT 0, -- Saldo em minutos (Positivo = Extra, Negativo = Atraso)
    
    -- Período de vigência do banco (geralmente 6 meses a 1 ano)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'PAID_OUT')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transações do Banco de Horas
CREATE TABLE public.time_bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.time_bank_accounts(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    minutes INTEGER NOT NULL, -- Valores positivos (credito) e negativos (debito)
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('OVERTIME', 'DELAY', 'ABSENCE', 'COMPENSATION_DAY_OFF', 'MANUAL_ADJUSTMENT')),
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- C. Espelho de Ponto (Fechamento Mensal)
CREATE TABLE public.timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    total_worked_minutes INTEGER NOT NULL DEFAULT 0,
    total_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    total_night_shift_minutes INTEGER NOT NULL DEFAULT 0,
    total_missing_minutes INTEGER NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED')),
    employee_signature_id UUID REFERENCES public.signatures_log(id), -- Vincula ao cofre de assinaturas
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- 2. FASE 4: FUNDAÇÃO DA FOLHA DE PAGAMENTO
-- ==========================================

-- A. Competências (O Ciclo da Folha)
CREATE TABLE public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
    competence_year INTEGER NOT NULL,
    payroll_type TEXT NOT NULL CHECK (payroll_type IN ('MONTHLY', 'ADVANCE', 'THIRTEENTH_1', 'THIRTEENTH_2', 'PROFIT_SHARING')),
    
    payment_date DATE NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PROCESSING', 'CONFERENCE', 'CLOSED')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, competence_month, competence_year, payroll_type)
);

-- B. Rubricas (Eventos de Provento e Desconto - eSocial S-1010)
CREATE TABLE public.payroll_rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    code TEXT NOT NULL, -- Código interno (ex: 001)
    name TEXT NOT NULL, -- Ex: Salário Base, INSS, Adicional Noturno
    esocial_code TEXT, -- Código S-1010 (Natureza da Rubrica no eSocial)
    
    rubric_type TEXT NOT NULL CHECK (rubric_type IN ('EARNING', 'DEDUCTION', 'NEUTRAL')), -- Provento, Desconto, Base/Informativa
    
    -- Incidências Tributárias
    incidence_inss BOOLEAN NOT NULL DEFAULT false,
    incidence_fgts BOOLEAN NOT NULL DEFAULT false,
    incidence_irrf BOOLEAN NOT NULL DEFAULT false,
    
    -- Formula Base (Motor de Cálculo DSL customizado da Fase 4 - sem EVAL)
    calculation_rule_id TEXT, -- Referência à regra na engine (ex: 'BASE_SALARY_CALC')
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

-- RLS e Auditoria
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage time" ON public.time_entries FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage timesheets" ON public.timesheets FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage payroll" ON public.payroll_periods FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage rubrics" ON public.payroll_rubrics FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_time_entries_trigger AFTER INSERT OR UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_rubrics_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
