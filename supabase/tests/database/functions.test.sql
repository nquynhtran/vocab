-- import_snapshot and export_backup. Run: npm run test:supabase (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local', 'authenticated', 'authenticated');

-- A snapshot with one row per table; `pg_temp` keeps it out of the real schema.
create function pg_temp.snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'folders', jsonb_build_array(jsonb_build_object(
      'id', 'a0000000-0000-4000-8000-000000000001', 'name', 'IELTS', 'name_key', 'ielts',
      'created_at', '2026-10-01T08:00:00.123Z', 'updated_at', '2026-10-02T08:00:00.456Z')),
    'files', jsonb_build_array(jsonb_build_object(
      'id', 'a0000000-0000-4000-8000-000000000002',
      'folder_id', 'a0000000-0000-4000-8000-000000000001', 'name', 'Unit 1',
      'name_key', 'unit 1',
      'created_at', '2026-10-01T08:00:00.000Z', 'updated_at', '2026-10-01T08:00:00.000Z')),
    'terms', jsonb_build_array(jsonb_build_object(
      'id', 'a0000000-0000-4000-8000-000000000003',
      'file_id', 'a0000000-0000-4000-8000-000000000002', 'word', 'apple', 'word_key', 'apple',
      'part_of_speech', 'noun', 'meaning', 'quả táo', 'example', null,
      'created_at', '2026-10-01T08:00:00.000Z', 'updated_at', '2026-10-01T08:00:00.000Z')),
    'progress', jsonb_build_array(jsonb_build_object(
      'term_id', 'a0000000-0000-4000-8000-000000000003', 'box', 3, 'correct_count', 4,
      'wrong_count', 1, 'last_wrong_at', '2026-10-03T08:00:00.000Z', 'last_studied_at', null)),
    'study_days', jsonb_build_array(jsonb_build_object(
      'date', '2026-10-03', 'answered_count', 12))
  );
$$;
grant execute on function pg_temp.snapshot() to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- ---- import_snapshot: validation and atomicity ----

select throws_ok($$ select public.import_snapshot(pg_temp.snapshot() - 'study_days') $$,
  '22023', 'Snapshot field "study_days" must be an array', 'every table must be present');
select throws_ok($$
  select public.import_snapshot(jsonb_set(pg_temp.snapshot(), '{progress,0,term_id}',
    '"a0000000-0000-4000-8000-0000000000ff"'))
$$, '23503', null, 'a dangling reference fails the import');
select is_empty($$ select id from public.folders $$,
  'a failed import leaves nothing behind (one transaction)');
select throws_ok($$
  select public.import_snapshot(jsonb_set(pg_temp.snapshot(), '{terms,0}',
    (pg_temp.snapshot() #> '{terms,0}') - 'part_of_speech' || '{"partOfSpeech":"noun"}'))
$$, '22023', null, 'a misspelled key is rejected instead of silently dropped');
select throws_ok($$
  select public.import_snapshot(jsonb_set(pg_temp.snapshot(), '{terms,0}',
    (pg_temp.snapshot() #> '{terms,0}') - 'example'))
$$, '22023', null, 'a missing nullable key is rejected (every column is sent)');
select throws_ok($$
  select public.import_snapshot(jsonb_set(pg_temp.snapshot(), '{folders,0,user_id}',
    '"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"'))
$$, '22023', null, 'a payload cannot carry user_id');
select throws_ok($$
  select public.import_snapshot(jsonb_set(pg_temp.snapshot(), '{study_days,0}', '"2026-10-03"'))
$$, '22023', null, 'every row must be an object');
select throws_ok($$
  select public.import_snapshot(jsonb_set(pg_temp.snapshot(), '{folders,0,name_key}', 'null'))
$$, '23502', null, 'a missing key column fails the import');

-- ---- import_snapshot: success ----

select lives_ok($$ select public.import_snapshot(pg_temp.snapshot()) $$, 'the snapshot imports');
select results_eq(
  $$ select (select count(*) from public.folders), (select count(*) from public.files),
       (select count(*) from public.terms), (select count(*) from public.progress),
       (select count(*) from public.study_days) $$,
  $$ values (1::bigint, 1::bigint, 1::bigint, 1::bigint, 1::bigint) $$,
  'every table got its row'
);
select is(
  (select user_id from public.terms), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'imported rows belong to the caller'
);
select is(
  (select created_at from public.folders), '2026-10-01T08:00:00.123Z'::timestamptz,
  'client timestamps are kept, milliseconds included'
);
select is((select example from public.terms), null, 'an absent optional field becomes null');
select throws_ok($$ select public.import_snapshot(pg_temp.snapshot()) $$,
  'VC001', 'Cloud already has data', 'a second import is refused');

-- ---- export_backup ----

select is(
  public.export_backup() -> 'folders' -> 0 ->> 'name', 'IELTS', 'export returns the rows'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.export_backup()) k),
  array['files', 'folders', 'progress', 'study_days', 'terms'],
  'export has one key per table'
);
select is(
  public.export_backup() -> 'progress' -> 0 -> 'last_studied_at', 'null'::jsonb,
  'export keeps null columns (the client mapper drops them)'
);

-- ---- Another user ----

reset role;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.export_backup(),
  '{"folders":[],"files":[],"terms":[],"progress":[],"study_days":[]}'::jsonb,
  'B''s export does not contain A''s rows'
);
select throws_ok($$ select public.import_snapshot(pg_temp.snapshot()) $$, '23505', null,
  'B cannot reuse A''s ids, so nothing of A is overwritten');
select lives_ok($$
  select public.import_snapshot(
    '{"folders":[],"files":[],"terms":[],"progress":[],"study_days":[
      {"date":"2026-10-04","answered_count":1}]}')
$$, 'an account that has only study days imports');
select throws_ok($$
  select public.import_snapshot(
    '{"folders":[],"files":[],"terms":[],"progress":[],"study_days":[]}')
$$, 'VC001', 'Cloud already has data', 'study days alone count as existing data');

-- ---- Not signed in ----

reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.import_snapshot(pg_temp.snapshot()) $$, '42501',
  'Not signed in', 'import needs a signed-in user even when called with privileges');

select * from finish();
rollback;
