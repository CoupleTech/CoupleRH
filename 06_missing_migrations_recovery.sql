-- MISSING MIGRATIONS RECOVERY SCRIPT

-- ==========================================
-- Source: 00025_create_employee_scales.sql
-- ==========================================

-- Migration: 00025_create_employee_scales
-- Description: Criação da tabela de escalas para relacionar empregados às jornadas e ciclos de trabalho.

CREATE TABLE IF NOT EXISTS public.employee_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    work_schedule_id UUID NOT NULL REFERENCES public.work_schedules(id) ON DELETE RESTRICT,
    
    cycle_type TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (cycle_type IN ('WEEKLY', '12X36', '24X48', 'CUSTOM')),
    
    -- Para ciclos alternados (ex: 12x36 -> 1 dia trabalho, 1 folga)
    worked_days INTEGER,
    free_days INTEGER,
    
    -- Para ciclos semanais fixos (Array de inteiros: 0=Dom, 1=Seg... 6=Sáb)
    weekly_schedule JSONB,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE public.employee_scales ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view employee scales in their tenants" 
    ON public.employee_scales FOR SELECT 
    USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage employee scales" 
    ON public.employee_scales FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = public.employee_scales.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Gatilho de auditoria
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_scales') THEN
        DROP TRIGGER IF EXISTS audit_employee_scales_trigger ON public.employee_scales;
    END IF;
END $$;
CREATE TRIGGER audit_employee_scales_trigger 
AFTER INSERT OR UPDATE OR DELETE ON public.employee_scales 
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();


-- ==========================================
-- Source: 00026_payroll_overtime_rubrics.sql
-- ==========================================

-- Migration: 00026_payroll_overtime_rubrics
-- Description: Cria rubricas padrões de Horas Extras e DSR para todos os tenants.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00048_fix_rubrics_schema.sql
-- ==========================================

-- Migration: 00048_fix_rubrics_schema
-- Description: Alinha o schema da tabela payroll_rubrics com os nomes de colunas 
-- esperados pela tela Rubrics.tsx e pelo motor de cálculo (Edge Function).
-- Resolve o BUG R1 (colunas com nomes incompatíveis entre frontend e banco).

-- 1. Adicionar colunas que a tela Rubrics.tsx espera mas não existem
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- 2. Adicionar colunas com os nomes corretos que a tela usa para incidências patronais
-- (A tela envia: incidence_inss_patronal, incidence_rat, incidence_third_parties)
-- (O banco antigo tinha: inss_patronal_incidence, rat_incidence, terceiros_incidence)
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN DEFAULT false;

-- 3. Adicionar colunas com os nomes corretos que a tela usa para bases geradas
-- (A tela envia: generates_base_inss, generates_base_irrf, generates_base_fgts)
-- (O banco antigo tinha: generates_inss_base, generates_irrf_base, generates_fgts_base)
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN DEFAULT false;

-- 4. Migrar dados existentes das colunas antigas para as novas (se existirem)
DO $$
BEGIN
  -- Migrar incidências patronais
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'inss_patronal_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_inss_patronal = COALESCE(inss_patronal_incidence, false)
    WHERE inss_patronal_incidence IS NOT NULL AND inss_patronal_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'rat_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_rat = COALESCE(rat_incidence, false)
    WHERE rat_incidence IS NOT NULL AND rat_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'terceiros_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_third_parties = COALESCE(terceiros_incidence, false)
    WHERE terceiros_incidence IS NOT NULL AND terceiros_incidence = true;
  END IF;
  
  -- Migrar bases geradas
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_inss_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_inss = COALESCE(generates_inss_base, false)
    WHERE generates_inss_base IS NOT NULL AND generates_inss_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_irrf_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_irrf = COALESCE(generates_irrf_base, false)
    WHERE generates_irrf_base IS NOT NULL AND generates_irrf_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_fgts_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_fgts = COALESCE(generates_fgts_base, false)
    WHERE generates_fgts_base IS NOT NULL AND generates_fgts_base = true;
  END IF;
END $$;

-- 5. Garantir que a coluna calculation_order existe com um bom default
ALTER TABLE public.payroll_rubrics 
  ALTER COLUMN calculation_order SET DEFAULT 50;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00049_fix_rubrics_and_codes.sql
