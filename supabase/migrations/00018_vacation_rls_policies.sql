-- Adicionar políticas de gerenciamento que faltavam para as Férias

CREATE POLICY "Tenant Admins and DP can manage vacation vesting" 
    ON public.vacation_vesting_periods FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = vacation_vesting_periods.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage vacation requests" 
    ON public.vacation_requests FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = vacation_requests.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );
