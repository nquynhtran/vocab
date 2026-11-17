-- Tests for the write gate in 20261117120100_require_client_v4.sql. Applied by hand after the
-- migration itself is run; move both into supabase/migrations and tests/database together.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated');
insert into public.folders (id, user_id, name, name_key, created_at, updated_at) values
  ('d0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'IELTS', 'ielts',
   now(), now());
insert into public.files (id, user_id, folder_id, name, name_key, created_at, updated_at) values
  ('d0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'd0000000-0000-4000-8000-000000000001', 'Unit 1', 'unit 1', now(), now());

-- Claims and headers as PostgREST sets them for one request.
create function pg_temp.as_app(version text) returns void language sql as $$
  select set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true),
  set_config('request.headers',
    case when version is null then '{}' else json_build_object('x-client-version', version)::text end,
    true)
$$;

select pg_temp.as_app(null);
set local role authenticated;

select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at)
  values ('d0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000002',
    'x', 'x', 'x', now(), now())
$$, 'VC003', null, 'a request without the header is refused');

select pg_temp.as_app('3');
select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at)
  values ('d0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000002',
    'x', 'x', 'x', now(), now())
$$, 'VC003', null, 'a build older than the minimum is refused');

select pg_temp.as_app('4');
select lives_ok($$
  insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at)
  values ('d0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000002',
    'x', 'x', 'x', now(), now())
$$, 'a current build writes');
select lives_ok($$
  update public.terms set meaning = 'y' where id = 'd0000000-0000-4000-8000-000000000013'
$$, 'and updates');

select pg_temp.as_app('abc');
select throws_ok($$
  update public.terms set meaning = 'z' where id = 'd0000000-0000-4000-8000-000000000013'
$$, 'VC003', null, 'a header that is not a number is refused');

select * from finish();
rollback;
