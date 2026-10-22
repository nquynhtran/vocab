-- Local only: `supabase start` / `supabase db reset` run this file. Never run it on the cloud
-- project (`db push --include-seed`, `db reset --linked` without --no-seed): the password below
-- is public, so the account would let anyone sign in. Sign-up is disabled, so the Vitest
-- contract suite (src/data/supabaseRepository.test.ts) signs in as this user.

-- Guard against the commands above: only the local CLI database uses the CLI's public demo JWT
-- secret; a real project never does.
do $$
begin
  if current_setting('app.settings.jwt_secret', true) is distinct from
     'super-secret-jwt-token-with-at-least-32-characters-long' then
    raise exception 'seed.sql is for the local Supabase CLI database only';
  end if;
end;
$$;

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
