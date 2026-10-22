-- Reads whose row count is unbounded in practice (phase 7, docs/cloud-sync.md). PostgREST cuts
-- every select at `max_rows` (1000) without an error, embedded resources included, so a folder
-- with 1001 terms would silently show wrong counts. A function returning one jsonb value is
-- not cut, and its single statement reads one snapshot.
-- Same rules as the initial migration: SECURITY INVOKER so RLS applies, empty search_path,
-- explicit revoke/grant. Rows are returned as table rows (snake_case, with user_id and keys);
-- the client mapper drops what the domain does not know and validates the rest (#35).

-- Every term of one file. Empty for a missing file, or one that belongs to someone else.
create function public.list_terms(p_file_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]')
  from public.terms t
  where t.file_id = p_file_id;
$$;

-- A folder, its files, and per term only what the counts need: its file and Leitner box (null
-- when never studied). Whether a box counts as mastered is decided by the client (isMastered),
-- so that rule lives in one place. null when the folder does not exist for the caller.
create function public.get_folder_contents(p_folder_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'folder', to_jsonb(f),
    'files', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.id) from public.files x where x.folder_id = f.id),
      '[]'),
    'terms', coalesce(
      (select jsonb_agg(jsonb_build_object('file_id', t.file_id, 'box', p.box) order by t.id)
       from public.files x
       join public.terms t on t.file_id = x.id
       left join public.progress p on p.term_id = t.id
       where x.folder_id = f.id),
      '[]')
  )
  from public.folders f
  where f.id = p_folder_id;
$$;

revoke all on function public.list_terms(uuid), public.get_folder_contents(uuid)
  from public, anon, authenticated;
grant execute on function public.list_terms(uuid), public.get_folder_contents(uuid)
  to authenticated;
