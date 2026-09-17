-- 1. Script para corrigir o usuário que você não consegue logar
-- Isso forçará a confirmação do e-mail do usuário recém-criado.
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE id = '8268050a-fdd3-47b9-9974-206148c79de6';

-- --------------------------------------------------------------------------------------
-- 2. Função RPC para criar usuário via tela SEM confirmação de e-mail (Bypass GoTrue)
-- Como usar no frontend:
-- const { data, error } = await supabase.rpc('create_user_without_confirmation', { 
--   user_email: 'novo@email.com', 
--   user_password: 'senha123' 
-- });
-- --------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_user_without_confirmation(
  user_email text,
  user_password text
) RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
BEGIN
  -- Gerar ID único para o novo usuário
  new_user_id := gen_random_uuid();
  
  -- Encriptar a senha utilizando bcrypt (padrão do Supabase GoTrue)
  encrypted_pw := extensions.crypt(user_password, extensions.gen_salt('bf'));

  -- Inserir usuário na tabela auth.users com email_confirmed_at preenchido
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    user_email,
    encrypted_pw,
    now(), -- Email confirmado no momento da criação
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Inserir identidade para que o usuário possa logar por email
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    new_user_id,
    new_user_id::text,
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id, user_email)::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
