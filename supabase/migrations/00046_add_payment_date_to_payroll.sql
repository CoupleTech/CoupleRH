-- Migration: 00046_add_payment_date_to_payroll
-- Description: Adiciona a coluna payment_date para suportar o prazo de pagamento (ex: 2 dias antes das férias ou rescisão) e evitar o erro do schema cache.

ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Força a atualização do cache do PostgREST (API do Supabase)
NOTIFY pgrst, 'reload schema';
