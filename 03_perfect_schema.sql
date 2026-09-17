-- ==========================================
-- TABLES
-- ==========================================

CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Tenant Users (Associação de usuários aos tenants com papéis);

CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    corporate_name TEXT NOT NULL,
    trade_name TEXT,
    cnpj TEXT NOT NULL,
    legal_nature TEXT,
    primary_cnae TEXT,
    tax_regime TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    fiscal_config JSONB DEFAULT '{}'::jsonb,
    labor_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cnpj)
);

-- 4. Establishments (Estabelecimentos / Filiais - CNPJ completo);

CREATE TABLE public.establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cnpj)
);

-- 5. Departments (Departamentos / Centros de Custo);

CREATE TABLE public.people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    social_name TEXT,
    cpf TEXT NOT NULL,
    rg TEXT,
    birth_date DATE,
    gender TEXT,
    zip_code TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Brasil',
    reference_point TEXT,
    residence_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cpf)
);

-- 2. Workers (O registro geral do indivíduo no Tenant/Empresa para fins de eSocial);

CREATE TABLE public.workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
    esocial_matricula TEXT,
    pis_pasep TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(company_id, person_id)
);

-- 3. Employment Contracts (Vínculos Contratuais);

CREATE TABLE public.employment_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    establishment_id UUID REFERENCES public.establishments(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE RESTRICT,
    work_schedule_id UUID REFERENCES public.work_schedules(id) ON DELETE RESTRICT,
    contract_type_id UUID REFERENCES public.contract_types(id) ON DELETE RESTRICT,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    admission_date DATE NOT NULL,
    resignation_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'VACATION')),
    base_salary NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    transportation_tickets_per_day INTEGER DEFAULT 0,
    opts_for_transportation_voucher BOOLEAN DEFAULT false,
    vt_operator TEXT,
    vt_card_number TEXT,
    vt_tariff_value NUMERIC(10,2),
    vt_discount_percentage NUMERIC(5,2) DEFAULT 6.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. Bank Accounts (Dados Bancários do Empregado);

CREATE TABLE public.dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf TEXT,
    birth_date DATE NOT NULL,
    relationship TEXT NOT NULL CHECK (relationship IN ('FILHO', 'CONJUGE', 'ENTEADO', 'PAI_MAE', 'OUTRO')),
    start_date DATE NOT NULL,
    end_date DATE,
    is_irrf_dependent BOOLEAN NOT NULL DEFAULT false,
    is_family_allowance_dependent BOOLEAN NOT NULL DEFAULT false,
    has_disability BOOLEAN NOT NULL DEFAULT false,
    birth_certificate_number TEXT,
    vaccination_card_date DATE,
    school_frequency_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ativar RLS em todas as tabelas;

CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    bank_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    agency TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'CHECKING' CHECK (account_type IN ('CHECKING', 'SAVINGS', 'SALARY')),
    pix_key TEXT,
    is_main BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Contract History Tables (Histórico com Vigência)
-- 5.1 Salary History;

CREATE TABLE public.tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK logicamente para auth.users(id)
    role TEXT NOT NULL CHECK (role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'employee', 'sst_specialist', 'auditor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- 3. Companies (Empresas - CNPJ raiz);

CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT,
    cost_center_code TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. Sectors (Setores);

CREATE TABLE public.sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. Cost Centers (Centros de Custo);

CREATE TABLE public.cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 8. Positions (Cargos);

CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    cbo TEXT,
    description TEXT,
    level TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 9. Workplaces (Lotações / Locais de Trabalho);

CREATE TABLE public.workplaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. Work Schedules (Jornadas e Horários);

CREATE TABLE public.work_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    weekly_hours NUMERIC(5,2) NOT NULL,
    monthly_hours NUMERIC(5,2) NOT NULL DEFAULT 220,
    standard_tolerance INTEGER NOT NULL DEFAULT 10,
    divisor INTEGER NOT NULL DEFAULT 220,
    shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 11. Holidays (Feriados);

CREATE TABLE public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'EMPRESA')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 12. Contract Types (Tipos de Contrato);

CREATE TABLE public.contract_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('CLT', 'ESTAGIO', 'APRENDIZ', 'TEMPORARIO', 'PJ', 'OUTROS')),
    term_type TEXT NOT NULL CHECK (term_type IN ('DETERMINADO', 'INDETERMINADO')),
    default_days INTEGER,
    has_fgts BOOLEAN NOT NULL DEFAULT true,
    has_13th BOOLEAN NOT NULL DEFAULT true,
    has_vacation BOOLEAN NOT NULL DEFAULT true,
    has_inss BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
