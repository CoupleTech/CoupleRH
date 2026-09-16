-- Migration: 00049_fix_rubrics_and_codes
-- Description: Seed de Rubricas Padrão Corrigido

-- 1. Limpar rubricas duplicadas (1001 vs 101, 2001 vs 901)
-- Se as antigas (1001) não têm vínculos, as deletamos. (Evitando FK violation na payroll_rubrics se já foi usada).
DO $$
BEGIN
  BEGIN
    DELETE FROM public.payroll_rubrics WHERE code IN ('1001', '2001', '2002', '2005');
  EXCEPTION WHEN OTHERS THEN
    -- Soft delete se não for possível hard delete (por foreign key constraint)
    UPDATE public.payroll_rubrics SET is_active = false WHERE code IN ('1001', '2001', '2002', '2005');
  END;
END $$;

-- 2. Inserir rubricas 150 (HE50) e 160 (HE100) para o Espelho de Ponto
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Percorre todos os tenants para garantir as rubricas
  FOR v_tenant_id IN SELECT id FROM public.tenants LOOP
    
    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '150') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '150', 'Hora Extra 50%', 'Hora Extra Padrão (50%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 1.5, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '160') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '160', 'Hora Extra 100%', 'Hora Extra Domingos/Feriados (100%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 2.0, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

  END LOOP;
END $$;
