-- Study days for the streak on Home (docs/streak.md). An RPC, not a select: this list gains a row
-- per studied day and nothing ever deletes one, so a select would hit max_rows after ~2.7 years
-- (decision #73). No table or column changes, so running clients are not affected.
create function public.list_study_days()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('date', d.date, 'answered_count', d.answered_count) order by d.date
    ),
    '[]'
  )
  from public.study_days d;
$$;

revoke all on function public.list_study_days() from public, anon, authenticated;
grant execute on function public.list_study_days() to authenticated;
