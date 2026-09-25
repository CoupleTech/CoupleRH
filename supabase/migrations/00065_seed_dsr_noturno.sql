-- Insert DSR sobre Adicional Noturno for all active tenants
DO $$ 
DECLARE 
  tenant RECORD;
BEGIN
  FOR tenant IN SELECT id FROM public.tenants LOOP
    INSERT INTO public.payroll_rubrics (
      tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, is_active, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code
    )
    VALUES (
      tenant.id, 
      '171', 
      'DSR sobre Adic. Noturno', 
      'EARNING', 
      'EARNING', 
      'DSR', 
      'PERCENTAGE_OF_BASE', 
      'BASE_DSR_NOTURNO', 
      46, 
      true, 
      true, 
      true, 
      true, 
      '1012'
    )
    ON CONFLICT (tenant_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      calculation_type = EXCLUDED.calculation_type,
      calculation_base = EXCLUDED.calculation_base,
      calculation_order = EXCLUDED.calculation_order;
  END LOOP;
END $$;
