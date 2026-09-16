-- Adiciona tabela de médias rescisórias para o cálculo do TRCT
CREATE TABLE IF NOT EXISTS public.medias_rescisorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employment_contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    tipo_verba TEXT NOT NULL,
    quantidade NUMERIC,
    valor_total NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.medias_rescisorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage medias" 
    ON public.medias_rescisorias FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = medias_rescisorias.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );
