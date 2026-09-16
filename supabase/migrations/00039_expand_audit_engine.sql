-- Migration: 00039_expand_audit_engine
-- Description: Extensão da engine de auditoria para capturar motivo, versão do motor e expor logs via view.

-- 1. Adicionar colunas em audit.logs
ALTER TABLE audit.logs 
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS engine_version TEXT;

-- 2. Atualizar a função de trigger para injetar as sessões
CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
    v_reason TEXT;
    v_engine TEXT;
BEGIN
    -- Capturar motivo e engine injetados via set_config, se existirem
    BEGIN
        v_reason := current_setting('app.audit_reason', true);
    EXCEPTION WHEN OTHERS THEN
        v_reason := NULL;
    END;

    BEGIN
        v_engine := current_setting('app.engine_version', true);
    EXCEPTION WHEN OTHERS THEN
        v_engine := NULL;
    END;

    -- Capturar o tenant_id da linha modificada, se existir
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        BEGIN
            current_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
    ELSE
        v_new := to_jsonb(NEW);
        BEGIN
            current_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
        
        IF TG_OP = 'UPDATE' THEN
            v_old := to_jsonb(OLD);
            -- Não auditar se nada mudou de fato
            IF v_old = v_new THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    -- Inserir o log com SYSTEM_USER (bypass RLS)
    INSERT INTO audit.logs (
        tenant_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        reason,
        engine_version
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
        TG_OP,
        TG_TABLE_NAME::TEXT,
        COALESCE((v_new->>'id'), (v_old->>'id'), 'unknown'),
        v_old,
        v_new,
        v_reason,
        v_engine
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar a view exposta publicamente para consumir no Frontend via PostgREST
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
    id,
    timestamp,
    tenant_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    reason,
    engine_version
FROM audit.logs;

-- Atribuir grants na View
GRANT SELECT ON public.audit_logs_view TO authenticated, anon;

-- 4. Anexar trigger de auditoria nas tabelas solicitadas (apenas se não existirem ainda)

DO $$
BEGIN
    -- payroll_rubrics
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_rubrics_trigger') THEN
        CREATE TRIGGER audit_payroll_rubrics_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- employment_contracts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employment_contracts_trigger') THEN
        CREATE TRIGGER audit_employment_contracts_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employment_contracts
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- salary_adjustments
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_salary_adjustments_trigger') THEN
        CREATE TRIGGER audit_salary_adjustments_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.salary_adjustments
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- payroll_variable_events
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_variable_events_trigger') THEN
        CREATE TRIGGER audit_payroll_variable_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- employee_fixed_events
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_fixed_events_trigger') THEN
        CREATE TRIGGER audit_employee_fixed_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- payroll_periods
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_periods_trigger') THEN
        CREATE TRIGGER audit_payroll_periods_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;
