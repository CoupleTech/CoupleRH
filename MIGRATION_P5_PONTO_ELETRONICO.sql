-- ==============================================================================
-- COUPLE RH - MIGRATION CONSOLIDADA FASE P5 (PONTO ELETRÔNICO PORTARIA MTP 671/2021)
-- Executar no SQL Editor do Supabase Dashboard (https://supabase.com/dashboard)
-- Idempotente: pode ser executado múltiplas vezes com total segurança.
-- ==============================================================================

-- 0. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    file_hash TEXT NOT NULL,
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
    punched_at TIMESTAMPTZ NOT NULL,
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

-- 5. CAMPOS E POLÍTICAS DE BANCO DE HORAS EM time_bank_accounts (CLT art. 59)
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS policy_type TEXT CHECK (policy_type IN ('ACORDO_INDIVIDUAL', 'CCT', 'ACT')) DEFAULT 'ACORDO_INDIVIDUAL',
    ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 6,
    ADD COLUMN IF NOT EXISTS expiration_rule TEXT CHECK (expiration_rule IN ('PAY_AS_OVERTIME', 'FORFEIT', 'EXTEND')) DEFAULT 'PAY_AS_OVERTIME',
    ADD COLUMN IF NOT EXISTS max_positive_balance_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS closure_date DATE,
    ADD COLUMN IF NOT EXISTS warning_days_before_expiration INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_out_payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payout_rubric_code TEXT DEFAULT '152';

-- 6. TABELA DE RESUMO DIÁRIO DE JORNADA (time_daily_summary)
CREATE TABLE IF NOT EXISTS public.time_daily_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    expected_minutes INTEGER NOT NULL DEFAULT 0,
    worked_minutes INTEGER NOT NULL DEFAULT 0,
    balance_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_50_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_100_minutes INTEGER NOT NULL DEFAULT 0,
    night_shift_minutes INTEGER NOT NULL DEFAULT 0,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    absence_minutes INTEGER NOT NULL DEFAULT 0,
    intrajornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    is_dsr BOOLEAN NOT NULL DEFAULT false,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    punches_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'INCOMPLETE', 'OVERTIME', 'DELAY', 'ABSENCE', 'EXCUSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_time_daily_summary_contract_date UNIQUE (contract_id, date)
);

-- 7. CAMPOS DE GEOFENCE EM WORKPLACES E TELETRABALHO EM CONTRATOS
ALTER TABLE public.workplaces
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 200,
    ADD COLUMN IF NOT EXISTS enforce_geofence BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.employment_contracts
    ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_telework BOOLEAN NOT NULL DEFAULT false;

-- 8. ESTENDER TABELA timesheets COM TOTALIZADORES LEGAIS E CAMPOS DE CONTESTAÇÃO
ALTER TABLE public.timesheets
    ADD COLUMN IF NOT EXISTS total_overtime_50_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_overtime_100_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_delay_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_absence_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_intrajornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_balance_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS document_hash TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS contested_at TIMESTAMPTZ;

-- 9. TABELA DE CONTESTAÇÕES DO ESPELHO DE PONTO (timesheet_contests)
CREATE TABLE IF NOT EXISTS public.timesheet_contests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    affected_dates DATE[] NOT NULL DEFAULT '{}',
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED_ACCEPTED', 'REJECTED')),
    reviewed_by UUID,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABELA DE FECHAMENTO DO PERÍODO DE PONTO (time_period_closures)
CREATE TABLE IF NOT EXISTS public.time_period_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('OPEN', 'PROCESSING', 'CLOSED', 'REOPENED')),
    total_contracts INTEGER NOT NULL DEFAULT 0,
    total_events_generated INTEGER NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    closed_by UUID,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reopened_by UUID,
    reopened_at TIMESTAMPTZ,
    reopen_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, payroll_period_id, company_id)
);

