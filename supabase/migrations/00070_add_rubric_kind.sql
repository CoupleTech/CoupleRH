-- Migration: 00070_add_rubric_kind.sql
-- Description: Fase P3 / T22 - Adiciona rubric_kind com backfill oficial em payroll_rubrics

-- 1. Adiciona coluna rubric_kind se não existir
ALTER TABLE public.payroll_rubrics
ADD COLUMN IF NOT EXISTS rubric_kind TEXT;

-- 2. Backfill de rubric_kind para as rubricas existentes em todos os tenants
UPDATE public.payroll_rubrics SET rubric_kind = 'SALARY_BASE'
WHERE code IN ('101', '102', '1001') OR (category = 'SALARY' AND rubric_kind IS NULL);

UPDATE public.payroll_rubrics SET rubric_kind = 'OVERTIME'
WHERE code IN ('150', '151', '152', '153', '160') OR (category IN ('OVERTIME', 'HORA_EXTRA') AND rubric_kind IS NULL);

UPDATE public.payroll_rubrics SET rubric_kind = 'DSR'
WHERE code IN ('103', '104', '170', '1011') OR (category = 'DSR' AND rubric_kind IS NULL);

UPDATE public.payroll_rubrics SET rubric_kind = 'DSR_NOTURNO'
WHERE code IN ('171');

UPDATE public.payroll_rubrics SET rubric_kind = 'ADIC_NOTURNO'
WHERE code IN ('301');

UPDATE public.payroll_rubrics SET rubric_kind = 'INSALUBRIDADE'
WHERE code IN ('302');

UPDATE public.payroll_rubrics SET rubric_kind = 'PERICULOSIDADE'
WHERE code IN ('303', '305');

UPDATE public.payroll_rubrics SET rubric_kind = 'COMMISSION'
WHERE code IN ('401', '402', '403', '404') OR (category = 'COMMISSION' AND rubric_kind IS NULL);

UPDATE public.payroll_rubrics SET rubric_kind = 'ABSENCE'
WHERE code IN ('801', '210');

UPDATE public.payroll_rubrics SET rubric_kind = 'LATE'
WHERE code IN ('802', '803', '211');

UPDATE public.payroll_rubrics SET rubric_kind = 'FAMILY_SALARY'
WHERE code IN ('106');

UPDATE public.payroll_rubrics SET rubric_kind = 'ALIMONY'
WHERE code IN ('804');

UPDATE public.payroll_rubrics SET rubric_kind = 'LOAN'
WHERE code IN ('805');

UPDATE public.payroll_rubrics SET rubric_kind = 'UNION'
WHERE code IN ('806');

UPDATE public.payroll_rubrics SET rubric_kind = 'ADVANCE'
WHERE code IN ('250', '850', '608') OR (category = 'ADVANCE' AND rubric_kind IS NULL);

UPDATE public.payroll_rubrics SET rubric_kind = 'BENEFIT'
WHERE code IN ('201', '202', '203', '204') OR (category = 'BENEFIT' AND rubric_kind IS NULL);

UPDATE public.payroll_rubrics SET rubric_kind = 'VACATION'
WHERE code IN ('501', '502', '503', '504');

UPDATE public.payroll_rubrics SET rubric_kind = 'THIRTEENTH'
WHERE code IN ('601', '602');

UPDATE public.payroll_rubrics SET rubric_kind = 'TERMINATION'
WHERE code IN ('701', '702', '703', '704', '705', '706', '707', '708');

UPDATE public.payroll_rubrics SET rubric_kind = 'INSS'
WHERE code = '901';

UPDATE public.payroll_rubrics SET rubric_kind = 'IRRF'
WHERE code = '902';

UPDATE public.payroll_rubrics SET rubric_kind = 'FGTS'
WHERE code = '903';

-- Qualquer outra rubrica não mapeada recebe 'OTHER'
UPDATE public.payroll_rubrics SET rubric_kind = 'OTHER'
WHERE rubric_kind IS NULL;

-- 3. Define valor padrão como 'OTHER' e restrição NOT NULL
ALTER TABLE public.payroll_rubrics
ALTER COLUMN rubric_kind SET DEFAULT 'OTHER';

ALTER TABLE public.payroll_rubrics
ALTER COLUMN rubric_kind SET NOT NULL;

-- 4. Constraint de validação dos kinds autorizados pelo motor
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payroll_rubrics_rubric_kind_check'
    ) THEN
        ALTER TABLE public.payroll_rubrics
        ADD CONSTRAINT payroll_rubrics_rubric_kind_check
        CHECK (rubric_kind IN (
            'SALARY_BASE',
            'OVERTIME',
            'DSR',
            'DSR_NOTURNO',
            'ADIC_NOTURNO',
            'INSALUBRIDADE',
            'PERICULOSIDADE',
            'ABSENCE',
            'LATE',
            'COMMISSION',
            'FAMILY_SALARY',
            'ALIMONY',
            'LOAN',
            'UNION',
            'ADVANCE',
            'BENEFIT',
            'VACATION',
            'THIRTEENTH',
            'TERMINATION',
            'INSS',
            'IRRF',
            'FGTS',
            'OTHER'
        ));
    END IF;
END $$;
