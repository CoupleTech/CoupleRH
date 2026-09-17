-- Conceder uso do schema public para as roles da API do Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Conceder permissões em todas as tabelas para as roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Conceder permissões nas sequences (para campos auto-incremento que não usam UUID)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Conceder permissões em todas as rotinas/funções
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- (Opcional) Garantir que futuras tabelas criadas também recebam as permissões automaticamente
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Fazer o mesmo para o schema audit
GRANT USAGE ON SCHEMA audit TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA audit TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA audit TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA audit TO anon, authenticated, service_role;

-- Atualizar cache da API
NOTIFY pgrst, 'reload schema';
