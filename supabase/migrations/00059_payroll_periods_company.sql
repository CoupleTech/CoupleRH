-- Migration: 00042_payroll_periods_company
-- Description: Adiciona company_id aos períodos de folha para permitir que cada empresa tenha seus próprios fechamentos.

-- 1. Adiciona a coluna company_id (permitindo null inicialmente para dados antigos)
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Limpa os períodos existentes para evitar inconsistências (como estamos em dev/MVP e a folha deve ser por empresa)
-- Obs: Isso vai apagar os holerites calculados, será necessário rodar o motor novamente.
TRUNCATE TABLE public.payroll_periods CASCADE;

-- 3. Torna a coluna NOT NULL após a limpeza
ALTER TABLE public.payroll_periods ALTER COLUMN company_id SET NOT NULL;

-- 4. Atualiza a constraint de unicidade para incluir a empresa
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_tenant_id_month_year_type_key;

-- Dependendo de como a constraint foi nomeada, pode ser "payroll_periods_tenant_id_competence_month_competence_y_key"
-- Vamos garantir removendo qualquer constraint de unique nas colunas antigas:
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'payroll_periods' AND constraint_type = 'UNIQUE') 
    LOOP
        EXECUTE 'ALTER TABLE public.payroll_periods DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_tenant_company_month_year_type_key UNIQUE (tenant_id, company_id, month, year, type);

NOTIFY pgrst, 'reload schema';