-- ==========================================

-- Migration: 00049_fix_rubrics_and_codes
-- Description: Seed de Rubricas Padrão Corrigido

-- 1. Limpar rubricas duplicadas (1001 vs 101, 2001 vs 901)
-- Se as antigas (1001) não têm vínculos, as deletamos. (Evitando FK violation na payroll_rubrics se já foi usada).
DO $$
BEGIN
  BEGIN
    DELETE FROM public.payroll_rubrics WHERE code IN ('1001', '2001', '2002', '2005');
  EXCEPTION WHEN OTHERS THEN
    -- Soft delete se não for possível hard delete (por foreign key constraint)
    UPDATE public.payroll_rubrics SET is_active = false WHERE code IN ('1001', '2001', '2002', '2005');
  END;
END $$;

-- 2. Inserir rubricas 150 (HE50) e 160 (HE100) para o Espelho de Ponto
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Percorre todos os tenants para garantir as rubricas
  FOR v_tenant_id IN SELECT id FROM public.tenants LOOP
    
    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '150') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '150', 'Hora Extra 50%', 'Hora Extra Padrão (50%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 1.5, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '160') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '160', 'Hora Extra 100%', 'Hora Extra Domingos/Feriados (100%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 2.0, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

  END LOOP;
END $$;


-- ==========================================
-- Source: 00051_employee_portal_rpc.sql
-- ==========================================

-- Migration: 00051_employee_portal_rpc
-- Description: Criação de RPCs para o Portal do Colaborador acessar seus dados com segurança

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_vacation_balance(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00052_employee_portal_profile_rpc.sql
-- ==========================================

-- Migration: 00052_employee_portal_profile_rpc
-- Description: RPC para o Portal do Colaborador acessar seus dados de perfil, benefícios e contrato

-- 1. Dados completos do perfil do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_profile(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        -- Dados pessoais
        'full_name', p.full_name,
        'social_name', p.social_name,
        'cpf', p.cpf,
        'birth_date', p.birth_date,
        'gender', p.gender,
        'email', p.email,
        'phone', p.phone,
        'mobile', p.mobile,
        -- Endereço
        'address', json_build_object(
            'zip_code', p.zip_code,
            'street', p.street,
            'number', p.number,
            'complement', p.complement,
            'neighborhood', p.neighborhood,
            'city', p.city,
            'state', p.state,
            'country', p.country
        ),
        -- Contato de emergência
        'emergency_contact', json_build_object(
            'name', p.emergency_contact_name,
            'phone', p.emergency_contact_phone,
            'relation', p.emergency_contact_relation
        ),
        -- Dados bancários
        'bank', json_build_object(
            'bank_name', w.bank_name,
            'agency', w.agency,
            'account_number', w.account_number,
            'account_digit', w.account_digit,
            'account_type', w.account_type,
            'pix_key', w.pix_key,
            'pix_type', w.pix_type
        ),
        -- Dados do contrato
        'contract', json_build_object(
            'id', ec.id,
            'contract_type', ct.name,
            'contract_category', ct.category,
            'admission_date', ec.admission_date,
            'base_salary', ec.base_salary,
            'status', ec.status,
            'position_title', pos.title,
            'position_cbo', pos.cbo,
            'department_name', dept.name
        )
    ) INTO v_result
    FROM public.workers w
    JOIN public.people p ON p.id = w.person_id
    LEFT JOIN public.employment_contracts ec ON ec.worker_id = w.id AND ec.status = 'ACTIVE'
    LEFT JOIN public.positions pos ON pos.id = ec.position_id
    LEFT JOIN public.departments dept ON dept.id = ec.department_id
    LEFT JOIN public.contract_types ct ON ct.id = ec.contract_type_id
    WHERE w.id = p_worker_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 2. Benefícios ativos do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_benefits(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', eb.id,
            'benefit_name', bc.name,
            'benefit_type', bc.benefit_type,
            'provider_name', bc.provider_name,
            'discount_type', bc.discount_type,
            'discount_value', COALESCE(eb.custom_discount_value, bc.default_discount_value),
            'card_number', eb.card_number,
            'dependent_count', eb.dependent_count,
            'status', eb.status
        ) ORDER BY bc.name
    ) INTO v_result
    FROM public.employee_benefits eb
    JOIN public.benefits_catalog bc ON bc.id = eb.benefit_id
    WHERE eb.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id AND status = 'ACTIVE'
    )
    AND eb.status = 'ACTIVE';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_benefits(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00053_fix_payslips_rpc.sql
-- ==========================================

-- Migration: 00053_fix_payslips_rpc
-- Description: Adiciona SECURITY DEFINER à função get_employee_payslips para o Portal do Colaborador

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00054_payslip_details_rpc.sql
-- ==========================================

-- Migration: 00054_payslip_details_rpc
-- Description: RPC para obter os detalhes analíticos de um holerite (rubricas, totais e bases)

CREATE OR REPLACE FUNCTION public.get_employee_payslip_details(p_payslip_id UUID, p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Segurança: Garante que o holerite solicitado pertence ao contrato do colaborador
    IF NOT EXISTS (
        SELECT 1 FROM public.payslips p
        JOIN public.employment_contracts ec ON ec.id = p.contract_id
        WHERE p.id = p_payslip_id AND ec.worker_id = p_worker_id
    ) THEN
        RETURN '{}'::JSON;
    END IF;

    SELECT json_build_object(
        'totals', json_build_object(
            'total_earnings', p.total_earnings,
            'total_deductions', p.total_deductions,
            'net_salary', p.net_salary,
            'base_inss', p.base_inss,
            'base_irrf', p.base_irrf,
            'base_fgts', p.base_fgts,
            'fgts_month', p.fgts_month
        ),
        'items', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'code', pr.code,
                    'name', pr.name,
                    'reference', pi.reference,
                    'amount', pi.amount,
                    'type', pi.type
                ) ORDER BY pi.type DESC, pr.code ASC
            ), '[]'::JSON)
            FROM public.payslip_items pi
            JOIN public.payroll_rubrics pr ON pr.id = pi.rubric_id
            WHERE pi.payslip_id = p.id
        )
    ) INTO v_result
    FROM public.payslips p
    WHERE p.id = p_payslip_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslip_details(UUID, UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00055_vacation_requests_rpc.sql
-- ==========================================

-- Migration: 00055_vacation_requests_rpc
-- Description: Atualiza a RPC get_employee_vacation_balance para incluir as solicitações/férias programadas (vacation_requests)

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status,
            'requests', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', vr.id,
                        'start_date', vr.start_date,
                        'end_date', vr.end_date,
                        'days_taken', vr.days_taken,
                        'status', vr.status
                    ) ORDER BY vr.start_date ASC
                ), '[]'::JSON)
                FROM public.vacation_requests vr
                WHERE vr.vesting_period_id = vp.id
            )
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00056_employee_documents_storage.sql
-- ==========================================

