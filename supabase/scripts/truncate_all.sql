-- ATENÇÃO: Este script apagará TODOS os dados das tabelas transacionais do sistema coupleRH.
-- Ele usa CASCADE, então as tabelas dependentes também serão esvaziadas.
-- Tabelas de sistema (como schema_migrations) ou de outros sistemas NÃO serão afetadas.

DO $$ 
DECLARE 
    t text;
    tables_to_truncate text[] := ARRAY[
        'benefit_catalogs',
        'benefits_catalog',
        'collective_agreements',
        'companies',
        'data_retention_policies',
        'departments',
        'dependents',
        'document_templates',
        'employee_benefits',
        'employee_documents',
        'employee_fixed_events',
        'employee_scales',
        'employment_contract_history',
        'employment_contracts',
        'esocial_transmissions',
        'establishments',
        'leaves',
        'lgpd_consents',
        'medias_rescisorias',
        'notifications',
        'onboarding_documents',
        'onboarding_processes',
        'payroll_company_taxes',
        'payroll_events',
        'payroll_fixed_events',
        'payroll_memory_calc',
        'payroll_periods',
        'payroll_progressive_tables',
        'payroll_rubrics',
        'payroll_tax_reductions',
        'payroll_tax_tables',
        'payroll_variable_events',
        'payslip_items',
        'payslips',
        'people',
        'permissions',
        'positions',
        'role_permissions',
        'roles',
        'salary_adjustments',
        'signatures_log',
        'sst_health_exams',
        'sst_risks',
        'sst_work_environments',
        'terminations',
        'time_bank_accounts',
        'time_bank_transactions',
        'time_entries',
        'time_entry_adjustments',
        'timesheets',
        'unions',
        'vacation_requests',
        'vacation_vesting_periods',
        'work_schedules',
        'worker_personal_documents',
        'workers'
    ];
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename = ANY(tables_to_truncate)
    LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(t) || ' CASCADE;';
    END LOOP;
END $$;

-- BLOCO DE RECUPERAÇÃO: 
-- Como o script anterior apagou o tenant, este bloco vai recriar o seu "Workspace" 
-- e te dar permissão novamente, consertando o erro 406.
DO $$
DECLARE
  orphan_user RECORD;
  new_tenant_id UUID;
BEGIN
  FOR orphan_user IN 
    SELECT u.id, u.email 
    FROM auth.users u 
    LEFT JOIN public.tenant_users tu ON u.id = tu.user_id 
    WHERE tu.id IS NULL
  LOOP
    -- Cria um novo tenant
    INSERT INTO public.tenants (name)
    VALUES ('Workspace de ' || COALESCE(orphan_user.email, 'Usuário'))
    RETURNING id INTO new_tenant_id;

    -- Associa o usuário ao novo tenant
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (new_tenant_id, orphan_user.id, 'system_admin');
    
    -- Recria o user_profile base
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (orphan_user.id, orphan_user.email, COALESCE(orphan_user.email, 'Usuário'))
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;

