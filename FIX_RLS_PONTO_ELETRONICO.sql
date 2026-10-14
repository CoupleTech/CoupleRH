-- ==============================================================================
-- COUPLE RH - CORREÇÃO DE POLÍTICAS RLS E GRANTS PARA PONTO ELETRÔNICO (PORTARIA 671)
-- Executar no SQL Editor do Supabase Dashboard (https://supabase.com/dashboard)
-- Idempotente: pode ser executado múltiplas vezes com total segurança.
-- ==============================================================================

-- 1. CONCEDER PERMISSÕES (GRANTS) PARA USUÁRIOS AUTENTICADOS E SERVICE_ROLE
GRANT ALL ON public.time_devices TO authenticated, service_role;
GRANT ALL ON public.afd_files TO authenticated, service_role;
GRANT ALL ON public.time_punch_records TO authenticated, service_role;
GRANT ALL ON public.time_daily_summary TO authenticated, service_role;
GRANT ALL ON public.timesheets TO authenticated, service_role;
GRANT ALL ON public.timesheet_contests TO authenticated, service_role;

GRANT SELECT ON public.time_devices TO anon;
GRANT SELECT ON public.time_punch_records TO anon;
GRANT SELECT ON public.time_daily_summary TO anon;

-- 2. HABILITAR RLS NAS TABELAS
ALTER TABLE public.time_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afd_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_daily_summary ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS PARA time_devices
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

-- 4. POLÍTICAS RLS PARA afd_files
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

-- 5. POLÍTICAS RLS PARA time_punch_records
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

-- 6. POLÍTICAS RLS PARA time_daily_summary
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

-- 7. RPC ATÔMICA DE ALTA PERFORMANCE PARA INSERÇÃO EM LOTE DE BATIDAS AFD (SECURITY DEFINER)
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

-- 8. RECARREGAR O SCHEMA CACHE DO POSTGREST IMEDIATAMENTE
NOTIFY pgrst, 'reload schema';