-- Migration: 00056_employee_documents_storage
-- Description: Criação do bucket employee-documents, políticas de storage e RPCs para a Central de Documentos

-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Storage para o bucket employee-documents
-- Permitir leitura pública (já que o bucket é public, mas garantindo acesso)
DROP POLICY IF EXISTS "employee_docs_public_access" ON storage.objects;
CREATE POLICY "employee_docs_public_access" ON storage.objects FOR SELECT 
USING (bucket_id = 'employee-documents');

-- Permitir upload pelo portal do colaborador (como usa autenticação customizada, precisamos liberar para anon)
DROP POLICY IF EXISTS "employee_docs_anon_upload" ON storage.objects;
CREATE POLICY "employee_docs_anon_upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'employee-documents');

-- Permitir upload e gerência pelo admin (autenticado)
DROP POLICY IF EXISTS "employee_docs_admin_full_access" ON storage.objects;
CREATE POLICY "employee_docs_admin_full_access" ON storage.objects FOR ALL 
USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');

-- 3. RPC para buscar documentos pessoais (Portal)
CREATE OR REPLACE FUNCTION public.get_worker_personal_documents(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', d.id,
            'document_type', d.document_type,
            'status', d.status,
            'file_url', d.file_url,
            'issue_date', d.issue_date,
            'expiration_date', d.expiration_date,
            'created_at', d.created_at,
            'updated_at', d.updated_at
        ) ORDER BY d.created_at DESC
    ) INTO v_result
    FROM public.worker_personal_documents d
    WHERE d.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 4. RPC para o colaborador enviar um documento
