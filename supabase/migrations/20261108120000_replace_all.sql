-- Stage 5: restore a backup over existing data (docs/backup.md, decisions #76-#78).
-- No table or column changes, so running clients are not affected.
create function public.replace_all(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  -- The same key as import_snapshot, so a restore and an import running at the same time take
  -- turns: the later one waits instead of failing with VC001 "Cloud already has data". Not
  -- needed for safety: the deletes stay invisible to others until commit, and any row another
  -- request commits before import_snapshot's emptiness check makes it raise VC001 and roll back.
  -- Transaction-level advisory locks are re-entrant, so import_snapshot below takes it again.
  perform pg_advisory_xact_lock(hashtextextended('import_snapshot:' || uid::text, 0));
  -- Files, terms and progress go with their folder (on delete cascade). The explicit user_id
  -- keeps the intent clear even though RLS already limits rows to the caller.
  delete from public.folders where user_id = uid;
  delete from public.study_days where user_id = uid;
  -- Reused rather than copied, so the column list and its exact-keys check live in one place.
  -- Any error there rolls back the deletes above.
  perform public.import_snapshot(payload);
end;
$$;

revoke all on function public.replace_all(jsonb) from public, anon, authenticated;
grant execute on function public.replace_all(jsonb) to authenticated;
