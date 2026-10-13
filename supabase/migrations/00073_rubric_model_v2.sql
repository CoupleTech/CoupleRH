-- Migration: 00073_rubric_model_v2.sql
-- Description: Fase P3 / §6 Modelo v2 - rubric_incidences por contexto, calculation_bases, versionamento e status da rubrica

-- 1. Ampliar a tabela payroll_rubrics com governança e ciclo de vida
ALTER TABLE public.payroll_rubrics 
    ADD COLUMN IF NOT EXISTS esocial_nature TEXT,
    ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS legal_basis TEXT,
    ADD COLUMN IF NOT EXISTS approved_by UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.payroll_rubrics DROP CONSTRAINT IF EXISTS payroll_rubrics_status_check;
ALTER TABLE public.payroll_rubrics ADD CONSTRAINT payroll_rubrics_status_check 
    CHECK (status IN ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED'));

-- Marcação das rubricas estruturais do sistema
UPDATE public.payroll_rubrics
SET is_system = true
WHERE code IN (
    '101', '103', '104', '106', '150', '151', '152', '153', '160', '170', '171',
    '250', '301', '302', '303', '305', '401', '402', '403', '404', '405',
    '501', '502', '503', '504', '550', '601', '602', '701', '707', '708',
    '801', '802', '803', '804', '805', '806', '850', '900', '901', '902', '903'
);

-- 2. Tabela de incidências por contexto (MONTHLY, VACATION, THIRTEENTH, TERMINATION, ALL)
CREATE TABLE IF NOT EXISTS public.rubric_incidences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    context TEXT NOT NULL CHECK (context IN ('MONTHLY', 'VACATION', 'THIRTEENTH', 'TERMINATION', 'ALL')),
    inss BOOLEAN NOT NULL DEFAULT false,
    irrf BOOLEAN NOT NULL DEFAULT false,
    fgts BOOLEAN NOT NULL DEFAULT false,
    irrf_mode TEXT NOT NULL DEFAULT 'NORMAL' CHECK (irrf_mode IN ('NORMAL', 'EXCLUSIVO', 'TABELA_PLR', 'ISENTO')),
    integra_dsr BOOLEAN NOT NULL DEFAULT false,
    media_ferias BOOLEAN NOT NULL DEFAULT false,
    media_13 BOOLEAN NOT NULL DEFAULT false,
    inss_patronal BOOLEAN NOT NULL DEFAULT false,
    rat BOOLEAN NOT NULL DEFAULT false,
    terceiros BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rubric_id, context)
);

ALTER TABLE public.rubric_incidences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rubric_incidences' AND policyname = 'View rubric_incidences') THEN
        CREATE POLICY "View rubric_incidences" ON public.rubric_incidences
            FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rubric_incidences' AND policyname = 'Manage rubric_incidences') THEN
        CREATE POLICY "Manage rubric_incidences" ON public.rubric_incidences
            FOR ALL USING (
                tenant_id = ANY (public.user_tenant_ids())
                AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = rubric_incidences.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
            );
    END IF;
END $$;

-- Gatilho de auditoria (T29)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_rubric_incidences_trigger') THEN
        CREATE TRIGGER audit_rubric_incidences_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.rubric_incidences
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- 3. Tabela de definição de bases de cálculo dinâmicas
CREATE TABLE IF NOT EXISTS public.calculation_bases (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calculation_bases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calculation_bases' AND policyname = 'View calculation_bases') THEN
        CREATE POLICY "View calculation_bases" ON public.calculation_bases FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calculation_bases' AND policyname = 'Manage calculation_bases') THEN
        CREATE POLICY "Manage calculation_bases" ON public.calculation_bases FOR ALL USING (
            EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND role IN ('system_admin', 'tenant_admin'))
        );
    END IF;
END $$;

-- 4. Tabela de membros componentes das bases de cálculo dinâmicas
CREATE TABLE IF NOT EXISTS public.calculation_base_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_code TEXT NOT NULL REFERENCES public.calculation_bases(code) ON DELETE CASCADE,
    rubric_id UUID REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    kind TEXT,
    operation TEXT NOT NULL DEFAULT 'ADD' CHECK (operation IN ('ADD', 'SUBTRACT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (base_code, rubric_id, kind)
);

ALTER TABLE public.calculation_base_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calculation_base_members' AND policyname = 'View calculation_base_members') THEN
        CREATE POLICY "View calculation_base_members" ON public.calculation_base_members FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calculation_base_members' AND policyname = 'Manage calculation_base_members') THEN
        CREATE POLICY "Manage calculation_base_members" ON public.calculation_base_members FOR ALL USING (
            EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND role IN ('system_admin', 'tenant_admin'))
        );
    END IF;
