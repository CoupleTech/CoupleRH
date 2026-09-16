-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
