-- Migration: 00023_payroll_engine_v2_schema
-- Description: Refatoração de Rubricas e Eventos para o Motor em Edge Functions

-- 1. Remoção da stored procedure antiga (não será mais utilizada no BD)
DROP FUNCTION IF EXISTS public.process_payroll_period(UUID);

-- 2. Adequação da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS calculation_form TEXT DEFAULT 'FIXO' 
        CHECK (calculation_form IN ('FIXO', 'PERCENTUAL', 'QUANTIDADE_X_VALOR', 'DIAS', 'HORAS', 'FORMULA', 'REFERENCIA', 'BASE', 'MANUAL', 'AUTOMATICA')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(10,6),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(10,6),
    ADD COLUMN IF NOT EXISTS formula TEXT,
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS inss_patronal_incidence BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS rat_incidence BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS terceiros_incidence BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_inss_base BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_irrf_base BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_fgts_base BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS esocial_nature_code TEXT;

-- 3. Adequação da tabela payroll_events (Instâncias de rubrica)
ALTER TABLE public.payroll_events
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS reference TEXT,
    ADD COLUMN IF NOT EXISTS manual_value NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL' 
        CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTACAO', 'INTEGRACAO', 'COMPLEMENTAR', 'DISSIDIO', 'RESCISAO', 'FERIAS')),
    ADD COLUMN IF NOT EXISTS observation TEXT,
    ADD COLUMN IF NOT EXISTS launch_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS launched_by UUID;

-- 4. Adequação da tabela payroll_memory_calc (Auditoria detalhada)
ALTER TABLE public.payroll_memory_calc
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS step_name TEXT,
    ADD COLUMN IF NOT EXISTS base_value NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS quantity_used NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS percentage_used NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS parsed_formula TEXT,
    ADD COLUMN IF NOT EXISTS result_value NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS origin TEXT,
    ADD COLUMN IF NOT EXISTS engine_version TEXT;

ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

-- 5. Atualização de Políticas (RLS)
CREATE POLICY "Users can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));
CREATE POLICY "System can insert memory calc" ON public.payroll_memory_calc FOR INSERT WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));
