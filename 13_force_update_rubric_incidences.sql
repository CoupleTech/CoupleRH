-- Força a atualização das incidências (Impostos) de todas as rubricas padrão CLT
-- Isso corrige rubricas que já existiam e não tiveram seus impostos atualizados pelo script anterior.

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Atualiza Horas Extras (Todas incidem INSS, IRRF e FGTS)
        UPDATE public.payroll_rubrics 
        SET inss = true, irrf = true, fgts = true, gera_base_inss = true, gera_base_irrf = true, gera_base_fgts = true
        WHERE tenant_id = tenant.id AND code IN ('150', '151', '160');

        -- Atualiza Adicionais (Noturno, Insalubridade, Periculosidade) (Todas incidem INSS, IRRF e FGTS)
        UPDATE public.payroll_rubrics 
        SET inss = true, irrf = true, fgts = true, gera_base_inss = true, gera_base_irrf = true, gera_base_fgts = true
        WHERE tenant_id = tenant.id AND code IN ('301', '302', '303');

        -- Atualiza Comissão (Incide INSS, IRRF e FGTS)
        UPDATE public.payroll_rubrics 
        SET inss = true, irrf = true, fgts = true, gera_base_inss = true, gera_base_irrf = true, gera_base_fgts = true
        WHERE tenant_id = tenant.id AND code = '401';

        -- Atualiza PLR - Participação nos Lucros (NÃO incide INSS nem FGTS, apenas IRRF)
        UPDATE public.payroll_rubrics 
        SET inss = false, irrf = true, fgts = false, gera_base_inss = false, gera_base_irrf = true, gera_base_fgts = false
        WHERE tenant_id = tenant.id AND code = '404';

        -- Atualiza 13º Salário (Integral - 2ª Parcela) (Incide INSS, IRRF e FGTS)
        UPDATE public.payroll_rubrics 
        SET inss = true, irrf = true, fgts = true, gera_base_inss = true, gera_base_irrf = true, gera_base_fgts = true
        WHERE tenant_id = tenant.id AND code = '601';

        -- Atualiza Adiantamento 13º (1ª Parcela) (NÃO incide INSS nem IRRF, apenas FGTS)
        UPDATE public.payroll_rubrics 
        SET inss = false, irrf = false, fgts = true, gera_base_inss = false, gera_base_irrf = false, gera_base_fgts = true
        WHERE tenant_id = tenant.id AND code = '602';

    END LOOP;
END $$;