END $$;

-- 5. Coluna de versionamento no item do holerite
ALTER TABLE public.payslip_items 
    ADD COLUMN IF NOT EXISTS rubric_version_id UUID REFERENCES public.payroll_rubrics(id);

-- 6. Seed das bases de cálculo dinâmicas fundamentais
INSERT INTO public.calculation_bases (code, name, description, is_system)
VALUES 
    ('BASE_HORA_EXTRA', 'Base para Cálculo de Horas Extras', 'Salário base e adicionais habituais conforme Súmula 264 do TST', true),
    ('BASE_DSR', 'Base para Cálculo de DSR sobre Variáveis/HE', 'Horas extras, comissões e adicional noturno integrados ao repouso semanal', true),
    ('BASE_DSR_NOTURNO', 'Base para DSR Noturno', 'Adicional noturno gerador de DSR', true),
    ('BASE_FERIAS', 'Base para Cálculo de Férias e 1/3', 'Salário e médias de variáveis para férias', true),
    ('BASE_13', 'Base para Cálculo de 13º Salário', 'Salário e médias de variáveis para gratificação natalina', true),
    ('BASE_INSS', 'Base de Contribuição Previdenciária', 'Remunerações tributáveis para INSS', true),
    ('BASE_IRRF', 'Base de Incidência do Imposto de Renda Retido na Fonte', 'Rendimentos tributáveis com deduções legais', true),
    ('BASE_FGTS', 'Base de Depósito do FGTS', 'Verbas salariais com depósito obrigatório do FGTS', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Seed de membros estruturais das bases
INSERT INTO public.calculation_base_members (base_code, kind, operation)
VALUES 
    ('BASE_HORA_EXTRA', 'SALARY_BASE', 'ADD'),
    ('BASE_HORA_EXTRA', 'INSALUBRIDADE', 'ADD'),
    ('BASE_HORA_EXTRA', 'PERICULOSIDADE', 'ADD'),
    ('BASE_HORA_EXTRA', 'ADIC_NOTURNO', 'ADD'),
    ('BASE_HORA_EXTRA', 'ABSENCE', 'SUBTRACT'),
    ('BASE_DSR', 'OVERTIME', 'ADD'),
    ('BASE_DSR', 'COMMISSION', 'ADD'),
    ('BASE_DSR', 'ADIC_NOTURNO', 'ADD'),
    ('BASE_DSR_NOTURNO', 'ADIC_NOTURNO', 'ADD')
ON CONFLICT (base_code, rubric_id, kind) DO NOTHING;

-- 7. Backfill de rubric_incidences a partir das configurações existentes em payroll_rubrics
INSERT INTO public.rubric_incidences (
    tenant_id,
    rubric_id,
    context,
    inss,
    irrf,
    fgts,
    irrf_mode,
    integra_dsr,
    media_ferias,
    media_13,
    inss_patronal,
    rat,
    terceiros
)
SELECT 
    r.tenant_id,
    r.id AS rubric_id,
    'MONTHLY' AS context,
    COALESCE(r.generates_base_inss, false) AS inss,
    COALESCE(r.generates_base_irrf, false) AS irrf,
    COALESCE(r.generates_base_fgts, false) AS fgts,
    'NORMAL' AS irrf_mode,
    (r.rubric_kind IN ('OVERTIME', 'COMMISSION')) AS integra_dsr,
    true AS media_ferias,
    true AS media_13,
    COALESCE(r.incidence_inss_patronal, r.generates_base_inss, false) AS inss_patronal,
    COALESCE(r.incidence_rat, r.generates_base_inss, false) AS rat,
    COALESCE(r.incidence_third_parties, r.generates_base_inss, false) AS terceiros
FROM public.payroll_rubrics r
ON CONFLICT (rubric_id, context) DO NOTHING;

NOTIFY pgrst, 'reload schema';
