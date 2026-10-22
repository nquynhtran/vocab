-- Privileges, RLS and constraints of the tables. Run: npm run test:supabase (needs Docker).
-- Users are simulated with `set local role authenticated` plus the JWT claims auth.uid() reads.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local', 'authenticated', 'authenticated');

-- ---- Privileges (as postgres) ----

-- Checks every object in `public`, not a fixed list: local default privileges still grant
-- everything to anon, so a later migration that forgets to revoke must turn this red.
select is_empty($$
  select c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not c.relrowsecurity
$$, 'RLS is enabled on every table');
select is_empty($$
  select c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('anon', c.oid,
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
$$, 'anon has no privilege on any table or view');
select is_empty($$
  select c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and has_table_privilege('authenticated', c.oid, 'TRUNCATE, REFERENCES, TRIGGER')
$$, 'authenticated cannot truncate (it would bypass RLS), reference or add triggers');
select ok(
  has_table_privilege('authenticated', 'public.app_config', 'SELECT')
    and not has_table_privilege('authenticated', 'public.app_config', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.app_config', 'INSERT'),
  'authenticated can only read app_config'
);
select is_empty($$
  select p.oid::regprocedure from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE')
$$, 'anon cannot call any function');

-- ---- User A creates data ----

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    ('a0000000-0000-4000-8000-000000000001', 'IELTS', 'ielts',
     '2026-10-22T10:00:00.000Z', '2026-10-22T10:00:00.000Z');
  insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
    ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
     'Unit 1', 'unit 1', '2026-10-22T10:00:00.000Z', '2026-10-22T10:00:00.000Z');
  insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at) values
    ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
     'apple', 'apple', 'quả táo', '2026-10-22T10:00:00.000Z', '2026-10-22T10:00:00.000Z');
  insert into public.progress (term_id, box, correct_count, wrong_count) values
    ('a0000000-0000-4000-8000-000000000003', 1, 0, 0);
  insert into public.study_days (date, answered_count) values ('2026-10-22', 3);
$$, 'a user can create rows without sending user_id');

select is(
  (select user_id from public.folders where id = 'a0000000-0000-4000-8000-000000000001'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'user_id defaults to the signed-in user'
);
select is((select min_client_version from public.app_config), 1, 'app_config is readable');

-- ---- Constraints (as A) ----

select throws_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'ielts', 'ielts', now(), now())
$$, '23505', 'duplicate key value violates unique constraint "folders_name_key_unique"',
  'a folder name_key is unique per user');
select throws_ok($$
  insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'UNIT 1', 'unit 1', now(), now())
$$, '23505', 'duplicate key value violates unique constraint "files_name_key_unique"',
  'a file name_key is unique within its folder');
select lives_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    ('a0000000-0000-4000-8000-000000000004', 'TOEIC', 'toeic', now(), now());
  insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000004', 'Unit 1', 'unit 1', now(), now());
$$, 'the same file name is allowed in another folder');
select lives_ok($$
  insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at) values
    (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'Apple', 'apple', 'táo',
     now(), now())
$$, 'the same word may appear twice (warning only)');
select throws_ok($$
  insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), gen_random_uuid(), 'Orphan', 'orphan', now(), now())
