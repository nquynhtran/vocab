-- record_answer and get_learn_data. Run: npm run test:supabase (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local', 'authenticated', 'authenticated');

-- Deletes the term just before its progress row is inserted, so the foreign key fails at the
-- end of the statement: the same as a delete from another device landing mid-write.
-- Created as the owner, attached only for the one test that needs it.
create function pg_temp.delete_term_first() returns trigger language plpgsql as $$
begin
  delete from public.terms where id = new.term_id;
  return new;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- Folder 1: file 2 (terms 11, 12) and file 3 (term 13). Folder 4: file 5 (term 14).
-- File 6 in folder 1 has 1001 terms, more than max_rows.
insert into public.folders (id, name, name_key, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000001', 'IELTS', 'ielts', now(), now()),
  ('a0000000-0000-4000-8000-000000000004', 'TOEIC', 'toeic', now(), now());
insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Unit 1', 'unit 1', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Unit 2', 'unit 2', now(), now()),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004',
   'Unit 1', 'unit 1', now(), now()),
  ('a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Big', 'big', now(), now());
insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002',
   'run', 'run', 'chạy', now(), now()),
  ('a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000002',
   'walk', 'walk', 'đi bộ', now(), now()),
  ('a0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000003',
   'jump', 'jump', 'nhảy', now(), now()),
  ('a0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000005',
   'swim', 'swim', 'bơi', now(), now());
insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at)
select gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', 'w' || n, 'w' || n, 'm',
  now(), now()
from generate_series(1, 1001) n;

create function pg_temp.progress_of(p_term_id uuid)
returns table (box smallint, correct_count integer, wrong_count integer,
  last_wrong_at timestamptz, last_studied_at timestamptz, last_promoted_day date)
language sql as $$
  select box, correct_count, wrong_count, last_wrong_at, last_studied_at, last_promoted_day
  from public.progress where term_id = p_term_id
$$;

-- ---- record_answer: a first answer ----

select lives_ok($$
  select public.record_answer('a0000000-0000-4000-8000-000000000011', true, false,
    '2026-10-25T09:00:00.123Z', '2026-10-25')
$$, 'a first answer is recorded');
select results_eq(
  $$ select * from pg_temp.progress_of('a0000000-0000-4000-8000-000000000011') $$,
  $$ values (1::smallint, 1, 0, null::timestamptz, '2026-10-25T09:00:00.123Z'::timestamptz,
       null::date) $$,
  'a new row starts in box 1 with zero counts, then takes the answer'
);
select is(
  (select user_id from public.progress), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'the row belongs to the caller'
);
select results_eq(
  $$ select date, answered_count from public.study_days $$,
  $$ values ('2026-10-25'::date, 1) $$,
  'the study day is created'
);

-- ---- Retry ----

select public.record_answer('a0000000-0000-4000-8000-000000000011', true, false,
  '2026-10-25T09:00:00.123Z', '2026-10-25');
select results_eq(
  $$ select correct_count from public.progress $$, $$ values (1) $$,
  'the same answer sent again does not count twice'
);
select results_eq(
  $$ select answered_count from public.study_days $$, $$ values (1) $$,
  'nor does it count for the study day'
);

-- ---- Promotion ----

select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-25T09:01:00Z', '2026-10-25');
select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-25T09:02:00Z', '2026-10-25');
select results_eq(
  $$ select box, correct_count, last_promoted_day from public.progress $$,
  $$ values (2::smallint, 3, '2026-10-25'::date) $$,
  'two promotions on the same day go up one box, both answers still count'
);
select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-26T09:00:00Z', '2026-10-26');
select results_eq(
  $$ select box, last_promoted_day from public.progress $$,
  $$ values (3::smallint, '2026-10-26'::date) $$,
  'a promotion on another day goes up again'
);
select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-27T09:00:00Z', '2026-10-27');
select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-28T09:00:00Z', '2026-10-28');
select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-29T09:00:00Z', '2026-10-29');
select results_eq(
  $$ select box, last_promoted_day from public.progress $$,
  $$ values (5::smallint, '2026-10-29'::date) $$,
  'the box stops at 5'
);
select public.record_answer('a0000000-0000-4000-8000-000000000011', true, true,
  '2026-10-30T09:00:00Z', '2026-10-01');
select results_eq(
  $$ select box, last_promoted_day from public.progress $$,
  $$ values (5::smallint, '2026-10-01'::date) $$,
  'an earlier day still counts as another day (clock set back, #50)'
);

-- ---- A wrong answer ----

select public.record_answer('a0000000-0000-4000-8000-000000000011', false, false,
  '2026-10-30T10:00:00Z', '2026-10-30');
select results_eq(
  $$ select * from pg_temp.progress_of('a0000000-0000-4000-8000-000000000011') $$,
  $$ values (1::smallint, 8, 1, '2026-10-30T10:00:00Z'::timestamptz,
       '2026-10-30T10:00:00Z'::timestamptz, '2026-10-01'::date) $$,
  'a wrong answer goes back to box 1, keeping the last promotion day'
);
select public.record_answer('a0000000-0000-4000-8000-000000000012', false, false,
  '2026-10-30T10:01:00Z', '2026-10-30');