CREATE OR REPLACE FUNCTION public.submit_worker_personal_document(
    p_worker_id UUID,
    p_document_type TEXT,
    p_file_url TEXT
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_doc_id UUID;
BEGIN
    -- Pegar o tenant_id do worker
    SELECT tenant_id INTO v_tenant_id FROM public.employment_contracts WHERE worker_id = p_worker_id LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Worker not found';
    END IF;

    -- Verificar se já existe um documento pendente ou rejeitado deste tipo
    SELECT id INTO v_doc_id
    FROM public.worker_personal_documents
    WHERE worker_id = p_worker_id AND document_type = p_document_type
    LIMIT 1;

    IF v_doc_id IS NOT NULL THEN
        -- Atualizar existente
        UPDATE public.worker_personal_documents
        SET file_url = p_file_url,
            status = 'SUBMITTED',
            updated_at = NOW()
        WHERE id = v_doc_id;
    ELSE
        -- Inserir novo
        INSERT INTO public.worker_personal_documents (
            tenant_id,
            worker_id,
            document_type,
            file_url,
            status
        ) VALUES (
            v_tenant_id,
            p_worker_id,
            p_document_type,
            p_file_url,
            'SUBMITTED'
        ) RETURNING id INTO v_doc_id;
    END IF;

    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC para o Analista de RH atualizar o status do documento (Aprovar/Rejeitar)
CREATE OR REPLACE FUNCTION public.update_worker_document_status(
    p_document_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.worker_personal_documents
    SET status = p_status,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00057_worker_signatures_rpc.sql
-- ==========================================

-- Migration: 00057_worker_signatures_rpc

CREATE OR REPLACE FUNCTION public.get_worker_signatures(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', ed.id,
            'title', ed.title,
            'status', ed.status,
            'file_url', ed.file_url,
            'requires_employee_signature', ed.requires_employee_signature,
            'created_at', ed.created_at
        ) ORDER BY ed.created_at DESC
    ) INTO v_result
    FROM public.employee_documents ed
    WHERE ed.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sign_worker_document(p_document_id UUID, p_worker_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.employee_documents
    SET status = 'SIGNED',
        updated_at = NOW()
    WHERE id = p_document_id AND worker_id = p_worker_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00058_alter_worker_docs_status.sql
-- ==========================================

-- Migration: 00058_alter_worker_docs_status
-- Description: Altera a constraint de status em worker_personal_documents para suportar o fluxo de upload e auditoria

ALTER TABLE public.worker_personal_documents
DROP CONSTRAINT IF EXISTS worker_personal_documents_status_check;

ALTER TABLE public.worker_personal_documents
ADD CONSTRAINT worker_personal_documents_status_check 
CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']));


-- ==========================================
-- Source: 00059_payroll_periods_company.sql
-- ==========================================

-- Migration: 00042_payroll_periods_company
-- Description: Adiciona company_id aos períodos de folha para permitir que cada empresa tenha seus próprios fechamentos.

-- 1. Adiciona a coluna company_id (permitindo null inicialmente para dados antigos)
-- ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Limpa os períodos existentes para evitar inconsistências (como estamos em dev/MVP e a folha deve ser por empresa)
-- Obs: Isso vai apagar os holerites calculados, será necessário rodar o motor novamente.
TRUNCATE TABLE public.payroll_periods CASCADE;

-- 3. Torna a coluna NOT NULL após a limpeza
-- ALTER TABLE public.payroll_periods ALTER COLUMN company_id SET NOT NULL;

-- 4. Atualiza a constraint de unicidade para incluir a empresa
-- ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_tenant_id_month_year_type_key;

-- Dependendo de como a constraint foi nomeada, pode ser "payroll_periods_tenant_id_competence_month_competence_y_key"
-- Vamos garantir removendo qualquer constraint de unique nas colunas antigas:
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'payroll_periods' AND constraint_type = 'UNIQUE') 
    LOOP
        EXECUTE '-- ALTER TABLE public.payroll_periods DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_tenant_company_month_year_type_key UNIQUE (tenant_id, company_id, month, year, type);

NOTIFY pgrst, 'reload schema';


NOTIFY pgrst, 'reload schema';