-- 13. Dependents (Dependentes);

CREATE TABLE audit.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID,
    actor_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT
);;

CREATE TABLE public.contract_salary_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    base_salary NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.2 Position History;

CREATE TABLE public.contract_position_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.3 Department/Sector History;

CREATE TABLE public.contract_department_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.onboarding_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    candidate_name TEXT NOT NULL,
    candidate_cpf TEXT,
    candidate_email TEXT,
    department_id UUID REFERENCES public.departments(id),
    position_id UUID REFERENCES public.positions(id),
    proposed_salary NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_DOCS', 'PENDING_ASO', 'DP_REVIEW', 'ESOCIAL_READY', 'CONCLUDED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Documentos de Admissão (GED);

CREATE TABLE public.onboarding_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    onboarding_process_id UUID NOT NULL REFERENCES public.onboarding_processes(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'TITULO_ELEITOR', 'ASO', 'OUTROS')),
    file_url TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dependentes;

CREATE TABLE public.document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content_body TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('CONTRACT', 'POLICY', 'AGREEMENT', 'OTHER')),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);;

CREATE TABLE public.employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    document_template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    document_hash TEXT,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE' CHECK (status IN ('PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'CANCELED')),
    requires_employee_signature BOOLEAN NOT NULL DEFAULT true,
    requires_employer_signature BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);;

CREATE TABLE public.signatures_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    signer_user_id UUID NOT NULL,
    signer_role TEXT NOT NULL CHECK (signer_role IN ('EMPLOYEE', 'EMPLOYER', 'WITNESS')),
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    signature_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    document_hash_at_signing TEXT NOT NULL,
    UNIQUE(employee_document_id, signer_user_id)
);;

CREATE TABLE public.unions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cnpj TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    base_city TEXT,
    base_state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.collective_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    union_id UUID NOT NULL REFERENCES public.unions(id) ON DELETE RESTRICT,
    agreement_type TEXT NOT NULL CHECK (agreement_type IN ('CCT', 'ACT')),
    validity_start DATE NOT NULL,
    validity_end DATE NOT NULL,
    base_salary_floor NUMERIC(10,2),
    overtime_percentage_1 NUMERIC(5,2) DEFAULT 50.00,
    overtime_percentage_2 NUMERIC(5,2) DEFAULT 100.00,
    night_shift_premium NUMERIC(5,2) DEFAULT 20.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.vacation_vesting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    concessive_start_date DATE NOT NULL,
    concessive_end_date DATE NOT NULL,
    earned_days NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    taken_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    lost_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACQUIRED', 'PARTIALLY_TAKEN', 'COMPLETED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.vacation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vesting_period_id UUID NOT NULL REFERENCES public.vacation_vesting_periods(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_taken INTEGER NOT NULL,
    cash_allowance_days INTEGER NOT NULL DEFAULT 0,
    advance_13th_salary BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED_MANAGER', 'APPROVED_DP', 'PAID', 'TAKEN', 'CANCELED')),
    approved_by_manager UUID,
    approved_by_dp UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);;

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('ALERT', 'TASK', 'MESSAGE', 'SYSTEM')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    original_timestamp TIMESTAMPTZ NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
    device_info TEXT,
    adjusted_timestamp TIMESTAMPTZ,
    is_manual_adjustment BOOLEAN NOT NULL DEFAULT false,
    adjustment_reason TEXT,
    adjusted_by UUID,
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.time_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    balance_minutes INTEGER NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'PAID_OUT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.time_bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.time_bank_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    minutes INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('OVERTIME', 'DELAY', 'ABSENCE', 'COMPENSATION_DAY_OFF', 'MANUAL_ADJUSTMENT')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_worked_minutes INTEGER NOT NULL DEFAULT 0,
    total_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    total_night_shift_minutes INTEGER NOT NULL DEFAULT 0,
    total_missing_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED')),
    employee_signature_id UUID REFERENCES public.signatures_log(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
    competence_year INTEGER NOT NULL,
    payroll_type TEXT NOT NULL CHECK (payroll_type IN ('MONTHLY', 'ADVANCE', 'THIRTEENTH_1', 'THIRTEENTH_2', 'PROFIT_SHARING')),
    payment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PROCESSING', 'CONFERENCE', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, competence_month, competence_year, payroll_type)
);;

CREATE TABLE public.payroll_rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    esocial_code TEXT,
    rubric_type TEXT NOT NULL CHECK (rubric_type IN ('EARNING', 'DEDUCTION', 'NEUTRAL')),
    incidence_inss BOOLEAN NOT NULL DEFAULT false,
    incidence_fgts BOOLEAN NOT NULL DEFAULT false,
    incidence_irrf BOOLEAN NOT NULL DEFAULT false,
    calculation_rule_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);;

CREATE TABLE public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);;

CREATE TABLE public.esocial_transmissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('S-1000', 'S-1010', 'S-2200', 'S-2205', 'S-2206', 'S-2210', 'S-2220', 'S-2230', 'S-2240', 'S-2299', 'S-1200', 'S-1210', 'OTHER')),
    reference_id UUID,
    xml_payload TEXT NOT NULL,
    receipt_number TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUEUED', 'PROCESSING', 'ACCEPTED', 'REJECTED')),
    error_message TEXT,
    transmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.sst_work_environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    location_type TEXT NOT NULL CHECK (location_type IN ('OWN_ESTABLISHMENT', 'THIRD_PARTY', 'EXTERNAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.sst_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    esocial_code TEXT NOT NULL,
    name TEXT NOT NULL,
    risk_type TEXT NOT NULL CHECK (risk_type IN ('PHYSICAL', 'CHEMICAL', 'BIOLOGICAL', 'ERGONOMIC', 'ACCIDENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.sst_health_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('ADMISSIONAL', 'PERIODIC', 'RETURN_TO_WORK', 'CHANGE_OF_RISK', 'DEMISSIONAL')),
    exam_date DATE NOT NULL,
    doctor_crm TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('FIT', 'UNFIT')),
    certificate_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.employment_contract_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    salary_amount NUMERIC(10, 2) NOT NULL,
    job_title TEXT NOT NULL,
    work_schedule_id UUID,
    union_id UUID,
    cost_center TEXT,
    change_reason TEXT NOT NULL,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.time_entry_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    requested_timestamp TIMESTAMPTZ NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
    adjustment_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    requested_by UUID NOT NULL,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.lgpd_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    data_category TEXT NOT NULL,
    processing_purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('CONSENT', 'LEGAL_OBLIGATION', 'CONTRACT_EXECUTION', 'LEGITIMATE_INTEREST')),
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address TEXT,
    device_info TEXT
);;

CREATE TABLE public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    data_domain TEXT NOT NULL,
    retention_period_months INTEGER NOT NULL,
    legal_justification TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;

CREATE TABLE public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Políticas de RLS omitidas para brevidade, mas devem usar user_tenant_ids() 



-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo);

CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF;

CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc);

CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada);

CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados);

CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo);

CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência);

CREATE TABLE public.employee_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    work_schedule_id UUID NOT NULL REFERENCES public.work_schedules(id) ON DELETE RESTRICT,
    
    cycle_type TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (cycle_type IN ('WEEKLY', '12X36', '24X48', 'CUSTOM')),
    
    worked_days INTEGER,
    free_days INTEGER,
    
    weekly_schedule JSONB,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS e criar Políticas;

CREATE TABLE public.employee_fixed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id),
    
    value NUMERIC(10,2),
    quantity NUMERIC(10,2) DEFAULT 1,
    
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Impede duplicidade de rubricas ativas para o mesmo contrato;

-- ==========================================
-- POLICIES, TRIGGERS, CONSTRAINTS & INSERTS
-- ==========================================

-- 1. Tenants (As contas principais do SaaS);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

-- Security Definer Function;

CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies;

CREATE POLICY "Users can view their tenants" 
    ON public.tenants FOR SELECT USING (id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view tenant_users in their tenants" 
    ON public.tenant_users FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view companies in their tenants" 
    ON public.companies FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage companies" 
    ON public.companies FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = public.companies.tenant_id 
            AND role IN ('tenant_admin', 'dp_analyst')
        )
    );

