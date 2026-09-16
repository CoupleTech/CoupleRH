-- Corrige a ambiguidade da referência "public.people.tenant_id" nas políticas do PostgreSQL

DROP POLICY IF EXISTS "Tenant Admins and DP can manage people" ON public.people;
CREATE POLICY "Tenant Admins and DP can manage people" 
    ON public.people FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = people.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage workers" ON public.workers;
CREATE POLICY "Tenant Admins and DP can manage workers" 
    ON public.workers FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = workers.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage employment_contracts" ON public.employment_contracts;
CREATE POLICY "Tenant Admins and DP can manage employment_contracts" 
    ON public.employment_contracts FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = employment_contracts.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );
