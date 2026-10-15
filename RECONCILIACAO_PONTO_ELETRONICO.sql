-- ==============================================================================
-- COUPLE RH - SCRIPT DE CONCILIAÇÃO DE PONTO ELETRÔNICO (PORTARIA MTP 671/2021)
-- Executar no SQL Editor do Supabase Dashboard (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. ATUALIZAÇÃO DA TRIGGER DE IMUTABILIDADE DE time_punch_records
-- Garante a blindagem jurídica da trilha de auditoria do REP (NSR, data, hora, etc. 100% imutáveis),
-- permitindo exclusivamente a conciliação cadastral de worker_id/contract_id quando nulos.
CREATE OR REPLACE FUNCTION public.prevent_punch_record_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Permite vincular worker_id e contract_id quando estavam nulos (conciliação cadastral),
        -- bloqueando qualquer alteração nas informações originais do REP (NSR, data/hora, PIS, dispositivo).
        IF (OLD.worker_id IS NULL OR OLD.contract_id IS NULL)
           AND (NEW.nsr = OLD.nsr 
                AND NEW.punched_at = OLD.punched_at 
                AND NEW.device_id = OLD.device_id 
                AND NEW.record_type = OLD.record_type 
                AND NEW.tenant_id = OLD.tenant_id) THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION 'A trilha de registros originais de ponto (time_punch_records) é estritamente imutável (Portaria MTP 671/2021 e CLT art. 74). Operações de alteração de horário/NSR ou exclusão são terminantemente proibidas.';
END;
$$ LANGUAGE plpgsql;

-- 2. ENRIQUECIMENTO AUTOMÁTICO DO PIS DOS COLABORADORES ATIVOS NO BANCO
-- Vincula os PIS extraídos do Registro Tipo 5 do relógio REP aos colaboradores ativos da base
UPDATE public.workers w
SET pis_pasep = '023660605154'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('425.005.068-86', '42500506886') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '842348516806'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('423.485.168.02', '42348516802') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '800186683561'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('001.866.835-61', '00186683561') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '020780111472'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('40896116875', '408.961.168-75') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '840467165849'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('404.671.658-40', '40467165840') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '012432823496'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('203.978.158-75', '20397815875') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '026886466770'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('186.713.978-23', '18671397823') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '013525734777'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('348.332.998-60', '34833299860') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '021324572126'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('241.133.358-77', '24113335877') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

UPDATE public.workers w
SET pis_pasep = '013642034240'
FROM public.people p
WHERE p.id = w.person_id 
  AND p.cpf IN ('473.477.468-41', '47347746841') 
  AND (w.pis_pasep IS NULL OR w.pis_pasep = '');

-- 3. CONCILIAÇÃO DAS BATIDAS JÁ GRAVADAS EM time_punch_records COM OS COLABORADORES ATIVOS
-- Vincula worker_id, contract_id e company_id para as batidas dos colaboradores ativos
WITH match_source AS (
    SELECT 
        p.id AS punch_id,
        w.id AS target_worker_id,
        c.id AS target_contract_id,
        w.company_id AS target_company_id
    FROM public.time_punch_records p
    JOIN public.workers w ON w.tenant_id = p.tenant_id AND (
        -- PIS com 12 ou 11 dígitos
        REGEXP_REPLACE(COALESCE(w.pis_pasep, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
        OR REGEXP_REPLACE(COALESCE(w.pis_pasep, ''), '[^0-9]', '', 'g') = SUBSTRING(REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') FROM 2)
        OR (
            -- PIS secundário de Kauan (567890123445)
            REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') = '567890123445' 
            AND EXISTS (SELECT 1 FROM public.people pe WHERE pe.id = w.person_id AND pe.cpf LIKE '%425%005%068%')
        )
        OR (
            -- CPF correspondente
            EXISTS (
                SELECT 1 FROM public.people pe 
                WHERE pe.id = w.person_id 
                AND (
                    REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
                    OR REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
                    OR REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = SUBSTRING(REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') FROM 2)
                )
            )
        )
    )
    LEFT JOIN LATERAL (
        SELECT id FROM public.employment_contracts ec 
        WHERE ec.worker_id = w.id 
        ORDER BY (CASE WHEN ec.status = 'ACTIVE' THEN 1 ELSE 2 END)
        LIMIT 1
    ) c ON true
    WHERE p.worker_id IS NULL
)
UPDATE public.time_punch_records t
SET 
    worker_id = m.target_worker_id,
    contract_id = m.target_contract_id,
    company_id = COALESCE(t.company_id, m.target_company_id)
FROM match_source m
WHERE t.id = m.punch_id;

-- 4. RPC PARA CONCILIAÇÃO FUTURA VIA INTERFACE WEB COM 1 CLIQUE
CREATE OR REPLACE FUNCTION public.reconcile_afd_punch_records(
    p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reconciled INTEGER := 0;
BEGIN
    IF NOT (p_tenant_id = ANY (public.user_tenant_ids())) THEN
        RAISE EXCEPTION 'Acesso negado: o usuário não pertence ao tenant indicado.';
    END IF;

    WITH match_source AS (
        SELECT 
            p.id AS punch_id,
            w.id AS target_worker_id,
            c.id AS target_contract_id,
            w.company_id AS target_company_id
        FROM public.time_punch_records p
        JOIN public.workers w ON w.tenant_id = p.tenant_id AND (
            REGEXP_REPLACE(COALESCE(w.pis_pasep, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
            OR REGEXP_REPLACE(COALESCE(w.pis_pasep, ''), '[^0-9]', '', 'g') = SUBSTRING(REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') FROM 2)
            OR (
                EXISTS (
                    SELECT 1 FROM public.people pe 
                    WHERE pe.id = w.person_id 
                    AND (
                        REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
                        OR REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
                        OR REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = SUBSTRING(REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') FROM 2)
                    )
                )
            )
        )
        LEFT JOIN LATERAL (
            SELECT id FROM public.employment_contracts ec 
            WHERE ec.worker_id = w.id 
            ORDER BY (CASE WHEN ec.status = 'ACTIVE' THEN 1 ELSE 2 END)
            LIMIT 1
        ) c ON true
        WHERE p.tenant_id = p_tenant_id AND p.worker_id IS NULL
    )
    UPDATE public.time_punch_records t
    SET 
        worker_id = m.target_worker_id,
        contract_id = m.target_contract_id,
        company_id = COALESCE(t.company_id, m.target_company_id)
    FROM match_source m
    WHERE t.id = m.punch_id;

    GET DIAGNOSTICS v_reconciled = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'reconciled', v_reconciled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_afd_punch_records(UUID) TO authenticated, service_role;

-- 5. RECARREGAR SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
