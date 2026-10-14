-- Migration: 00077_time_tracking_pt01.sql
-- Description: Módulo de Ponto Eletrônico (PT-01) - Portaria MTP 671/2021 e CLT (art. 74)
-- Criação de time_devices, afd_files, time_punch_records (imutável), time_daily_summary,
-- extensão de time_bank_accounts com políticas e time_entries com punch_record_id.

-- 1. TABELA DE DISPOSITIVOS E FONTES DE PONTO (REP-C, REP-P, IMPORT)
CREATE TABLE IF NOT EXISTS public.time_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('REP_C', 'REP_P_MOBILE', 'IMPORT')),
    vendor TEXT,               -- Ex: 'Control iD'
    model TEXT,                -- Ex: 'iDClass', 'iDFlex'
    serial_number TEXT,        -- Número de fabricação/registro INMETRO
    host TEXT,                 -- IP/host local para comunicação com coletor
    port INTEGER DEFAULT 80,
    last_nsr BIGINT NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'OFFLINE', 'MAINTENANCE')),
    api_key_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE ARQUIVOS AFD (ARQUIVO-FONTE DE DADOS - PORTARIA 671)
CREATE TABLE IF NOT EXISTS public.afd_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.time_devices(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,   -- SHA256 do arquivo original para idempotência
    file_size_bytes BIGINT,
    storage_path TEXT,
    period_start DATE,
    period_end DATE,
    total_records INTEGER NOT NULL DEFAULT 0,
    imported_records INTEGER NOT NULL DEFAULT 0,
    duplicate_records INTEGER NOT NULL DEFAULT 0,
    rejected_records INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'IMPORTED', 'ERROR')),
    error_message TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_afd_files_tenant_hash UNIQUE (tenant_id, file_hash)
);

-- 3. TRILHA IMUTÁVEL DE REGISTROS DE PONTO (time_punch_records)
CREATE TABLE IF NOT EXISTS public.time_punch_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.time_devices(id) ON DELETE SET NULL,
    nsr BIGINT NOT NULL,       -- Número Sequencial de Registro (estrito por equipamento)
    record_type INTEGER NOT NULL DEFAULT 3, -- 3 = Registro de Ponto na Portaria 671
    punched_at TIMESTAMPTZ NOT NULL,        -- Horário com fuso carimbado confiavelmente
    cpf TEXT,
    pis TEXT,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('REP', 'MOBILE', 'IMPORT', 'MANUAL')),
    geo JSONB,                 -- Dados de geolocalização ({lat, lng, accuracy, address})
    ip INET,
    device_fingerprint TEXT,
    receipt_code TEXT,         -- Código de autenticação do comprovante entregue ao trabalhador
    raw_line TEXT,             -- Linha bruta original lida do arquivo AFD
    crc_ok BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_time_punch_records_device_nsr UNIQUE (device_id, nsr)
);

-- GARANTIA JURÍDICA DE IMUTABILIDADE: PROIBIÇÃO ABSOLUTA DE UPDATE E DELETE EM BATIDAS ORIGINAIS
CREATE OR REPLACE FUNCTION public.prevent_punch_record_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'A trilha de registros originais de ponto (time_punch_records) é estritamente imutável (Portaria MTP 671/2021 e CLT art. 74). Operações de UPDATE ou DELETE são terminantemente proibidas.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_time_punch_records ON public.time_punch_records;
CREATE TRIGGER trg_immutable_time_punch_records
BEFORE UPDATE OR DELETE ON public.time_punch_records
FOR EACH ROW
EXECUTE FUNCTION public.prevent_punch_record_mutation();

-- 4. VINCULAR BATIDA ORIGINAL EM time_entries
ALTER TABLE public.time_entries 
    ADD COLUMN IF NOT EXISTS punch_record_id UUID REFERENCES public.time_punch_records(id) ON DELETE RESTRICT;

-- 5. POLÍTICAS DE BANCO DE HORAS EM time_bank_accounts (CLT art. 59 §§ 2º e 5º)
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS policy_type TEXT CHECK (policy_type IN ('ACORDO_INDIVIDUAL', 'CCT', 'ACT')) DEFAULT 'ACORDO_INDIVIDUAL',
    ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 6,
    ADD COLUMN IF NOT EXISTS expiration_rule TEXT CHECK (expiration_rule IN ('PAY_AS_OVERTIME', 'FORFEIT', 'EXTEND')) DEFAULT 'PAY_AS_OVERTIME',
    ADD COLUMN IF NOT EXISTS max_positive_balance_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS closure_date DATE;

