-- Migration: 00006_vacations_and_cct_schema
-- Description: Tabelas para Acordos Coletivos (Sindicatos) e Gestão de Férias

-- 1. Sindicatos e Acordos Coletivos (CCT/ACT)
CREATE TABLE public.unions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cnpj TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    base_city TEXT,
    base_state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.collective_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    union_id UUID NOT NULL REFERENCES public.unions(id) ON DELETE RESTRICT,
    
    agreement_type TEXT NOT NULL CHECK (agreement_type IN ('CCT', 'ACT')),
    validity_start DATE NOT NULL,
    validity_end DATE NOT NULL,
    
    -- Principais regras financeiras que sobrescrevem a CLT
    base_salary_floor NUMERIC(10,2), -- Piso salarial da categoria
    overtime_percentage_1 NUMERIC(5,2) DEFAULT 50.00, -- Ex: 50%
    overtime_percentage_2 NUMERIC(5,2) DEFAULT 100.00, -- Ex: 100%
    night_shift_premium NUMERIC(5,2) DEFAULT 20.00, -- Adicional Noturno (CLT é 20%)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Associa o contrato de trabalho ao sindicato/acordo
ALTER TABLE public.employment_contracts ADD COLUMN union_id UUID REFERENCES public.unions(id);

-- 2. Gestão de Férias

-- Período Aquisitivo (Direito adquirido)
CREATE TABLE public.vacation_vesting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    concessive_start_date DATE NOT NULL,
    concessive_end_date DATE NOT NULL,
    
    earned_days NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    taken_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    lost_days NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- Dias perdidos por faltas injustificadas
    
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACQUIRED', 'PARTIALLY_TAKEN', 'COMPLETED', 'EXPIRED')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitação e Gozo (Férias tiradas)
CREATE TABLE public.vacation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vesting_period_id UUID NOT NULL REFERENCES public.vacation_vesting_periods(id) ON DELETE CASCADE,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_taken INTEGER NOT NULL,
    
    cash_allowance_days INTEGER NOT NULL DEFAULT 0, -- Abono pecuniário (vender férias)
    advance_13th_salary BOOLEAN NOT NULL DEFAULT false, -- Adiantamento de 13º
    
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED_MANAGER', 'APPROVED_DP', 'PAID', 'TAKEN', 'CANCELED')),
    approved_by_manager UUID,
    approved_by_dp UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_vesting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view unions" ON public.unions FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view collective agreements" ON public.collective_agreements FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view vacation vesting" ON public.vacation_vesting_periods FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view vacation requests" ON public.vacation_requests FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

-- Políticas de Gerenciamento
CREATE POLICY "Tenant Admins and DP can manage unions" ON public.unions FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = unions.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage collective agreements" ON public.collective_agreements FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = collective_agreements.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));

-- Empregados podem ver e solicitar suas próprias férias (Via Portal do Trabalhador)
-- (Simplificação para MVP: Filtra pelos contratos vinculados ao User_ID da Pessoa)

-- Triggers de Auditoria
CREATE TRIGGER audit_unions_trigger AFTER INSERT OR UPDATE OR DELETE ON public.unions FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_vacations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vacation_requests FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