-- 11. RPC: REGISTRO DE PONTO POR APLICATIVO / CELULAR (REP-P)
CREATE OR REPLACE FUNCTION public.register_mobile_punch(
    p_contract_id UUID,
    p_geo JSONB DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip INET DEFAULT NULL,
    p_receipt_code TEXT DEFAULT NULL,
    p_entry_type TEXT DEFAULT 'IN'
)
RETURNS TABLE (
    punch_id UUID,
    device_id UUID,
    nsr BIGINT,
    punched_at TIMESTAMPTZ,
    receipt_code TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_company_id UUID;
    v_worker_id UUID;
    v_cpf TEXT;
    v_pis TEXT;
    v_device_id UUID;
    v_nsr BIGINT;
    v_punched_at TIMESTAMPTZ := NOW();
    v_punch_id UUID;
    v_receipt_code TEXT;
BEGIN
    -- 1. Buscar dados do contrato
    SELECT 
        ec.tenant_id,
        ec.company_id,
        ec.worker_id,
        REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g'),
        REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
    INTO
        v_tenant_id,
        v_company_id,
        v_worker_id,
        v_cpf,
        v_pis
    FROM public.employment_contracts ec
    JOIN public.workers w ON w.id = ec.worker_id
    JOIN public.people p ON p.id = w.person_id
    WHERE ec.id = p_contract_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Contrato de trabalho % não encontrado.', p_contract_id;
    END IF;

    -- 2. Localizar ou instanciar o dispositivo REP_P_MOBILE da empresa
    SELECT id INTO v_device_id
    FROM public.time_devices
    WHERE tenant_id = v_tenant_id 
      AND (company_id = v_company_id OR company_id IS NULL)
      AND kind = 'REP_P_MOBILE'
      AND status = 'ACTIVE'
    LIMIT 1;

    IF v_device_id IS NULL THEN
        INSERT INTO public.time_devices (
            tenant_id,
            company_id,
            name,
            kind,
            vendor,
            model,
            status,
            last_nsr
        ) VALUES (
            v_tenant_id,
            v_company_id,
            'App Mobile REP-P',
            'REP_P_MOBILE',
            'CoupleRH Mobile',
            'PWA REP-P Portaria 671',
            'ACTIVE',
            0
        ) RETURNING id INTO v_device_id;
    END IF;

    -- 3. Obter próximo NSR sequencial de forma atômica
    UPDATE public.time_devices
    SET 
        last_nsr = last_nsr + 1,
        last_sync_at = v_punched_at
    WHERE id = v_device_id
    RETURNING last_nsr INTO v_nsr;

    -- 4. Gerar hash do comprovante se não fornecido
    IF p_receipt_code IS NULL OR p_receipt_code = '' THEN
        v_receipt_code := encode(digest(v_nsr::text || '|' || v_punched_at::text || '|' || v_cpf, 'sha256'), 'hex');
    ELSE
        v_receipt_code := p_receipt_code;
    END IF;

    -- 5. Inserir na trilha imutável (time_punch_records)
    INSERT INTO public.time_punch_records (
        tenant_id,
        company_id,
        device_id,
        nsr,
        record_type,
        punched_at,
        cpf,
        pis,
        worker_id,
        contract_id,
        source,
        geo,
        ip,
        device_fingerprint,
        receipt_code,
        crc_ok
    ) VALUES (
        v_tenant_id,
        v_company_id,
        v_device_id,
        v_nsr,
        3,
        v_punched_at,
        v_cpf,
        v_pis,
        v_worker_id,
        p_contract_id,
        'MOBILE',
        p_geo,
        p_ip,
        p_device_fingerprint,
        v_receipt_code,
        true
    ) RETURNING id INTO v_punch_id;

    -- 6. Espelhar na tabela de marcações de jornada (time_entries)
    INSERT INTO public.time_entries (
        tenant_id,
        contract_id,
        original_timestamp,
        entry_type,
        punch_record_id,
        device_info,
        status
    ) VALUES (
        v_tenant_id,
        p_contract_id,
        v_punched_at,
        p_entry_type,
        v_punch_id,
        p_device_fingerprint,
        'APPROVED'
    );

    RETURN QUERY SELECT 
        v_punch_id,
        v_device_id,
        v_nsr,
        v_punched_at,
        v_receipt_code;
END;
$$ LANGUAGE plpgsql;

-- 12. RPC: CONSULTAR BATIDAS DE HOJE DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_today_punches(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_punches JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', te.id,
                'entry_type', te.entry_type,
                'original_timestamp', te.original_timestamp,
                'status', te.status,
                'punch_record_id', te.punch_record_id,
                'receipt_code', pr.receipt_code,
                'nsr', pr.nsr
            ) ORDER BY te.original_timestamp ASC
        ),
        '[]'::jsonb
    ) INTO v_punches
    FROM public.time_entries te
    LEFT JOIN public.time_punch_records pr ON pr.id = te.punch_record_id
    WHERE te.contract_id = p_contract_id
      AND DATE(te.original_timestamp AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

    RETURN v_punches;
END;
$$;

-- 13. RPC: CONSULTAR RESUMO DO BANCO DE HORAS ATIVO DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_time_bank(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account RECORD;
    v_transactions JSONB;
    v_days_left INT;
    v_alert TEXT := 'NORMAL';
BEGIN
    SELECT * INTO v_account
    FROM public.time_bank_accounts
    WHERE contract_id = p_contract_id
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_active_account', false,
            'balance_minutes', 0,
            'formatted_balance', '+00:00',
            'transactions', '[]'::jsonb
        );
    END IF;

    -- Calcular dias restantes para expiração
    v_days_left := COALESCE(v_account.valid_until - CURRENT_DATE, 180);

    IF v_days_left <= 0 THEN
        v_alert := 'EXPIRED';
    ELSIF v_days_left <= 30 THEN
        v_alert := 'EXPIRING_SOON';
    END IF;

    -- Obter últimas 20 transações
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'transaction_type', t.transaction_type,
                'minutes', t.minutes,
                'balance_after_minutes', t.balance_after_minutes,
                'origin_date', t.origin_date,
                'description', t.description,
                'created_at', t.created_at
            ) ORDER BY t.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_transactions
    FROM (
        SELECT * FROM public.time_bank_transactions
        WHERE account_id = v_account.id
        ORDER BY created_at DESC
        LIMIT 20
    ) t;

    RETURN jsonb_build_object(
        'has_active_account', true,
        'account_id', v_account.id,
        'agreement_type', v_account.agreement_type,
        'balance_minutes', v_account.balance_minutes,
        'valid_from', v_account.valid_from,
        'valid_until', v_account.valid_until,
        'days_remaining', v_days_left,
        'alert_status', v_alert,
        'max_monthly_negative_balance', v_account.max_monthly_negative_balance,
        'transactions', v_transactions
    );
