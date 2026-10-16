-- Migration: 00095_geofence_server_side_validation_tb05.sql
-- Description: TB-05 - Validação server-side de geofence, cálculo Haversine e enriquecimento da RPC register_mobile_punch

-- 1. ADICIONAR COLUNAS DE AUDITORIA DE GEOFENCING EM TIME_PUNCH_RECORDS
ALTER TABLE public.time_punch_records
    ADD COLUMN IF NOT EXISTS distance_meters NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS geofence_status TEXT;

COMMENT ON COLUMN public.time_punch_records.distance_meters IS 'Distância métrica em relação à sede/lotação do colaborador no momento da batida.';
COMMENT ON COLUMN public.time_punch_records.geofence_status IS 'Resultado da checagem de perímetro (INSIDE, OUTSIDE, TELEWORK, AUDIT_ONLY, NO_GPS).';

-- 2. FUNÇÃO GEODÉSICA DE HAVERSINE NO POSTGRESQL (EM METROS)
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance_meters(
    lat1 NUMERIC,
    lon1 NUMERIC,
    lat2 NUMERIC,
    lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r CONSTANT NUMERIC := 6371000; -- Raio médio da Terra em metros
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    IF lat1 = lat2 AND lon1 = lon2 THEN
        RETURN 0;
    END IF;

    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

    RETURN ROUND(r * c, 1);
END;
$$;

-- 3. ATUALIZAÇÃO DA RPC REGISTER_MOBILE_PUNCH COM VALIDAÇÃO SERVER-SIDE
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
SET search_path = public, extensions
AS $$
DECLARE
    v_tenant_id UUID;
    v_company_id UUID;
    v_worker_id UUID;
    v_workplace_id UUID;
    v_is_telework BOOLEAN := false;
    v_cpf TEXT;
    v_pis TEXT;
    v_device_id UUID;
    v_nsr BIGINT;
    v_punched_at TIMESTAMPTZ := NOW();
    v_punch_id UUID;
    v_receipt_code TEXT;

    -- Variáveis de Geofence
    v_wp_name TEXT;
    v_wp_lat NUMERIC;
    v_wp_lon NUMERIC;
    v_wp_radius INTEGER := 50;
    v_wp_enforce BOOLEAN := false;
    v_user_lat NUMERIC;
    v_user_lon NUMERIC;
    v_distance_meters NUMERIC := NULL;
    v_geofence_status TEXT := 'NO_CONFIG';
BEGIN
    -- 1. Buscar dados do contrato de trabalho e lotação
    SELECT 
        ec.tenant_id,
        ec.company_id,
        ec.worker_id,
        ec.workplace_id,
        COALESCE(ec.is_telework, false),
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g'),
        COALESCE(REGEXP_REPLACE(w.pis_pasep, '[^0-9]', '', 'g'), '')
    INTO
        v_tenant_id,
        v_company_id,
        v_worker_id,
        v_workplace_id,
        v_is_telework,
        v_cpf,
        v_pis
    FROM public.employment_contracts ec
    JOIN public.workers w ON w.id = ec.worker_id
    JOIN public.people p ON p.id = w.person_id
    WHERE ec.id = p_contract_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Contrato de trabalho % não encontrado.', p_contract_id;
    END IF;

    -- 2. Extrair coordenadas do payload GPS
    IF p_geo IS NOT NULL THEN
        BEGIN
            v_user_lat := (p_geo->>'latitude')::NUMERIC;
            v_user_lon := (p_geo->>'longitude')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
            v_user_lat := NULL;
            v_user_lon := NULL;
        END;
    END IF;

    -- 3. Validação de Geofencing contra o Local de Trabalho
    IF v_is_telework THEN
        v_geofence_status := 'TELEWORK';
    ELSIF v_workplace_id IS NOT NULL THEN
        SELECT 
            wp.name,
            wp.latitude,
            wp.longitude,
            COALESCE(wp.radius_meters, 50),
            COALESCE(wp.enforce_geofence, false)
        INTO
            v_wp_name,
            v_wp_lat,
            v_wp_lon,
            v_wp_radius,
            v_wp_enforce
        FROM public.workplaces wp
        WHERE wp.id = v_workplace_id;

        IF v_wp_lat IS NOT NULL AND v_wp_lon IS NOT NULL THEN
            IF v_user_lat IS NOT NULL AND v_user_lon IS NOT NULL THEN
                v_distance_meters := calculate_haversine_distance_meters(v_wp_lat, v_wp_lon, v_user_lat, v_user_lon);
                
                IF v_distance_meters <= v_wp_radius THEN
                    v_geofence_status := 'INSIDE';
                ELSE
                    v_geofence_status := 'OUTSIDE';
                    IF v_wp_enforce THEN
                        RAISE EXCEPTION 'Registro bloqueado: você está a % metros de %, fora do raio autorizado de % metros.', 
                            ROUND(v_distance_meters), COALESCE(v_wp_name, 'Sede'), v_wp_radius;
                    END IF;
                END IF;
            ELSE
                v_geofence_status := 'NO_GPS';
                IF v_wp_enforce THEN
                    RAISE EXCEPTION 'Registro bloqueado: a empresa exige localização GPS ativa para marcação presencial em %.', 
                        COALESCE(v_wp_name, 'Sede');
                END IF;
            END IF;
        END IF;
    END IF;

    -- 4. Localizar ou instanciar o dispositivo REP_P_MOBILE da empresa
    SELECT id INTO v_device_id
    FROM public.time_devices
    WHERE tenant_id = v_tenant_id 
      AND company_id = v_company_id 
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

    -- 5. Obter próximo NSR sequencial de forma atômica
    UPDATE public.time_devices
    SET 
        last_nsr = last_nsr + 1,
        last_sync_at = v_punched_at
    WHERE id = v_device_id
    RETURNING last_nsr INTO v_nsr;

    -- 6. Gerar hash do comprovante se não fornecido
    IF p_receipt_code IS NULL OR p_receipt_code = '' THEN
        v_receipt_code := encode(digest(v_nsr::text || '|' || v_punched_at::text || '|' || v_cpf, 'sha256'), 'hex');
    ELSE
        v_receipt_code := p_receipt_code;
    END IF;

    -- 7. Inserir na trilha imutável (time_punch_records) com auditoria geodésica
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
        distance_meters,
        geofence_status,
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
        v_distance_meters,
        v_geofence_status,
        true
    ) RETURNING id INTO v_punch_id;

    -- 8. Espelhar na tabela de marcações de jornada (time_entries)
    INSERT INTO public.time_entries (
        tenant_id,
        contract_id,
        original_timestamp,
        entry_type,
        punch_record_id,
        device_info
    ) VALUES (
        v_tenant_id,
        p_contract_id,
        v_punched_at,
        p_entry_type,
        v_punch_id,
        p_device_fingerprint
    );

    RETURN QUERY SELECT 
        v_punch_id,
        v_device_id,
        v_nsr,
        v_punched_at,
        v_receipt_code;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.register_mobile_punch TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance_meters TO authenticated, anon;
