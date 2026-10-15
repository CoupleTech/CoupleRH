-- Migration: 00078_time_punch_geofence_pt05.sql
-- Description: Suporte a Ponto por Celular/PWA (REP-P - Portaria 671 MTP)
-- Adiciona campos de geofence em workplaces, teletrabalho em contracts e RPC atômica register_mobile_punch.

-- 1. CAMPOS DE GEOFENCE EM WORKPLACES (LOCAIS DE TRABALHO)
ALTER TABLE public.workplaces
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 200,
    ADD COLUMN IF NOT EXISTS enforce_geofence BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workplaces.latitude IS 'Latitude do centro do perímetro do local de trabalho (formato decimal).';
COMMENT ON COLUMN public.workplaces.longitude IS 'Longitude do centro do perímetro do local de trabalho (formato decimal).';
COMMENT ON COLUMN public.workplaces.radius_meters IS 'Raio máximo permitido em metros para registro de ponto por aplicativo móvel.';
COMMENT ON COLUMN public.workplaces.enforce_geofence IS 'Se verdadeiro, bloqueia marcações de ponto fora do raio configurado.';

-- 2. CAMPOS DE TELETRABALHO E LOTAÇÃO EM CONTRATOS
ALTER TABLE public.employment_contracts
    ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_telework BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.is_telework IS 'Indica se o colaborador atua em regime de Teletrabalho / Home Office ou Trabalho Externo, dispensado de geofence fixo.';

-- 3. FUNÇÃO ATÔMICA PARA REGISTRO DE PONTO POR CELULAR (REP-P)
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
    v_cpf TEXT;
    v_pis TEXT;
    v_device_id UUID;
    v_nsr BIGINT;
    v_punched_at TIMESTAMPTZ := NOW(); -- HORA CONFIÁVEL CARIMBADA NO SERVIDOR
    v_punch_id UUID;
    v_receipt_code TEXT;
BEGIN
    -- 1. Buscar dados do contrato
    SELECT 
        ec.tenant_id,
        ec.company_id,
        ec.worker_id,
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g'),
        COALESCE(REGEXP_REPLACE(w.pis_pasep, '[^0-9]', '', 'g'), '')
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