END;
$$;

-- 14. RPC: CONSULTAR ESPELHOS MENSAIS DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_timesheets(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sheets JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ts.id,
                'period_year', ts.period_year,
                'period_month', ts.period_month,
                'status', ts.status,
                'total_regular_minutes', ts.total_regular_minutes,
                'total_overtime_50_minutes', ts.total_overtime_50_minutes,
                'total_overtime_100_minutes', ts.total_overtime_100_minutes,
                'total_night_shift_minutes', ts.total_night_shift_minutes,
                'total_delay_minutes', ts.total_delay_minutes,
                'total_absence_minutes', ts.total_absence_minutes,
                'time_bank_balance_minutes', ts.time_bank_balance_minutes,
                'document_hash', ts.document_hash,
                'contested_at', ts.contested_at,
                'signed_at', ts.signed_at,
                'created_at', ts.created_at
            ) ORDER BY ts.period_year DESC, ts.period_month DESC
        ),
        '[]'::jsonb
    ) INTO v_sheets
    FROM public.timesheets ts
    WHERE ts.contract_id = p_contract_id;

    RETURN v_sheets;
END;
$$;

-- 15. RPC: ASSINATURA DIGITAL / CIÊNCIA DO ESPELHO DE PONTO
CREATE OR REPLACE FUNCTION public.sign_employee_timesheet(
    p_contract_id UUID,
    p_timesheet_id UUID,
    p_signature_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ts RECORD;
BEGIN
    SELECT * INTO v_ts
    FROM public.timesheets
    WHERE id = p_timesheet_id
      AND contract_id = p_contract_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Espelho de ponto não encontrado.');
    END IF;

    IF v_ts.status = 'SIGNED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Espelho já assinado anteriormente.');
    END IF;

    UPDATE public.timesheets
    SET status = 'SIGNED',
        signed_at = NOW(),
        document_hash = COALESCE(document_hash, p_signature_hash),
        updated_at = NOW()
    WHERE id = p_timesheet_id;

    RETURN jsonb_build_object('success', true, 'signed_at', NOW());
END;
$$;

-- 16. PERMISSÕES DE ACESSO (ROLES ANON, AUTHENTICATED E SERVICE_ROLE)
GRANT ALL ON public.time_devices TO authenticated, service_role;
GRANT ALL ON public.afd_files TO authenticated, service_role;
GRANT ALL ON public.time_punch_records TO authenticated, service_role;
GRANT ALL ON public.time_daily_summary TO authenticated, service_role;
GRANT ALL ON public.timesheets TO authenticated, service_role;
GRANT ALL ON public.timesheet_contests TO authenticated, service_role;
GRANT ALL ON public.time_bank_accounts TO authenticated, service_role;
GRANT ALL ON public.time_bank_transactions TO authenticated, service_role;

