-- Collocations and several parts of speech: the expand step of #90 (docs/cloud-sync.md, stage
-- 3c). Run: npm run test:supabase (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select set_config('request.headers', '{"x-client-version":"4"}', true);
set local role authenticated;

insert into public.folders (id, name, name_key, created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000001', 'IELTS', 'ielts', now(), now());
insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Unit 1', 'unit 1', now(), now()),
  ('c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'Unit 2', 'unit 2', now(), now());

-- A word with two parts of speech, written as a current client writes it.
insert into public.terms (id, file_id, word, word_key, kind, parts_of_speech, meaning,
  created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002',
   'present', 'present', 'word', array['noun', 'adjective'], 'hiện tại', now(), now());
-- A word written as an older client writes it: part_of_speech only, no list.
insert into public.terms (id, file_id, word, word_key, part_of_speech, meaning,
  created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002',
   'run', 'run', 'verb', 'chạy', now(), now());
-- Collocations, one with progress left over from when it was a word.
insert into public.terms (id, file_id, word, word_key, kind, parts_of_speech, meaning,
  created_at, updated_at) values
  ('c0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002',
   'take away', 'take away', 'collocation', '{}', 'lấy đi', now(), now()),
  ('c0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000003',
   'phrase elsewhere', 'phrase elsewhere', 'collocation', '{}', 'cụm khác', now(), now());
insert into public.progress (user_id, term_id, box, correct_count, wrong_count, last_studied_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c0000000-0000-4000-8000-000000000013', 5, 3, 0,
   '2026-10-20T09:00:00.000Z');

-- ---- the list and the old column (the trigger keeps them equal) ----

select is((select part_of_speech from public.terms where id = 'c0000000-0000-4000-8000-000000000011'),
  'noun', 'the old column carries the first part of the list');
select is((select parts_of_speech from public.terms where id = 'c0000000-0000-4000-8000-000000000012'),
  array['verb'], 'an insert from an older client becomes a list of one');
select is((select part_of_speech from public.terms where id = 'c0000000-0000-4000-8000-000000000012'),
  'verb', 'and keeps the value it sent');
select is((select kind from public.terms where id = 'c0000000-0000-4000-8000-000000000012'),
  'word', 'a term without a kind is a word');

-- A later change of the list moves the old column with it.
update public.terms set parts_of_speech = array['adjective', 'noun']
  where id = 'c0000000-0000-4000-8000-000000000011';
select is((select part_of_speech from public.terms where id = 'c0000000-0000-4000-8000-000000000011'),
  'adjective', 'changing the list moves the old column');
-- An older client that writes only the old column leaves the list alone (#90 window).
update public.terms set part_of_speech = 'noun'
  where id = 'c0000000-0000-4000-8000-000000000011';
select is((select parts_of_speech from public.terms where id = 'c0000000-0000-4000-8000-000000000011'),
  array['adjective', 'noun'], 'an update that does not touch the list keeps it');
update public.terms set parts_of_speech = '{}'
  where id = 'c0000000-0000-4000-8000-000000000011';
select is((select part_of_speech from public.terms where id = 'c0000000-0000-4000-8000-000000000011'),
  null::text, 'an empty list leaves the old column empty');

-- ---- the checks refuse bad lists and kinds ----

select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, parts_of_speech, meaning, created_at, updated_at)
  values ('c0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000002',
    'x', 'x', array['noun', 'noun'], 'x', now(), now())
$$, '23514', null, 'a repeated part of speech is refused');
select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, parts_of_speech, meaning, created_at, updated_at)
  values ('c0000000-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000002',
    'x', 'x', array['verbs'], 'x', now(), now())
$$, '23514', null, 'a value outside the list is refused');
select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, parts_of_speech, meaning, created_at, updated_at)
  values ('c0000000-0000-4000-8000-000000000023', 'c0000000-0000-4000-8000-000000000002',
    'x', 'x', array[null]::text[], 'x', now(), now())
$$, '23514', null, 'a null entry is refused (a CHECK would let NULL pass)');
select throws_ok($$
  insert into public.terms (id, file_id, word, word_key, kind, meaning, created_at, updated_at)
  values ('c0000000-0000-4000-8000-000000000024', 'c0000000-0000-4000-8000-000000000002',
    'x', 'x', 'idiom', 'x', now(), now())
$$, '23514', null, 'an unknown kind is refused');

-- ---- Learn never sees a collocation ----

select is(
  (select count(*) from jsonb_array_elements(
     public.get_learn_data('c0000000-0000-4000-8000-000000000002') -> 'terms') e
   where e ->> 'id' = 'c0000000-0000-4000-8000-000000000013'),
  0::bigint, 'get_learn_data leaves the collocation out of the terms');
select is(
  (select count(*) from jsonb_array_elements(
     public.get_learn_data('c0000000-0000-4000-8000-000000000002') -> 'progress') e
   where e ->> 'term_id' = 'c0000000-0000-4000-8000-000000000013'),
  0::bigint, 'and its progress');
select is(
  (select count(*) from jsonb_array_elements(
     public.get_learn_data('c0000000-0000-4000-8000-000000000002') -> 'distractors') e
   where e ->> 'word' = 'phrase elsewhere'),
  0::bigint, 'and it never becomes a distractor in the folder');

-- ---- a refused answer writes nothing ----

select throws_ok($$
  select public.record_answer('c0000000-0000-4000-8000-000000000013', true, false,
    '2026-10-25T09:00:00.123Z', '2026-10-25')
$$, 'VC002', null, 'record_answer refuses a collocation');
select is((select correct_count from public.progress
  where term_id = 'c0000000-0000-4000-8000-000000000013'), 3,
  'and the progress it had is untouched');
select is((select count(*) from public.study_days), 0::bigint,
  'and no study day is created');

-- ---- the folder counts carry the kind ----

select is(
  (select count(*) from jsonb_array_elements(
     public.get_folder_contents('c0000000-0000-4000-8000-000000000001') -> 'terms') e
   where e ->> 'kind' = 'collocation'),
  2::bigint, 'get_folder_contents tells the client which terms are collocations');

select * from finish();
rollback;
