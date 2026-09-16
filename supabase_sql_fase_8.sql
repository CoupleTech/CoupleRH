-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
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

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================