CREATE POLICY "Users can view establishments in their tenants" 
    ON public.establishments FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage establishments" 
    ON public.establishments FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view departments in their tenants" 
    ON public.departments FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage departments" 
    ON public.departments FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view sectors in their tenants" 
    ON public.sectors FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage sectors" 
    ON public.sectors FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view cost centers in their tenants" 
    ON public.cost_centers FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage cost centers" 
    ON public.cost_centers FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view positions in their tenants" 
    ON public.positions FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage positions" 
    ON public.positions FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view workplaces in their tenants" 
    ON public.workplaces FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage workplaces" 
    ON public.workplaces FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view work schedules in their tenants" 
    ON public.work_schedules FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage work schedules" 
    ON public.work_schedules FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view holidays in their tenants" 
    ON public.holidays FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage holidays" 
    ON public.holidays FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view contract types in their tenants" 
    ON public.contract_types FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage contract types" 
    ON public.contract_types FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE SCHEMA IF NOT EXISTS audit;

-- Tabela de logs (Somente leitura, append-only);

ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;

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

-- Função genérica de trigger;

CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
BEGIN
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
            IF v_old = v_new THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    INSERT INTO audit.logs (
        tenant_id, actor_id, action, entity_type, entity_id, old_values, new_values
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
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

-- Anexar trigger;

CREATE TRIGGER audit_companies_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_establishments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.establishments
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();



-- 1. People (Pessoas Físicas Civis);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contract_salary_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contract_position_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contract_department_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view people in their tenants"  
    ON public.people FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view workers in their tenants" 
    ON public.workers FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view employment_contracts in their tenants" 
    ON public.employment_contracts FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage people" 
    ON public.people FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_users.tenant_id = people.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage workers" 
    ON public.workers FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_users.tenant_id = workers.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage employment_contracts" 
    ON public.employment_contracts FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_users.tenant_id = employment_contracts.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Users can view bank_accounts in their tenants" 
    ON public.bank_accounts FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage bank_accounts" 
    ON public.bank_accounts FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view history tables in their tenants" 
    ON public.contract_salary_history FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view position history in their tenants" 
    ON public.contract_position_history FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view department history in their tenants" 
    ON public.contract_department_history FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage history tables" 
    ON public.contract_salary_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage position history" 
    ON public.contract_position_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage department history" 
    ON public.contract_department_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_people_trigger AFTER INSERT OR UPDATE OR DELETE ON public.people FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_workers_trigger AFTER INSERT OR UPDATE OR DELETE ON public.workers FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_contracts_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employment_contracts FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();



-- Migration: 00026_payroll_overtime_rubrics
-- Description: Cria rubricas padrões de Horas Extras e DSR para todos os tenants.

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Hora Extra 50%
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '150', 'Hora Extra 50%', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 1.5,
            true, true, true, true, true, true
        ) ON CONFLICT DO NOTHING;

        -- Hora Extra 100%
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '160', 'Hora Extra 100%', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 2.0,
            true, true, true, true, true, true
        ) ON CONFLICT DO NOTHING;

        -- DSR sobre Horas Extras
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, formula, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '170', 'DSR sobre Horas Extras', 'EARNING', 'OVERTIME', 'FORMULA', 'FORMULA', '(BASE_DSR / DIAS_UTEIS) * DIAS_INUTEIS',
            true, true, true, true, true, true
        ) ON CONFLICT DO NOTHING;
        
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';



-- Migration: 00027_seed_standard_payroll_rubrics
-- Description: Saneamento do banco e injeção de rubricas oficiais para funcionamento pleno do Motor.

