-- Migration: 00002_audit_engine
-- Description: Criação da engine de auditoria inalterável baseada em triggers.

CREATE SCHEMA IF NOT EXISTS audit;

-- Tabela de logs (Somente leitura para usuários comuns, append-only)
CREATE TABLE audit.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID, -- Pode ser null se for operação de sistema
    actor_id UUID NOT NULL, -- auth.uid()
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT
);

-- Ativar RLS para impedir modificações
ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ler logs do seu tenant (se forem administradores/auditores)
CREATE POLICY "Auditors can read tenant logs" 
    ON audit.logs FOR SELECT 
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = audit.logs.tenant_id 
            AND role IN ('tenant_admin', 'auditor')
        )
    );

-- Ninguém tem permissão para fazer INSERT manual (exceto o próprio banco/trigger)
-- DELETE e UPDATE também não têm policies (negados por padrão)

-- Função genérica de trigger para gravar auditoria
CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
BEGIN
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
        new_values
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID), -- UUID zero se for rotina do sistema
        TG_OP,
        TG_TABLE_NAME::TEXT,
        COALESCE((v_new->>'id'), (v_old->>'id'), 'unknown'),
        v_old,
        v_new
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anexar o trigger às tabelas essenciais (como exemplo)
CREATE TRIGGER audit_companies_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_employees_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.establishments
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