select results_eq(
  $$ select * from pg_temp.progress_of('a0000000-0000-4000-8000-000000000012') $$,
  $$ values (1::smallint, 0, 1, '2026-10-30T10:01:00Z'::timestamptz,
       '2026-10-30T10:01:00Z'::timestamptz, null::date) $$,
  'a wrong first answer starts a row with one mistake'
);
select results_eq(
  $$ select answered_count from public.study_days where date = '2026-10-30' $$,
  $$ values (2) $$,
  'answers add up on their study day, across terms'
);
select results_eq(
  $$ select count(*) from public.study_days $$, $$ values (7::bigint) $$,
  'each day has its own row'
);

-- ---- Refused or ignored ----

select throws_ok($$
  select public.record_answer('a0000000-0000-4000-8000-000000000013', false, true,
    '2026-10-30T11:00:00Z', '2026-10-30')
$$, '22023', 'A wrong answer cannot promote a term', 'a wrong answer that promotes is refused');
select throws_ok($$
  select public.record_answer('a0000000-0000-4000-8000-000000000013', true, false,
    '2026-10-30T11:00:00Z', null)
$$, '22023', 'Every argument is required', 'a missing argument is refused');
select is_empty(
  $$ select 1 from public.progress where term_id = 'a0000000-0000-4000-8000-000000000013' $$,
  'a refused answer writes nothing'
);

select lives_ok($$
  select public.record_answer('a0000000-0000-4000-8000-0000000000ff', true, false,
    '2026-10-31T09:00:00Z', '2026-10-31')
$$, 'a missing term is not an error');

reset role;
create trigger delete_term_first before insert on public.progress
  for each row execute function pg_temp.delete_term_first();
set local role authenticated;
select lives_ok($$
  select public.record_answer('a0000000-0000-4000-8000-000000000013', true, false,
    '2026-10-31T09:00:00Z', '2026-10-31')
$$, 'a term deleted while the answer is written is not an error');
reset role;
drop trigger delete_term_first on public.progress;
set local role authenticated;
select is_empty(
  $$ select 1 from public.progress where term_id = 'a0000000-0000-4000-8000-000000000013' $$,
  'the deleted term gets no progress'
);
select is_empty(
  $$ select 1 from public.study_days where date = '2026-10-31' $$,
  'neither a missing nor a just deleted term counts for the study day'
);

-- ---- get_learn_data ----

select is(
  public.get_learn_data('a0000000-0000-4000-8000-0000000000ff'), null,
  'a missing file gives null'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
    public.get_learn_data('a0000000-0000-4000-8000-000000000002')) k),
  array['distractors', 'file', 'progress', 'terms'],
  'the result has the file, its terms, their progress and the distractors'
);
select is(
  public.get_learn_data('a0000000-0000-4000-8000-000000000002') -> 'file' ->> 'name',
  'Unit 1', 'the file row is included'
);
select results_eq(
  $$ select t ->> 'word' from jsonb_array_elements(
       public.get_learn_data('a0000000-0000-4000-8000-000000000002') -> 'terms') t
     order by 1 $$,
  $$ values ('run'), ('walk') $$,
  'only the file''s own terms'
);
select results_eq(
  $$ select p ->> 'term_id', p ->> 'last_promoted_day' from jsonb_array_elements(
       public.get_learn_data('a0000000-0000-4000-8000-000000000002') -> 'progress') p
     order by 1 $$,
  $$ values ('a0000000-0000-4000-8000-000000000011', '2026-10-01'),
            ('a0000000-0000-4000-8000-000000000012', null) $$,
  'progress of the file''s terms, with every column'
);
select is(
  public.get_learn_data('a0000000-0000-4000-8000-000000000003') -> 'progress', '[]'::jsonb,
  'a file never studied has no progress'
);
select is(
  jsonb_array_length(
    public.get_learn_data('a0000000-0000-4000-8000-000000000002') -> 'distractors'), 1002,
  'distractors cover every other file of the folder, beyond max_rows'
);
select is_empty(
  $$ select 1 from jsonb_array_elements(
       public.get_learn_data('a0000000-0000-4000-8000-000000000002') -> 'distractors') d
     where d ->> 'word' in ('run', 'walk', 'swim') $$,
  'distractors leave out the file itself and other folders'
);
select results_eq(
  $$ select d from jsonb_array_elements(
       public.get_learn_data('a0000000-0000-4000-8000-000000000003') -> 'distractors') d
     where d ->> 'word' = 'run' $$,
  $$ values ('{"word": "run", "meaning": "chạy"}'::jsonb) $$,
  'a distractor carries only the word and the meaning'
);
select is(
  jsonb_array_length(
    public.get_learn_data('a0000000-0000-4000-8000-000000000006') -> 'terms'), 1001,
  'terms are not cut at max_rows'
);

-- ---- Another user ----

reset role;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.get_learn_data('a0000000-0000-4000-8000-000000000002'), null,
  'B cannot read A''s file'
);
select lives_ok($$
  select public.record_answer('a0000000-0000-4000-8000-000000000014', false, false,
    '2026-11-01T09:00:00Z', '2026-11-01')
$$, 'answering A''s term is not an error for B');
select is_empty($$ select 1 from public.study_days $$, 'B gets no study day for it');

reset role;
select results_eq(
  $$ select count(*) from public.progress
     where term_id = 'a0000000-0000-4000-8000-000000000014' $$,
  $$ values (0::bigint) $$,
  'A''s term gets no progress from B'
);
select results_eq(
  $$ select count(*) from public.study_days where date = '2026-11-01' $$,
  $$ values (0::bigint) $$,
  'nobody gets a study day for it'
);

select * from finish();
rollback;
