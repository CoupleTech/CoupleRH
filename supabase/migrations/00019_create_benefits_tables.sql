-- Migration: 00019_create_benefits_tables
-- Description: Cria o catálogo genérico de benefícios da empresa e o vínculo com os funcionários.

-- 1. Apaga tudo que deu erro antes para começar limpo
DROP TABLE IF EXISTS public.employee_benefits CASCADE;
DROP TABLE IF EXISTS public.benefits_catalog CASCADE;

-- 2. Cria o Catálogo
CREATE TABLE public.benefits_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('VT', 'VR', 'VA', 'HEALTH', 'DENTAL', 'GYM', 'OTHER')),
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_VALUE', 'NONE')),
    default_discount_value NUMERIC(10, 2) DEFAULT 0,
    provider_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Cria a tabela de Vínculo
CREATE TABLE public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_id UUID NOT NULL REFERENCES public.benefits_catalog(id) ON DELETE RESTRICT,
    custom_discount_value NUMERIC(10, 2),
    card_number TEXT,
    dependent_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_id)
);

-- 4. Ativa RLS
ALTER TABLE public.benefits_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- 5. Cria Políticas de Acesso
CREATE POLICY "Users can view benefits catalog" 
    ON public.benefits_catalog FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view employee benefits" 
    ON public.employee_benefits FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage benefits catalog" 
    ON public.benefits_catalog FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = benefits_catalog.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage employee benefits" 
    ON public.employee_benefits FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = employee_benefits.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- 6. Triggers de Auditoria
CREATE TRIGGER audit_benefits_catalog_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.benefits_catalog
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_employee_benefits_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.employee_benefits
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 7. Atualiza o Cache da API do Supabase na marra!
NOTIFY pgrst, 'reload schema';
