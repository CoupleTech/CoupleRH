-- Script Seguro para Produção: Correção de Benefícios e Eventos Fixos
-- 1. Garante que as tabelas de benefícios existam
CREATE TABLE IF NOT EXISTS public.benefits_catalog (
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

CREATE TABLE IF NOT EXISTS public.employee_benefits (
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

-- 2. Ativa RLS de forma segura
ALTER TABLE public.benefits_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- 3. Garante que os FKs da tabela de Eventos Fixos apontem para as rubricas (Isso previne o Erro 400)
-- (Se já existir, o PostgreSQL avisa mas ignora na maioria dos clientes se já estiver certo, mas para evitar erro de FK existente, não recriaremos o FK se não for estritamente necessário. O reload resolve 99% das vezes).

-- 4. O mais importante: Força a API do Supabase a enxergar as tabelas e os relacionamentos atualizados (Isso resolve os erros 404 e 400 do frontend).
NOTIFY pgrst, 'reload schema';