-- 6. TABELA DE RESUMO DIÁRIO DE JORNADA (time_daily_summary)
CREATE TABLE IF NOT EXISTS public.time_daily_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Jornada prevista vs realizada (minutos)
    expected_work_minutes INTEGER NOT NULL DEFAULT 0,
    worked_minutes INTEGER NOT NULL DEFAULT 0,
    
    -- Eventos apurados (minutos)
    overtime_50_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_100_minutes INTEGER NOT NULL DEFAULT 0,
    night_shift_minutes INTEGER NOT NULL DEFAULT 0,
    night_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    absence_minutes INTEGER NOT NULL DEFAULT 0,
    
    -- Intervalos (minutos)
    break_taken_minutes INTEGER NOT NULL DEFAULT 0,
    break_expected_minutes INTEGER NOT NULL DEFAULT 0,
    
    -- Violações legais da CLT
    intrajornada_violation_minutes INTEGER NOT NULL DEFAULT 0, -- CLT art. 71
    interjornada_violation_minutes INTEGER NOT NULL DEFAULT 0, -- CLT art. 66 (mínimo 11h)
    
    -- Banco de horas (minutos movimentados)
    time_bank_credited_minutes INTEGER NOT NULL DEFAULT 0,
    time_bank_debited_minutes INTEGER NOT NULL DEFAULT 0,
    
    -- Status e inconsistências
    status TEXT NOT NULL DEFAULT 'REGULAR' CHECK (status IN ('REGULAR', 'PENDING_APPROVAL', 'JUSTIFIED', 'INCONSISTENT', 'DAY_OFF', 'HOLIDAY', 'LEAVE', 'VACATION')),
    inconsistencies TEXT[] DEFAULT '{}',
    
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_time_daily_summary_contract_date UNIQUE (contract_id, date)
);

-- ====================================================================
-- 7. SEGURANÇA: ROW LEVEL SECURITY (RLS) MULTITENANT
-- ====================================================================

ALTER TABLE public.time_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afd_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_daily_summary ENABLE ROW LEVEL SECURITY;

-- Políticas para time_devices
DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_devices" ON public.time_devices;
CREATE POLICY "Tenant Admins and DP can manage time_devices" 
    ON public.time_devices FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_devices.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Políticas para afd_files
DROP POLICY IF EXISTS "Tenant Admins and DP can manage afd_files" ON public.afd_files;
CREATE POLICY "Tenant Admins and DP can manage afd_files" 
    ON public.afd_files FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = afd_files.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Políticas para time_punch_records
DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_punch_records" ON public.time_punch_records;
CREATE POLICY "Tenant Admins and DP can manage time_punch_records" 
    ON public.time_punch_records FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_punch_records.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Colaboradores podem consultar seus próprios registros de ponto
DROP POLICY IF EXISTS "Employees can view their own punch records" ON public.time_punch_records;
CREATE POLICY "Employees can view their own punch records"
    ON public.time_punch_records FOR SELECT
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND (
            worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
            OR contract_id IN (
                SELECT ec.id FROM public.employment_contracts ec
                JOIN public.workers w ON w.id = ec.worker_id
                WHERE w.user_id = auth.uid()
            )
        )
    );

-- Políticas para time_daily_summary
DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_daily_summary" ON public.time_daily_summary;
CREATE POLICY "Tenant Admins and DP can manage time_daily_summary" 
    ON public.time_daily_summary FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_daily_summary.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Employees can view their own daily summary" ON public.time_daily_summary;
CREATE POLICY "Employees can view their own daily summary"
    ON public.time_daily_summary FOR SELECT
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND contract_id IN (
            SELECT ec.id FROM public.employment_contracts ec
            JOIN public.workers w ON w.id = ec.worker_id
            WHERE w.user_id = auth.uid()
        )
    );

-- ====================================================================
-- 8. GATILHOS DE AUDITORIA (T29 / Portaria 671)
-- ====================================================================

DROP TRIGGER IF EXISTS audit_time_devices_trigger ON public.time_devices;
CREATE TRIGGER audit_time_devices_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.time_devices 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_afd_files_trigger ON public.afd_files;
CREATE TRIGGER audit_afd_files_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.afd_files 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_time_punch_records_trigger ON public.time_punch_records;
CREATE TRIGGER audit_time_punch_records_trigger 
    AFTER INSERT ON public.time_punch_records 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_time_daily_summary_trigger ON public.time_daily_summary;
CREATE TRIGGER audit_time_daily_summary_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.time_daily_summary 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_time_bank_accounts_trigger ON public.time_bank_accounts;
CREATE TRIGGER audit_time_bank_accounts_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.time_bank_accounts 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
