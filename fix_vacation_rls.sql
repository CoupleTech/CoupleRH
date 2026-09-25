-- Script para corrigir as permissões (RLS) do módulo de Férias

DROP POLICY IF EXISTS "Tenant Admins and DP can manage vacation vesting" ON public.vacation_vesting_periods;
CREATE POLICY "Tenant Admins and DP can manage vacation vesting" 
    ON public.vacation_vesting_periods FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = vacation_vesting_periods.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage vacation requests" ON public.vacation_requests;
CREATE POLICY "Tenant Admins and DP can manage vacation requests" 
    ON public.vacation_requests FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = vacation_requests.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );
