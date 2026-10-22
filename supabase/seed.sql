-- Local only: `supabase start` / `supabase db reset` run this file; `supabase db push` never
-- does (unless --include-seed, which must not be used). Sign-up is disabled, so the Vitest
-- contract suite (src/data/supabaseRepository.test.ts) signs in as this user.
-- The password is a public test value: this account exists only in the local Docker database.
--
-- GoTrue reads the token columns as non-null strings; leaving them null makes every sign-in
-- fail with "Database error querying schema", hence the explicit ''.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'contract@test.local',
  extensions.crypt('contract-test-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(), 'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001', 'email',
  '{"sub":"c0000000-0000-4000-8000-000000000001","email":"contract@test.local","email_verified":true}',
  now(), now(), now()
);
