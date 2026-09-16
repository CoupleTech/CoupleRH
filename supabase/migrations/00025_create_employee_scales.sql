-- Migration: 00025_create_employee_scales
-- Description: Criação da tabela de escalas para relacionar empregados às jornadas e ciclos de trabalho.

CREATE TABLE public.employee_scales (
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
CREATE TRIGGER audit_employee_scales_trigger 
AFTER INSERT OR UPDATE OR DELETE ON public.employee_scales 
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
