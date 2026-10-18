-- Migration: 00103_lgpd_subject_rights_and_data_governance_p8
-- Description: Implementação de Governança de Dados, Direitos do Titular (Art. 18 LGPD), Registro de Compartilhamento e Ciclo de Retenção.

-- 1. Função Auxiliar: user_worker_ids()
CREATE OR REPLACE FUNCTION public.user_worker_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(worker_id), '{}')
    FROM public.tenant_users
    WHERE user_id = auth.uid() AND worker_id IS NOT NULL;
$$;

-- 2. Tabela de Solicitações do Titular (LGPD Art. 18)
CREATE TABLE IF NOT EXISTS public.lgpd_subject_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    
    request_type TEXT NOT NULL CHECK (request_type IN ('ACCESS_DATA', 'PORTABILITY', 'ANONYMIZATION', 'REVOCATION_CONSENT', 'CONFIRMATION', 'CORRECTION')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
    
    justification TEXT NOT NULL,
    response_notes TEXT,
    
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para lgpd_subject_requests
ALTER TABLE public.lgpd_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and DP can manage all subject requests" ON public.lgpd_subject_requests;
CREATE POLICY "Admins and DP can manage all subject requests" ON public.lgpd_subject_requests
    FOR ALL
    USING (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu 
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = lgpd_subject_requests.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Workers can view own subject requests" ON public.lgpd_subject_requests;
CREATE POLICY "Workers can view own subject requests" ON public.lgpd_subject_requests
    FOR SELECT
    USING (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND worker_id = ANY(public.user_worker_ids())
    );

DROP POLICY IF EXISTS "Workers can create own subject requests" ON public.lgpd_subject_requests;
CREATE POLICY "Workers can create own subject requests" ON public.lgpd_subject_requests
    FOR INSERT
    WITH CHECK (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND worker_id = ANY(public.user_worker_ids())
    );

-- Trigger de Auditoria para lgpd_subject_requests
DROP TRIGGER IF EXISTS audit_lgpd_subject_requests_trigger ON public.lgpd_subject_requests;
CREATE TRIGGER audit_lgpd_subject_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_subject_requests
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 3. Tabela de Registro de Compartilhamento com Terceiros (LGPD Art. 18, VII)
CREATE TABLE IF NOT EXISTS public.lgpd_data_sharing_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    recipient_name TEXT NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PUBLIC_AGENCY', 'FINANCIAL_INSTITUTION', 'HEALTH_CLINIC', 'INSURANCE', 'OTHER')),
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('LEGAL_OBLIGATION', 'CONTRACT_EXECUTION', 'CONSENT', 'LEGITIMATE_INTEREST')),
    data_shared TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para lgpd_data_sharing_registry
ALTER TABLE public.lgpd_data_sharing_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read data sharing registry" ON public.lgpd_data_sharing_registry;
CREATE POLICY "Authenticated users can read data sharing registry" ON public.lgpd_data_sharing_registry
    FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Admins can manage data sharing registry" ON public.lgpd_data_sharing_registry;
CREATE POLICY "Admins can manage data sharing registry" ON public.lgpd_data_sharing_registry
    FOR ALL
    USING (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu 
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = lgpd_data_sharing_registry.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin')
        )
    );

