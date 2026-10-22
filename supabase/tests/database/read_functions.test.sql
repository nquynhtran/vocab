-- list_terms and get_folder_contents. Run: npm run test:supabase (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local', 'authenticated', 'authenticated');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

-- Folder 1 holds file 2 (1001 terms, more than max_rows) and an empty file 3.
insert into public.folders (id, name, name_key, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000001', 'IELTS', 'ielts', now(), now());
insert into public.files (id, folder_id, name, name_key, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Unit 1', 'unit 1', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Unit 2', 'unit 2', now(), now());
insert into public.terms (id, file_id, word, word_key, meaning, created_at, updated_at)
select gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'w' || n, 'w' || n, 'm',
  now(), now()
from generate_series(1, 1001) n;
insert into public.progress (term_id, box, correct_count, wrong_count)
select id, 3, 1, 0 from public.terms order by id limit 2;

-- ---- list_terms ----

select is(
  jsonb_array_length(public.list_terms('a0000000-0000-4000-8000-000000000002')), 1001,
  'list_terms returns more rows than max_rows'
);
select is(
  public.list_terms('a0000000-0000-4000-8000-000000000003'), '[]'::jsonb,
  'an empty file gives an empty array'
);
select is(
  public.list_terms('a0000000-0000-4000-8000-0000000000ff'), '[]'::jsonb,
  'a missing file gives an empty array'
);
select is(
  public.list_terms('a0000000-0000-4000-8000-000000000002') -> 0 -> 'example', 'null'::jsonb,
  'rows keep null columns (the client mapper drops them)'
);

-- ---- get_folder_contents ----

select is(
  public.get_folder_contents('a0000000-0000-4000-8000-0000000000ff'), null,
  'a missing folder gives null'
);
select is(
  public.get_folder_contents('a0000000-0000-4000-8000-000000000001') -> 'folder' ->> 'name',
  'IELTS', 'the folder row is included'
);
select is(
  jsonb_array_length(
    public.get_folder_contents('a0000000-0000-4000-8000-000000000001') -> 'files'), 2,
  'every file is included, empty ones too'
);
select is(
  jsonb_array_length(
    public.get_folder_contents('a0000000-0000-4000-8000-000000000001') -> 'terms'), 1001,
  'every term is included, beyond max_rows'
);
select results_eq(
  $$ select t ->> 'box', count(*)
     from jsonb_array_elements(
       public.get_folder_contents('a0000000-0000-4000-8000-000000000001') -> 'terms') t
     group by 1 order by 1 $$,
  $$ values ('3', 2::bigint), (null, 999::bigint) $$,
  'each term carries its box, null when never studied'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
    public.get_folder_contents('a0000000-0000-4000-8000-000000000001') -> 'terms' -> 0) k),
  array['box', 'file_id'],
  'terms carry only the file and the box'
);

-- ---- Another user ----

reset role;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.list_terms('a0000000-0000-4000-8000-000000000002'), '[]'::jsonb,
  'B cannot list A''s terms'
);
select is(
  public.get_folder_contents('a0000000-0000-4000-8000-000000000001'), null,
  'B cannot read A''s folder'
);

select * from finish();
rollback;
