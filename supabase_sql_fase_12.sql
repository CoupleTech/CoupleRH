-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
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

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
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

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
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