-- Trigger de Auditoria para lgpd_data_sharing_registry
DROP TRIGGER IF EXISTS audit_lgpd_data_sharing_trigger ON public.lgpd_data_sharing_registry;
CREATE TRIGGER audit_lgpd_data_sharing_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_data_sharing_registry
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 4. Seed Padrão de Compartilhamentos Legais no Sistema (Template Global - tenant_id NULL)
INSERT INTO public.lgpd_data_sharing_registry (tenant_id, recipient_name, recipient_type, purpose, legal_basis, data_shared)
VALUES
(
    NULL,
    'eSocial / Ministério do Trabalho e Emprego',
    'PUBLIC_AGENCY',
    'Transmissão obrigatória de eventos de admissão, folha de pagamento, afastamentos e segurança do trabalho',
    'LEGAL_OBLIGATION',
    'Dados cadastrais completos, histórico funcional, remunerações, bases tributárias e eventos de saúde'
),
(
    NULL,
    'Caixa Econômica Federal (FGTS Digital)',
    'PUBLIC_AGENCY',
    'Arrecadação e individualização dos depósitos fundiários e verbas rescisórias',
    'LEGAL_OBLIGATION',
    'Nome, CPF, PIS, remuneração mensal e alíquota de FGTS'
),
(
    NULL,
    'Receita Federal do Brasil (DCTFWeb & DIRF)',
    'PUBLIC_AGENCY',
    'Apuração das contribuições previdenciárias e imposto de renda retido na fonte',
    'LEGAL_OBLIGATION',
    'Rendimentos brutos, deduções legais (dependentes/pensão) e retenções de INSS e IRRF'
),
(
    NULL,
    'Instituição Bancária de Folha (CNAB 240)',
    'FINANCIAL_INSTITUTION',
    'Crédito de salários, adiantamento quinzenal, férias e 13º em conta bancária',
    'CONTRACT_EXECUTION',
    'Nome, CPF, banco, agência, conta corrente e valor líquido a pagar'
)
ON CONFLICT DO NOTHING;

-- 5. RPC Segura: Exportação do Dossiê do Titular (Art. 18, II e V LGPD)
CREATE OR REPLACE FUNCTION public.get_my_lgpd_dossier()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_worker_id UUID;
    v_tenant_id UUID;
    v_person_id UUID;
    v_result JSONB;
BEGIN
    -- Identificar o trabalhador correspondente ao usuário logado
    SELECT worker_id, tenant_id INTO v_worker_id, v_tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid() AND worker_id IS NOT NULL
    LIMIT 1;

    IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum cadastro de trabalhador vinculado a esta conta de usuário.';
    END IF;

    SELECT person_id INTO v_person_id
    FROM public.workers
    WHERE id = v_worker_id;

    SELECT jsonb_build_object(
        'generated_at', NOW(),
        'legal_notice', 'Dossiê emitido em conformidade com o Art. 18 da Lei nº 13.709/2018 (LGPD).',
        'titular', (
            SELECT jsonb_build_object(
                'full_name', p.full_name,
                'cpf_masked', '***.' || SUBSTRING(REPLACE(REPLACE(p.cpf, '.', ''), '-', ''), 4, 3) || '.' || SUBSTRING(REPLACE(REPLACE(p.cpf, '.', ''), '-', ''), 7, 3) || '-**',
                'birth_date', p.birth_date,
                'email', p.email,
                'phone', p.phone
            )
            FROM public.people p
            WHERE p.id = v_person_id
        ),
        'contratos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', ec.id,
                    'registration_number', ec.registration_number,
                    'admission_date', ec.admission_date,
                    'status', ec.status,
                    'position', (SELECT name FROM public.positions WHERE id = ec.position_id),
                    'department', (SELECT name FROM public.departments WHERE id = ec.department_id),
                    'salary', ec.salary
                )
            ), '[]'::jsonb)
            FROM public.employment_contracts ec
            WHERE ec.worker_id = v_worker_id
        ),
        'consentimentos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', lc.data_category,
                    'purpose', lc.processing_purpose,
                    'legal_basis', lc.legal_basis,
                    'granted_at', lc.granted_at,
                    'revoked_at', lc.revoked_at
                )
            ), '[]'::jsonb)
            FROM public.lgpd_consents lc
            WHERE lc.person_id = v_person_id
        ),
        'solicitacoes_titular', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', sr.id,
                    'type', sr.request_type,
                    'status', sr.status,
                    'justification', sr.justification,
                    'requested_at', sr.requested_at,
                    'responded_at', sr.responded_at
                )
            ), '[]'::jsonb)
            FROM public.lgpd_subject_requests sr
            WHERE sr.worker_id = v_worker_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
