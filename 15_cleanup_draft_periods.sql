-- =========================================================================================
-- SCRIPT DE LIMPEZA DE FOLHAS ABERTAS (SETEMBRO/2026)
-- Este script força a exclusão das folhas de Setembro de 2026 que não estão fechadas.
-- Isso é útil caso haja alguma trava de banco de dados (chave estrangeira) impedindo
-- a exclusão pela interface.
-- =========================================================================================

DO $$
BEGIN
    -- Se houver algum erro de Foreign Key, ele vai estourar aqui no console do Supabase
    DELETE FROM public.payroll_periods
    WHERE status IN ('DRAFT', 'CALCULATED', 'REOPENED')
      AND month = 9
      AND year = 2026;

    -- Avisa que foi concluído
    RAISE NOTICE 'Folhas abertas de Setembro/2026 foram excluídas com sucesso.';
END $$;