DO $$ 
DECLARE
    tenant RECORD;
    v_rubric_vt UUID;
    v_rubric_vr UUID;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. SALÁRIO BASE (Cód 101)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '101' OR name ILIKE 'Salário Base');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '101', 'Salário Base', 'EARNING', 'SALARY', 'FIXED', 'FIXO', 'SALARIO_BASE', 
            true, true, true, true, true, true
        );

        -- 2. INSS AUTOMÁTICO (Cód 901)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '901' OR code = 'INSS_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '901', 'Contribuição INSS', 'DEDUCTION', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 3. IRRF AUTOMÁTICO (Cód 902)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '902' OR code = 'IRRF_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '902', 'IRRF Mensal', 'DEDUCTION', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 4. FGTS AUTOMÁTICO (Cód 903)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '903' OR code = 'FGTS_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '903', 'FGTS Mensal (Depósito)', 'BASE', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 5. VALE TRANSPORTE (Cód 201)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '201' OR name ILIKE 'Vale Transporte');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '201', 'Vale Transporte', 'DEDUCTION', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL, 
            false, false, false, false, false, false
        ) RETURNING id INTO v_rubric_vt;

        -- 6. VALE REFEIÇÃO / ALIMENTAÇÃO (Cód 202)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '202';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '202', 'Vale Refeição / Alimentação', 'DEDUCTION', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL, 
            false, false, false, false, false, false
        ) RETURNING id INTO v_rubric_vr;

        -- 7. VINCULAÇÃO NO CATÁLOGO DE BENEFÍCIOS
        -- Atualiza catálogo de VT para amarrar à rubrica correta
        UPDATE public.benefits_catalog 
        SET rubric_id = v_rubric_vt, discount_type = 'PERCENTAGE', default_discount_value = 6
        WHERE tenant_id = tenant.id AND (benefit_type = 'VT' OR name ILIKE 'Vale Transporte');

        -- Atualiza catálogo de VR para amarrar à rubrica correta
        UPDATE public.benefits_catalog 
        SET rubric_id = v_rubric_vr, discount_type = 'FIXED_VALUE'
        WHERE tenant_id = tenant.id AND (benefit_type = 'VR' OR name ILIKE 'Vale Refeição');

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';



-- 1. Processos de Onboarding (Máquina de Estados);

ALTER TABLE public.onboarding_processes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view onboarding in their tenants" ON public.onboarding_processes FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view onboarding docs in their tenants" ON public.onboarding_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view dependents in their tenants" ON public.dependents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage onboarding" ON public.onboarding_processes FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.onboarding_processes.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage onboarding docs" ON public.onboarding_documents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.onboarding_documents.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage dependents" ON public.dependents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.dependents.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE TRIGGER audit_onboarding_processes_trigger AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_processes FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_onboarding_documents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_documents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_dependents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.dependents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.signatures_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their tenants" ON public.document_templates FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view employee documents in their tenants" ON public.employee_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view signature logs in their tenants" ON public.signatures_log FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage templates" ON public.document_templates FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.document_templates.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage employee documents" ON public.employee_documents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.employee_documents.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "System generates signature logs" ON public.signatures_log FOR INSERT WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_templates_trigger AFTER INSERT OR UPDATE OR DELETE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_employee_docs_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.employment_contracts ADD COLUMN union_id UUID REFERENCES public.unions(id);

ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.collective_agreements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vacation_vesting_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view unions" ON public.unions FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view collective agreements" ON public.collective_agreements FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view vacation vesting" ON public.vacation_vesting_periods FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view vacation requests" ON public.vacation_requests FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage unions" ON public.unions FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.unions.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage collective agreements" ON public.collective_agreements FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.collective_agreements.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE TRIGGER audit_unions_trigger AFTER INSERT OR UPDATE OR DELETE ON public.unions FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_vacations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vacation_requests FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.employment_contracts ADD COLUMN work_schedule_id UUID REFERENCES public.work_schedules(id);

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

CREATE POLICY "Tenant Admins and DP can manage leaves" ON public.leaves FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.leaves.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage benefits" ON public.benefit_catalogs FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.benefit_catalogs.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage employee benefits" ON public.employee_benefits FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.employee_benefits.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE POLICY "Tenant Admins and DP can manage work schedules" ON public.work_schedules FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.work_schedules.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE TRIGGER audit_leaves_trigger AFTER INSERT OR UPDATE OR DELETE ON public.leaves FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_employee_benefits_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_work_schedules_trigger AFTER INSERT OR UPDATE OR DELETE ON public.work_schedules FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE RULE prevent_time_entry_deletion AS ON DELETE TO public.time_entries DO INSTEAD NOTHING;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.time_bank_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage time" ON public.time_entries FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage timesheets" ON public.timesheets FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage payroll" ON public.payroll_periods FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage rubrics" ON public.payroll_rubrics FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_time_entries_trigger AFTER INSERT OR UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_rubrics_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.esocial_transmissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sst_work_environments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sst_risks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sst_health_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage eSocial" ON public.esocial_transmissions FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage SST Envs" ON public.sst_work_environments FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage SST Risks" ON public.sst_risks FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage Health Exams" ON public.sst_health_exams FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_esocial_trigger AFTER INSERT OR UPDATE OR DELETE ON public.esocial_transmissions FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_sst_exams_trigger AFTER INSERT OR UPDATE OR DELETE ON public.sst_health_exams FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.time_entries 
    DROP COLUMN IF EXISTS adjusted_timestamp,
    DROP COLUMN IF EXISTS is_manual_adjustment,
    DROP COLUMN IF EXISTS adjustment_reason,
    DROP COLUMN IF EXISTS adjusted_by,
    DROP COLUMN IF EXISTS status;

