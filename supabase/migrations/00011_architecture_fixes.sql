-- Migration: 00011_architecture_fixes
-- Description: Correção arquitetural exigida pelo Prompt Mestre (Histórico Temporal SCD2, Ponto Estrito e LGPD)

-- ==========================================
-- 1. HISTÓRICO TEMPORAL RIGOROSO (SCD TYPE 2)
-- ==========================================

-- Esta tabela guarda cada versão do contrato de trabalho no tempo, permitindo recalcular folhas antigas
-- exatamente com a estrutura que o funcionário tinha naquela época (ex: se foi promovido em Agosto, a folha de Março usa a versão de Março)
CREATE TABLE public.employment_contract_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Vigência da versão
    valid_from DATE NOT NULL,
    valid_to DATE, -- NULL significa que é a versão atual
    
    -- Atributos históricos (Snapshot)
    salary_amount NUMERIC(10, 2) NOT NULL,
    job_title TEXT NOT NULL,
    work_schedule_id UUID,
    union_id UUID,
    cost_center TEXT,
    
    -- Metadados da alteração
    change_reason TEXT NOT NULL, -- Ex: "Promoção Anual", "Dissídio"
    approved_by UUID, -- Referência a quem aprovou a alteração
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir que não existam sobreposições temporais para o mesmo contrato
-- Na prática, usa-se triggers ou constraints EXCLUDE (requer btree_gist extension). Aqui faremos uma trigger simples via app ou documentaremos a regra.

-- ==========================================
-- 2. PONTO ELETRÔNICO - SEPARAÇÃO ABSOLUTA (PORTARIA 671)
-- ==========================================

-- Remover colunas de ajuste da tabela original, tornando-a puramente um append-only log.
ALTER TABLE public.time_entries 
    DROP COLUMN IF EXISTS adjusted_timestamp,
    DROP COLUMN IF EXISTS is_manual_adjustment,
    DROP COLUMN IF EXISTS adjustment_reason,
    DROP COLUMN IF EXISTS adjusted_by,
    DROP COLUMN IF EXISTS status;

-- Nova Tabela: Solicitações e Ajustes de Ponto
-- Nunca apaga a batida original, apenas "sobrepõe" logicamente na visão do espelho
CREATE TABLE public.time_entry_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE RESTRICT, -- Pode ser nulo se for uma inserção de batida esquecida
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    requested_timestamp TIMESTAMPTZ NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
    
    adjustment_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    
    requested_by UUID NOT NULL, -- O funcionário que pediu
    approved_by UUID, -- O gestor que aprovou
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. LGPD E PRIVACIDADE (Consentimentos e Retenção)
-- ==========================================

-- Tabela para rastrear o RoPA (Record of Processing Activities) e consentimentos explícitos quando essa for a base legal
CREATE TABLE public.lgpd_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    
    data_category TEXT NOT NULL, -- Ex: "Dados Biométricos", "Dados de Saúde"
    processing_purpose TEXT NOT NULL, -- Ex: "Controle de Acesso Físico"
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('CONSENT', 'LEGAL_OBLIGATION', 'CONTRACT_EXECUTION', 'LEGITIMATE_INTEREST')),
    
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    
    ip_address TEXT,
    device_info TEXT
);

-- Tabela de Políticas de Retenção e Descarte (Data Lifecycle)
CREATE TABLE public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    data_domain TEXT NOT NULL, -- Ex: "Folha de Pagamento", "ASO", "Biometria"
    retention_period_months INTEGER NOT NULL, -- Ex: 60 (5 anos) ou 360 (30 anos - FGTS antigo)
    legal_justification TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS e Auditoria
ALTER TABLE public.employment_contract_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage history" ON public.employment_contract_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage time adjustments" ON public.time_entry_adjustments FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage lgpd consents" ON public.lgpd_consents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage retention policies" ON public.data_retention_policies FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_contract_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employment_contract_history FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_time_adjustments_trigger AFTER INSERT OR UPDATE OR DELETE ON public.time_entry_adjustments FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_lgpd_consents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_consents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
