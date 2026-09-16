-- Migration: 00010_esocial_sst_schema
-- Description: Integrações eSocial e SST (Saúde e Segurança do Trabalho)

-- ==========================================
-- 1. FASE 5: ESOCIAL E MENSAGERIA
-- ==========================================

-- Controle de Lotes e Eventos transmitidos ao eSocial
CREATE TABLE public.esocial_transmissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL CHECK (event_type IN ('S-1000', 'S-1010', 'S-2200', 'S-2205', 'S-2206', 'S-2210', 'S-2220', 'S-2230', 'S-2240', 'S-2299', 'S-1200', 'S-1210', 'OTHER')),
    reference_id UUID, -- ID da entidade que gerou (ex: onboarding_process_id para S-2200, period_id para S-1200)
    
    xml_payload TEXT NOT NULL, -- O arquivo XML criptografado gerado
    receipt_number TEXT, -- Recibo devolvido pelo governo (se sucesso)
    
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUEUED', 'PROCESSING', 'ACCEPTED', 'REJECTED')),
    error_message TEXT, -- Retorno do erro SERPRO
    
    transmitted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. FASE 6: SST (Saúde e Segurança)
-- ==========================================

-- Ambientes de Trabalho (S-1060 / S-2240 Base)
CREATE TABLE public.sst_work_environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    location_type TEXT NOT NULL CHECK (location_type IN ('OWN_ESTABLISHMENT', 'THIRD_PARTY', 'EXTERNAL')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Riscos Ocupacionais (Agentes Químicos, Físicos, Biológicos)
CREATE TABLE public.sst_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    esocial_code TEXT NOT NULL, -- Código Tabela 24 do eSocial
    name TEXT NOT NULL,
    risk_type TEXT NOT NULL CHECK (risk_type IN ('PHYSICAL', 'CHEMICAL', 'BIOLOGICAL', 'ERGONOMIC', 'ACCIDENT')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exames e Saúde Ocupacional (ASO) - (S-2220)
CREATE TABLE public.sst_health_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    exam_type TEXT NOT NULL CHECK (exam_type IN ('ADMISSIONAL', 'PERIODIC', 'RETURN_TO_WORK', 'CHANGE_OF_RISK', 'DEMISSIONAL')),
    exam_date DATE NOT NULL,
    doctor_crm TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    
    result TEXT NOT NULL CHECK (result IN ('FIT', 'UNFIT')), -- Apto / Inapto
    certificate_url TEXT, -- Link para o ASO em PDF
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS e Auditoria
ALTER TABLE public.esocial_transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_work_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_health_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage eSocial" ON public.esocial_transmissions FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage SST Envs" ON public.sst_work_environments FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage SST Risks" ON public.sst_risks FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage Health Exams" ON public.sst_health_exams FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_esocial_trigger AFTER INSERT OR UPDATE OR DELETE ON public.esocial_transmissions FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_sst_exams_trigger AFTER INSERT OR UPDATE OR DELETE ON public.sst_health_exams FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