GRANT SELECT ON public.time_devices TO anon;
GRANT SELECT ON public.time_punch_records TO anon;
GRANT SELECT ON public.time_daily_summary TO anon;

GRANT EXECUTE ON FUNCTION public.register_mobile_punch TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_today_punches(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_time_bank(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_timesheets(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sign_employee_timesheet(UUID, UUID, TEXT) TO anon, authenticated, service_role;

-- 17. HABILITAR E CONFIGURAR POLÍTICAS RLS (ROW-LEVEL SECURITY)
ALTER TABLE public.time_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afd_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_daily_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_devices" ON public.time_devices;
CREATE POLICY "Tenant Admins and DP can manage time_devices" 
    ON public.time_devices FOR ALL 
    TO authenticated
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_devices.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_devices.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage afd_files" ON public.afd_files;
CREATE POLICY "Tenant Admins and DP can manage afd_files" 
    ON public.afd_files FOR ALL 
    TO authenticated
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = afd_files.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = afd_files.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_punch_records" ON public.time_punch_records;
CREATE POLICY "Tenant Admins and DP can manage time_punch_records" 
    ON public.time_punch_records FOR ALL 
    TO authenticated
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_punch_records.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_punch_records.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    );

DROP POLICY IF EXISTS "Employees can view their own punch records" ON public.time_punch_records;
CREATE POLICY "Employees can view their own punch records"
    ON public.time_punch_records FOR SELECT
    TO authenticated
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.employment_contracts ec
            JOIN public.workers w ON w.id = ec.worker_id
            JOIN public.people p ON p.id = w.person_id
            WHERE ec.id = time_punch_records.contract_id
            AND (p.user_id = auth.uid() OR ec.worker_id = auth.uid() OR p.cpf = (SELECT cpf FROM public.people WHERE user_id = auth.uid() LIMIT 1))
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_daily_summary" ON public.time_daily_summary;
CREATE POLICY "Tenant Admins and DP can manage time_daily_summary" 
    ON public.time_daily_summary FOR ALL 
    TO authenticated
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_daily_summary.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_daily_summary.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
        )
    );

-- 18. RPC ATÔMICA DE ALTA PERFORMANCE PARA INSERÇÃO EM LOTE DE BATIDAS AFD (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.import_afd_punch_records(
    p_tenant_id UUID,
    p_company_id UUID,
    p_device_id UUID,
    p_punches JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Validar pertencimento e autorização do usuário no tenant
    IF NOT (p_tenant_id = ANY (public.user_tenant_ids())) THEN
        RAISE EXCEPTION 'Acesso negado: o usuário não pertence ao tenant indicado.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_users 
        WHERE user_id = auth.uid() 
          AND tenant_id = p_tenant_id 
          AND role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager')
    ) THEN
        RAISE EXCEPTION 'Acesso negado: permissão insuficiente para importar registros de ponto.';
    END IF;

    -- Inserção atômica no lote com resolução de duplicatas por NSR
    INSERT INTO public.time_punch_records (
        tenant_id,
        company_id,
        device_id,
        nsr,
        record_type,
        punched_at,
        cpf,
        pis,
        worker_id,
        contract_id,
        source,
        raw_line,
        crc_ok
    )
    SELECT
        p_tenant_id,
        p_company_id,
        p_device_id,
        (x->>'nsr')::BIGINT,
        COALESCE((x->>'record_type')::INTEGER, 3),
        (x->>'punched_at')::TIMESTAMPTZ,
        x->>'cpf',
        x->>'pis',
        NULLIF(x->>'worker_id', '')::UUID,
        NULLIF(x->>'contract_id', '')::UUID,
        COALESCE(x->>'source', 'IMPORT'),
        x->>'raw_line',
        COALESCE((x->>'crc_ok')::BOOLEAN, true)
    FROM jsonb_array_elements(p_punches) AS x
    ON CONFLICT (device_id, nsr) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'inserted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_afd_punch_records(UUID, UUID, UUID, JSONB) TO authenticated, service_role;

-- 19. RECARREGAR O SCHEMA CACHE DO POSTGREST IMEDIATAMENTE
NOTIFY pgrst, 'reload schema';
