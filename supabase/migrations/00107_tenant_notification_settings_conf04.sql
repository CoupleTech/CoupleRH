-- ==============================================================================
-- Migration: 00107_tenant_notification_settings_conf04.sql
-- Descrição: Parametrização corporativa de gatilhos de alertas e canais de 
--            notificação do tenant (férias, fechamento de ponto, ASO, folha, 
--            inconsistências eSocial, canais e-mail, WhatsApp e in-app) - CONF-04.
-- ==============================================================================

-- 1. Estender tenant_settings com configurações de alertas e notificações corporativas
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS notify_vacation_warning BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vacation_warning_days INTEGER NOT NULL DEFAULT 30 
    CHECK (vacation_warning_days IN (15, 30, 45, 60)),
ADD COLUMN IF NOT EXISTS notify_timesheet_cutoff BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS timesheet_cutoff_warning_days INTEGER NOT NULL DEFAULT 3 
    CHECK (timesheet_cutoff_warning_days BETWEEN 1 AND 15),
ADD COLUMN IF NOT EXISTS notify_aso_expiration BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS aso_expiration_warning_days INTEGER NOT NULL DEFAULT 30 
    CHECK (aso_expiration_warning_days IN (15, 30, 45, 60)),
ADD COLUMN IF NOT EXISTS notify_salary_advances BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_payroll_divergences BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_esocial_inconsistencies BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS dp_notification_email TEXT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS dp_notification_phone TEXT NULL;

-- 2. Atualizar registros existentes com valores padrão seguros
UPDATE public.tenant_settings
SET 
    notify_vacation_warning = COALESCE(notify_vacation_warning, true),
    vacation_warning_days = COALESCE(vacation_warning_days, 30),
    notify_timesheet_cutoff = COALESCE(notify_timesheet_cutoff, true),
    timesheet_cutoff_warning_days = COALESCE(timesheet_cutoff_warning_days, 3),
    notify_aso_expiration = COALESCE(notify_aso_expiration, true),
    aso_expiration_warning_days = COALESCE(aso_expiration_warning_days, 30),
    notify_salary_advances = COALESCE(notify_salary_advances, true),
    notify_payroll_divergences = COALESCE(notify_payroll_divergences, true),
    notify_esocial_inconsistencies = COALESCE(notify_esocial_inconsistencies, true),
    in_app_notifications_enabled = COALESCE(in_app_notifications_enabled, true),
    email_notifications_enabled = COALESCE(email_notifications_enabled, true),
    whatsapp_notifications_enabled = COALESCE(whatsapp_notifications_enabled, false)
WHERE notify_vacation_warning IS NULL 
   OR vacation_warning_days IS NULL 
   OR notify_timesheet_cutoff IS NULL;

