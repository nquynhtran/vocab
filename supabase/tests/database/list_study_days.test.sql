-- list_study_days. Run: npm run test:supabase (needs Docker).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.local', 'authenticated', 'authenticated');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(public.list_study_days(), '[]'::jsonb, 'no study days gives an empty array');

-- Written out of order, and the same date as user B's below.
insert into public.study_days (date, answered_count) values
  ('2026-11-02', 4),
  ('2026-11-01', 12);

select is(
  public.list_study_days(),
  '[{"date": "2026-11-01", "answered_count": 12}, {"date": "2026-11-02", "answered_count": 4}]'::jsonb,
  'oldest first, with only the date and the count (no user_id)'
);

-- ---- User B ----

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

select is(public.list_study_days(), '[]'::jsonb, 'user B does not see the days of user A');

insert into public.study_days (date, answered_count) values ('2026-11-01', 99);

select is(
  public.list_study_days(),
  '[{"date": "2026-11-01", "answered_count": 99}]'::jsonb,
  'the same date for user B is a separate row'
);

-- ---- No limit (max_rows itself only applies over HTTP: the contract suite covers that) ----

insert into public.study_days (date, answered_count)
select date '2020-01-01' + n, 1 from generate_series(0, 1000) n;

select is(
  jsonb_array_length(public.list_study_days()), 1002,
  'list_study_days does not limit the rows it returns'
);

select * from finish();
rollback;