ALTER TABLE public.employment_contract_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage history" ON public.employment_contract_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage time adjustments" ON public.time_entry_adjustments FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage lgpd consents" ON public.lgpd_consents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage retention policies" ON public.data_retention_policies FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_contract_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employment_contract_history FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_time_adjustments_trigger AFTER INSERT OR UPDATE OR DELETE ON public.time_entry_adjustments FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_lgpd_consents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_consents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Migration: 00025_create_employee_scales
-- Description: Criação da tabela de escalas para relacionar empregados às jornadas e ciclos de trabalho.;

ALTER TABLE public.employee_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee scales in their tenants" ON public.employee_scales FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage employee scales" ON public.employee_scales FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.employee_scales.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));

-- Auditoria;

CREATE TRIGGER audit_employee_scales_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_scales FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();



-- Migration: 00028_payroll_additionals_rubrics
-- Description: Inserção de rubricas padrão para Fase 16 (Adicional Noturno, Insalubridade, Periculosidade, Comissões e Prêmios).

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    -- Atualiza a constraint para permitir a categoria COMMISSION
    ALTER TABLE public.payroll_rubrics DROP CONSTRAINT IF EXISTS payroll_rubrics_category_check;
    ALTER TABLE public.payroll_rubrics ADD CONSTRAINT payroll_rubrics_category_check CHECK (category IN ('SALARY', 'OVERTIME', 'ALLOWANCE', 'TAX', 'ADVANCE', 'OTHER', 'COMMISSION'));

    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. Adicional Noturno (Cód 180)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '180' OR name ILIKE 'Adicional Noturno');
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '180', 'Adicional Noturno', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 0.20,
            true, true, true, true, true, true
        );

        -- 2. Insalubridade 10% (Grau Mínimo) (Cód 181)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '181';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '181', 'Insalubridade 10% (Grau Mínimo)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 10,
            true, true, true, true, true, true
        );

        -- 3. Insalubridade 20% (Grau Médio) (Cód 182)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '182';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '182', 'Insalubridade 20% (Grau Médio)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 20,
            true, true, true, true, true, true
        );

        -- 4. Insalubridade 40% (Grau Máximo) (Cód 183)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '183';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '183', 'Insalubridade 40% (Grau Máximo)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 40,
            true, true, true, true, true, true
        );

        -- 5. Periculosidade 30% (Cód 185)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '185';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '185', 'Periculosidade 30%', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_BASE', 30,
            true, true, true, true, true, true
        );

        -- 6. Comissão (Cód 190)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '190' OR name ILIKE 'Comissão');
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '190', 'Comissões', 'EARNING', 'COMMISSION', 'FIXED', 'MANUAL', NULL,
            true, true, true, true, true, true
        );

        -- 7. Prêmio (Cód 191)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '191';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '191', 'Prêmios', 'EARNING', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL,
            false, true, false, false, true, false
        );

    END LOOP;
END $$;



-- Migration: 00029_create_employee_fixed_events
-- Description: Tabela para vinculação permanente de adicionais e proventos fixos ao contrato do empregado.;

CREATE UNIQUE INDEX employee_fixed_events_active_rubric_idx 
ON public.employee_fixed_events (contract_id, rubric_id) 
WHERE is_active = true AND end_date IS NULL;

-- Habilita RLS;

ALTER TABLE public.employee_fixed_events ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso;

CREATE POLICY "Tenant Admins and DP can manage employee_fixed_events" 
    ON public.employee_fixed_events FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = employee_fixed_events.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Trigger de auditoria;

CREATE TRIGGER audit_employee_fixed_events_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();



-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS;

CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At;

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();




-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend;

ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia);

ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.;

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;




-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios;

ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits;

CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador;

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions;

CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters;

CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters;

CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters;

CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================




-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods;

CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events;

CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips;

CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items;

CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc;

CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================;

CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================;

NOTIFY pgrst, 'reload schema';