-- 3. RPC protegida para atualização de preferências de alertas e notificações
CREATE OR REPLACE FUNCTION public.update_tenant_notification_settings(
    p_notify_vacation_warning BOOLEAN,
    p_vacation_warning_days INTEGER,
    p_notify_timesheet_cutoff BOOLEAN,
    p_timesheet_cutoff_warning_days INTEGER,
    p_notify_aso_expiration BOOLEAN,
    p_aso_expiration_warning_days INTEGER,
    p_notify_salary_advances BOOLEAN,
    p_notify_payroll_divergences BOOLEAN,
    p_notify_esocial_inconsistencies BOOLEAN,
    p_in_app_notifications_enabled BOOLEAN,
    p_email_notifications_enabled BOOLEAN,
    p_dp_notification_email TEXT,
    p_whatsapp_notifications_enabled BOOLEAN,
    p_dp_notification_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_has_access BOOLEAN;
    v_clean_email TEXT;
    v_clean_phone TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_id ativo do chamador
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar que o usuário é administrador do tenant
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar configurações de notificações.' USING ERRCODE = '42501';
    END IF;

    -- Validação de limites numéricos
    IF p_vacation_warning_days NOT IN (15, 30, 45, 60) THEN
        RAISE EXCEPTION 'Antecedência de aviso de férias inválida: % dias.', p_vacation_warning_days USING ERRCODE = '22023';
    END IF;

    IF p_timesheet_cutoff_warning_days NOT BETWEEN 1 AND 15 THEN
        RAISE EXCEPTION 'Antecedência de fechamento do ponto deve estar entre 1 e 15 dias.' USING ERRCODE = '22023';
    END IF;

    IF p_aso_expiration_warning_days NOT IN (15, 30, 45, 60) THEN
        RAISE EXCEPTION 'Antecedência de vencimento de ASO inválida: % dias.', p_aso_expiration_warning_days USING ERRCODE = '22023';
    END IF;

    -- Sanitização e validação de e-mail corporativo
    v_clean_email := NULLIF(TRIM(p_dp_notification_email), '');
    IF v_clean_email IS NOT NULL AND v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'E-mail corporativo inválido: %', v_clean_email USING ERRCODE = '22023';
    END IF;

    -- Sanitização de telefone (apenas números ou caracteres válidos)
    v_clean_phone := NULLIF(TRIM(p_dp_notification_phone), '');

    -- Upsert atômico em tenant_settings
    INSERT INTO public.tenant_settings (
        tenant_id, 
        notify_vacation_warning,
        vacation_warning_days,
        notify_timesheet_cutoff,
        timesheet_cutoff_warning_days,
        notify_aso_expiration,
        aso_expiration_warning_days,
        notify_salary_advances,
        notify_payroll_divergences,
        notify_esocial_inconsistencies,
        in_app_notifications_enabled,
        email_notifications_enabled,
        dp_notification_email,
        whatsapp_notifications_enabled,
        dp_notification_phone,
        updated_at
    )
    VALUES (
        v_tenant_id, 
        p_notify_vacation_warning,
        p_vacation_warning_days,
        p_notify_timesheet_cutoff,
        p_timesheet_cutoff_warning_days,
        p_notify_aso_expiration,
        p_aso_expiration_warning_days,
        p_notify_salary_advances,
        p_notify_payroll_divergences,
        p_notify_esocial_inconsistencies,
        p_in_app_notifications_enabled,
        p_email_notifications_enabled,
        v_clean_email,
        p_whatsapp_notifications_enabled,
        v_clean_phone,
        NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        notify_vacation_warning = EXCLUDED.notify_vacation_warning,
        vacation_warning_days = EXCLUDED.vacation_warning_days,
        notify_timesheet_cutoff = EXCLUDED.notify_timesheet_cutoff,
        timesheet_cutoff_warning_days = EXCLUDED.timesheet_cutoff_warning_days,
        notify_aso_expiration = EXCLUDED.notify_aso_expiration,
        aso_expiration_warning_days = EXCLUDED.aso_expiration_warning_days,
        notify_salary_advances = EXCLUDED.notify_salary_advances,
        notify_payroll_divergences = EXCLUDED.notify_payroll_divergences,
        notify_esocial_inconsistencies = EXCLUDED.notify_esocial_inconsistencies,
        in_app_notifications_enabled = EXCLUDED.in_app_notifications_enabled,
        email_notifications_enabled = EXCLUDED.email_notifications_enabled,
        dp_notification_email = EXCLUDED.dp_notification_email,
        whatsapp_notifications_enabled = EXCLUDED.whatsapp_notifications_enabled,
        dp_notification_phone = EXCLUDED.dp_notification_phone,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', TRUE,
        'tenant_id', v_tenant_id,
        'notify_vacation_warning', p_notify_vacation_warning,
        'vacation_warning_days', p_vacation_warning_days,
        'notify_timesheet_cutoff', p_notify_timesheet_cutoff,
        'timesheet_cutoff_warning_days', p_timesheet_cutoff_warning_days,
        'notify_aso_expiration', p_notify_aso_expiration,
        'aso_expiration_warning_days', p_aso_expiration_warning_days,
        'notify_salary_advances', p_notify_salary_advances,
        'notify_payroll_divergences', p_notify_payroll_divergences,
        'notify_esocial_inconsistencies', p_notify_esocial_inconsistencies,
        'in_app_notifications_enabled', p_in_app_notifications_enabled,
        'email_notifications_enabled', p_email_notifications_enabled,
        'dp_notification_email', v_clean_email,
        'whatsapp_notifications_enabled', p_whatsapp_notifications_enabled,
        'dp_notification_phone', v_clean_phone
    );
END;
$$;

-- 4. Conceder permissão de execução aos autenticados
GRANT EXECUTE ON FUNCTION public.update_tenant_notification_settings(
    BOOLEAN, INTEGER, BOOLEAN, INTEGER, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT
) TO authenticated;
