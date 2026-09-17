-- 1. Garante que a coluna address existe na tabela companies (caso você tenha esquecido de criá-la no banco novo)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;

-- 2. Força o Supabase (PostgREST) a recarregar o cache do banco de dados
NOTIFY pgrst, 'reload schema';
