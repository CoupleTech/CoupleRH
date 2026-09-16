-- Migration: 00007_leaves_benefits_time_schema
-- Description: Afastamentos (Licenças), Benefícios, Comunicação e Ponto Base

-- 1. Afastamentos e Licenças Médicas (Leaves)
CREATE TABLE public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    
    -- Sigilo Médico
    icd_10_code TEXT, -- CID 10 (Restrito a RH/Médico via RLS ou Encriptação no Front)
    medical_certificate_url TEXT, -- Link para o atestado (Supabase Storage)
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false, -- Se passou de 15 dias (Auxílio-Doença)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Benefícios (Catálogo e Vínculo)
CREATE TABLE public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2), -- Ex: 6% para VT
    employee_discount_fixed NUMERIC(10,2),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    
    opt_in BOOLEAN NOT NULL DEFAULT true, -- Empregado pode recusar (ex: recusar VT)
    custom_discount_value NUMERIC(10,2), -- Se houver coparticipação diferenciada
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(contract_id, benefit_catalog_id)
);

-- 3. Comunicação (Notificações)
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- auth.uid() do destinatário
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('ALERT', 'TASK', 'MESSAGE', 'SYSTEM')),
    
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ponto e Jornada (Base Inicial)
CREATE TABLE public.work_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('FIXED', 'FLEXIBLE', 'SHIFT_12X36', 'SCALE')),
    
    -- Exemplo simples para horários fixos
    monday_in TIME, monday_out TIME,
    tuesday_in TIME, tuesday_out TIME,
    wednesday_in TIME, wednesday_out TIME,
    thursday_in TIME, thursday_out TIME,
    friday_in TIME, friday_out TIME,
    saturday_in TIME, saturday_out TIME,
    sunday_in TIME, sunday_out TIME,
    
    weekly_hours NUMERIC(4,2) NOT NULL DEFAULT 44.00,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employment_contracts ADD COLUMN work_schedule_id UUID REFERENCES public.work_schedules(id);

-- RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leaves" ON public.leaves FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view benefits" ON public.benefit_catalogs FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view employee benefits" ON public.employee_benefits FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view work schedules" ON public.work_schedules FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Tenant Admins and DP can manage leaves" ON public.leaves FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = leaves.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage benefits" ON public.benefit_catalogs FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = benefit_catalogs.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage employee benefits" ON public.employee_benefits FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = employee_benefits.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage work schedules" ON public.work_schedules FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = work_schedules.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));

-- Triggers Auditoria
CREATE TRIGGER audit_leaves_trigger AFTER INSERT OR UPDATE OR DELETE ON public.leaves FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_employee_benefits_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_work_schedules_trigger AFTER INSERT OR UPDATE OR DELETE ON public.work_schedules FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
