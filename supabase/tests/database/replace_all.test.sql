-- replace_all (stage 5, docs/backup.md). Run: npm run test:supabase (needs Docker).
-- Anon access and SECURITY INVOKER are checked for every function in tables.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local', 'authenticated', 'authenticated');

-- One row per table; `pg_temp` keeps it out of the real schema.
create function pg_temp.snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'folders', jsonb_build_array(jsonb_build_object(
      'id', 'a0000000-0000-4000-8000-000000000001', 'name', 'IELTS', 'name_key', 'ielts',
      'created_at', '2026-10-01T08:00:00.123Z', 'updated_at', '2026-10-02T08:00:00.456Z')),
    'files', jsonb_build_array(jsonb_build_object(
      'id', 'a0000000-0000-4000-8000-000000000002',
      'folder_id', 'a0000000-0000-4000-8000-000000000001', 'name', 'Unit 1',
      'name_key', 'unit 1', 'notes', null,
      'created_at', '2026-10-01T08:00:00.000Z', 'updated_at', '2026-10-01T08:00:00.000Z')),
    'terms', jsonb_build_array(jsonb_build_object(
      'id', 'a0000000-0000-4000-8000-000000000003',
      'file_id', 'a0000000-0000-4000-8000-000000000002', 'word', 'apple', 'word_key', 'apple',
      'part_of_speech', null, 'pronunciation', null, 'meaning', 'quả táo', 'example', null,
      'created_at', '2026-10-01T08:00:00.000Z', 'updated_at', '2026-10-01T08:00:00.000Z')),
    'progress', jsonb_build_array(jsonb_build_object(
      'term_id', 'a0000000-0000-4000-8000-000000000003', 'box', 3, 'correct_count', 4,
      'wrong_count', 1, 'last_wrong_at', null, 'last_studied_at', null,
      'last_promoted_day', null)),
    'study_days', jsonb_build_array(jsonb_build_object(
      'date', '2026-10-03', 'answered_count', 12))
  );
$$;
grant execute on function pg_temp.snapshot() to authenticated;

-- Counts of folders, files, terms, progress, study days visible to the caller.
create function pg_temp.counts() returns text language sql as $$
  select concat_ws(',', (select count(*) from public.folders), (select count(*) from public.files),
    (select count(*) from public.terms), (select count(*) from public.progress),
    (select count(*) from public.study_days));
$$;
grant execute on function pg_temp.counts() to authenticated;

-- ---- User B has data that A's restore must not touch ----

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
insert into public.folders (id, name, name_key, created_at, updated_at) values
  ('b0000000-0000-4000-8000-000000000001', 'B folder', 'b folder', now(), now());
insert into public.study_days (date, answered_count) values ('2026-10-03', 5);

-- ---- User A: current data, every table, plus a study day the backup does not have ----

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
insert into public.folders (id, name, name_key, created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000001', 'Old', 'old', now(), now());
insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Old file',
   'old file', now(), now());
insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'old',
   'old', 'cũ', now(), now());
insert into public.progress (term_id, box, correct_count, wrong_count) values
  ('c0000000-0000-4000-8000-000000000003', 2, 1, 0);
insert into public.study_days (date, answered_count) values ('2026-10-03', 99), ('2026-11-01', 7);

-- ---- A broken payload: the error comes after the deletes, so they must roll back ----

select throws_ok($$
  select public.replace_all(jsonb_set(pg_temp.snapshot(), '{terms,0}',
    (pg_temp.snapshot() -> 'terms' -> 0) || '{"partOfSpeech": "noun"}'))
$$, '22023', null, 'a payload with a wrong key is refused');
select is(pg_temp.counts(), '1,1,1,1,2', 'a refused restore keeps every current row');
select is((select name from public.folders), 'Old', 'and keeps them unchanged');

-- ---- Success ----

select lives_ok($$ select public.replace_all(pg_temp.snapshot()) $$, 'the backup replaces the data');
select is(
  (select count(*)::int from pg_locks
   where locktype = 'advisory' and pid = pg_backend_pid() and granted),
  1,
  'it holds a single advisory lock (no second key besides import_snapshot''s)'
);
select is(
  (select ((classid::bigint << 32) | objid::bigint) from pg_locks
   where locktype = 'advisory' and pid = pg_backend_pid()),
  hashtextextended('import_snapshot:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0),
  'that lock has import_snapshot''s key'
);
select is(pg_temp.counts(), '1,1,1,1,1', 'every table holds exactly the backup');
select is((select name from public.folders), 'IELTS', 'the old folder is gone');
select results_eq(
  $$ select date, answered_count from public.study_days $$,
  $$ values ('2026-10-03'::date, 12) $$,
  'study days come from the backup, the extra one is gone (#76)'
);
select is(
  (select created_at from public.folders), '2026-10-01T08:00:00.123Z'::timestamptz,
  'timestamps from the backup are kept'
);
select lives_ok($$ select public.replace_all(pg_temp.snapshot()) $$, 'running it again works');
select is(pg_temp.counts(), '1,1,1,1,1', 'and gives the same data');

-- ---- User B is untouched ----

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(pg_temp.counts(), '1,0,0,0,1', 'B''s rows are still there');
select is((select answered_count from public.study_days), 5, 'B''s study day is unchanged');

-- ---- Not signed in ----

reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.replace_all(pg_temp.snapshot()) $$, '42501',
  'Not signed in', 'restore needs a signed-in user even when called with privileges');

select * from finish();
rollback;
