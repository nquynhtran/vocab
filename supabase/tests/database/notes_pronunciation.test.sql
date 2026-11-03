-- Stage 3b columns: files.notes and terms.pronunciation. Run: npm run test:supabase (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated');
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

insert into public.folders (id, name, name_key, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000001', 'IELTS', 'ielts', now(), now());
insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Unit 1', 'unit 1', now(), now());
insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'run', 'run', 'chạy', now(), now());

select is((select notes from public.files), null, 'a file created without notes has none');
select is((select pronunciation from public.terms), null,
  'a term created without pronunciation has none');

-- ---- notes: 1..10000 characters (NOTES_MAX_LENGTH) ----
select lives_ok($$ update public.files set notes = repeat('a', 10000) $$,
  'notes of 10000 characters are accepted');
-- char_length counts code points: 10000 Vietnamese letters or emoji are still within the limit.
select lives_ok($$ update public.files set notes = repeat('ệ', 10000) $$,
  'the limit counts characters, not bytes');
select lives_ok($$ update public.files set notes = repeat('😀', 5000) $$,
  'emoji (two UTF-16 units each, as the app counts them) fit');
select throws_ok($$ update public.files set notes = repeat('a', 10001) $$, '23514', null,
  'notes over 10000 characters are rejected');
select throws_ok($$ update public.files set notes = '' $$, '23514', null,
  'empty notes are rejected (blank is stored as null)');
select lives_ok($$ update public.files set notes = null $$, 'notes can be removed');

-- ---- pronunciation: 1..100 characters (PRONUNCIATION_MAX_LENGTH) ----
select lives_ok($$ update public.terms set pronunciation = repeat('ə', 100) $$,
  'a pronunciation of 100 characters is accepted');
select throws_ok($$ update public.terms set pronunciation = repeat('ə', 101) $$, '23514', null,
  'a pronunciation over 100 characters is rejected');
select throws_ok($$ update public.terms set pronunciation = '' $$, '23514', null,
  'an empty pronunciation is rejected (blank is stored as null)');

-- ---- an older client's update leaves the new columns alone (#34) ----
update public.files set notes = 'Kept';
update public.terms set pronunciation = '/rʌn/';
update public.files set name = 'Unit 1a', name_key = 'unit 1a', updated_at = now();
update public.terms set word = 'Run', word_key = 'run', part_of_speech = null, meaning = 'chạy',
  example = null, updated_at = now();
select is((select notes from public.files), 'Kept', 'a rename keeps the notes');
select is((select pronunciation from public.terms), '/rʌn/',
  'an edit listing only the old columns keeps the pronunciation');

select * from finish();
rollback;