$$, '23503', null, 'a file needs an existing folder');
select throws_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), '', 'x', now(), now())
$$, '23514', null, 'an empty name is rejected');
select throws_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), repeat('a', 201), 'y', now(), now())
$$, '23514', null, 'a name over 200 characters is rejected');
select lives_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), repeat('á', 200), 'z', now(), now())
$$, '200 characters with diacritics fit (counted in characters, not bytes)');
select throws_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'Blank key', '', now(), now())
$$, '23514', null, 'an empty name_key is rejected');
select throws_ok($$
  update public.terms set part_of_speech = 'v.' where id = 'a0000000-0000-4000-8000-000000000003'
$$, '23514', null, 'part_of_speech must be one of the stored names');
select lives_ok($$
  update public.terms set part_of_speech = 'phrasal verb'
  where id = 'a0000000-0000-4000-8000-000000000003'
$$, 'a listed part_of_speech is accepted');
select throws_ok($$
  update public.terms set example = repeat('e', 501) where id = 'a0000000-0000-4000-8000-000000000003'
$$, '23514', null, 'an example over 500 characters is rejected');
select throws_ok($$
  update public.terms set example = '' where id = 'a0000000-0000-4000-8000-000000000003'
$$, '23514', null, 'a blank example is stored as null, not ''''');
select throws_ok($$
  update public.progress set box = 6 where term_id = 'a0000000-0000-4000-8000-000000000003'
$$, '23514', null, 'box is at most 5');
select throws_ok($$
  update public.progress set box = 0 where term_id = 'a0000000-0000-4000-8000-000000000003'
$$, '23514', null, 'box is at least 1');
select throws_ok($$
  update public.progress set wrong_count = -1 where term_id = 'a0000000-0000-4000-8000-000000000003'
$$, '23514', null, 'counts cannot be negative');
select throws_ok($$
  update public.study_days set answered_count = -1 where date = '2026-10-22'
$$, '23514', null, 'answered_count cannot be negative');
select throws_ok($$
  insert into public.folders (id, user_id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Planted', 'planted', now(), now())
$$, '42501', null, 'a user cannot insert rows owned by someone else');
select throws_ok($$
  update public.folders set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  where id = 'a0000000-0000-4000-8000-000000000004'
$$, '42501', null, 'a user cannot hand a row over to someone else');
select throws_ok($$ update public.app_config set min_client_version = 0 $$, '42501', null,
  'a user cannot change app_config');

-- ---- User B cannot see or touch A's rows ----

reset role;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;

select is_empty($$ select id from public.folders $$, 'B sees no folders');
select is_empty($$ select id from public.files $$, 'B sees no files');
select is_empty($$ select id from public.terms $$, 'B sees no terms');
select is_empty($$ select term_id from public.progress $$, 'B sees no progress');
select is_empty($$ select date from public.study_days $$, 'B sees no study days');
select is_empty($$
  update public.folders set name = 'Hacked' where id = 'a0000000-0000-4000-8000-000000000001'
  returning id
$$, 'B updates 0 rows of A');
select is_empty($$
  delete from public.folders where id = 'a0000000-0000-4000-8000-000000000001' returning id
$$, 'B deletes 0 rows of A');
select throws_ok($$
  insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'Intruder', 'intruder',
     now(), now())
$$, '23503', null, 'B cannot attach a file to A''s folder (foreign key includes user_id)');
select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at) values
    (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'x', 'x', 'x', now(), now())
$$, '23503', null, 'B cannot attach a term to A''s file');
select throws_ok($$
  insert into public.progress (term_id, box, correct_count, wrong_count) values
    ('a0000000-0000-4000-8000-000000000003', 1, 0, 0)
$$, '23503', null, 'B cannot add progress to A''s term');
select lives_ok($$
  insert into public.folders (id, name, name_key, created_at, updated_at) values
    (gen_random_uuid(), 'IELTS', 'ielts', now(), now())
$$, 'B may use a folder name that A already uses');

-- ---- Back to A: nothing changed, then cascades ----

reset role;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select name from public.folders where id = 'a0000000-0000-4000-8000-000000000001'),
  'IELTS', 'A''s folder is untouched by B'
);
select lives_ok($$ delete from public.terms where id = 'a0000000-0000-4000-8000-000000000003' $$,
  'A deletes a term');
select is_empty($$
  select term_id from public.progress where term_id = 'a0000000-0000-4000-8000-000000000003'
$$, 'deleting a term deletes its progress');
select lives_ok($$
  delete from public.folders where id = 'a0000000-0000-4000-8000-000000000001'
$$, 'A deletes a folder');
select is_empty($$
  select id from public.files where folder_id = 'a0000000-0000-4000-8000-000000000001'
  union all
  select t.id from public.terms t where t.file_id = 'a0000000-0000-4000-8000-000000000002'
$$, 'deleting a folder deletes its files and their terms');

reset role;
select * from finish();
rollback;
