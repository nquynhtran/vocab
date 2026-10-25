-- Phase 3 (Learn): docs/learn-algorithm.md, docs/cloud-sync.md#giai-đoạn-3-learn.
-- Same rules as the earlier migrations: SECURITY INVOKER, empty search_path, explicit
-- revoke/grant for every new function.

-- The last local day the Leitner box went up: at most one step per day (decision #50).
-- Nullable, so rows written before this migration stay valid (#34).
alter table public.progress add column last_promoted_day date;

-- Clients older than this do not know last_promoted_day (their import payload lacks the key);
-- they reload. CLIENT_VERSION in src/data/clientVersion.ts is raised in the same release.
update public.app_config set min_client_version = 2;

-- Same as in the initial migration, with last_promoted_day added to the progress columns and
-- insert. `create or replace` keeps the existing grants.
create or replace function public.import_snapshot(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  -- The exact keys of each row. jsonb_populate_recordset silently ignores unknown keys and
  -- fills missing ones with null, so a mapper typo ("partOfSpeech") would drop data unnoticed.
  -- No user_id: ownership comes from auth.uid() only.
  -- A migration that adds a column must update this list and the inserts below; until then
  -- a payload carrying the new key is rejected, so the gap fails loudly instead of losing data.
  columns constant jsonb := '{
    "folders": ["id", "name", "name_key", "created_at", "updated_at"],
    "files": ["id", "folder_id", "name", "name_key", "created_at", "updated_at"],
    "terms": ["id", "file_id", "word", "word_key", "part_of_speech", "meaning", "example",
      "created_at", "updated_at"],
    "progress": ["term_id", "box", "correct_count", "wrong_count", "last_wrong_at",
      "last_studied_at", "last_promoted_day"],
    "study_days": ["date", "answered_count"]
  }';
  tbl text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  for tbl in select jsonb_object_keys(columns) loop
    if jsonb_typeof(payload -> tbl) is distinct from 'array' then
      raise exception 'Snapshot field "%" must be an array', tbl using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(payload -> tbl) e
      where case when jsonb_typeof(e) = 'object'
        then (select array_agg(k order by k) from jsonb_object_keys(e) k)
          is distinct from
          (select array_agg(c order by c) from jsonb_array_elements_text(columns -> tbl) c)
        else true end
    ) then
      raise exception 'Every "%" row must have exactly the keys %', tbl, columns -> tbl
        using errcode = '22023';
    end if;
  end loop;

  -- Two concurrent imports would both see an empty account; serialize them per user.
  perform pg_advisory_xact_lock(hashtextextended('import_snapshot:' || uid::text, 0));
  -- Every row hangs off a folder except study days, so these two cover all tables.
  if exists (select 1 from public.folders where user_id = uid)
     or exists (select 1 from public.study_days where user_id = uid) then
    raise exception 'Cloud already has data' using errcode = 'VC001';
  end if;

  insert into public.folders (id, user_id, name, name_key, created_at, updated_at)
  select r.id, uid, r.name, r.name_key, r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.folders, payload -> 'folders') r;

  insert into public.files (id, user_id, folder_id, name, name_key, created_at, updated_at)
  select r.id, uid, r.folder_id, r.name, r.name_key, r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.files, payload -> 'files') r;

  insert into public.terms (
    id, user_id, file_id, word, word_key, part_of_speech, meaning, example,
    created_at, updated_at
  )
  select r.id, uid, r.file_id, r.word, r.word_key, r.part_of_speech, r.meaning, r.example,
    r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.terms, payload -> 'terms') r;

  insert into public.progress (
    user_id, term_id, box, correct_count, wrong_count, last_wrong_at, last_studied_at,
    last_promoted_day
  )
  select uid, r.term_id, r.box, r.correct_count, r.wrong_count, r.last_wrong_at,
    r.last_studied_at, r.last_promoted_day
  from jsonb_populate_recordset(null::public.progress, payload -> 'progress') r;

  insert into public.study_days (user_id, date, answered_count)
  select uid, r.date, r.answered_count
  from jsonb_populate_recordset(null::public.study_days, payload -> 'study_days') r;
end;
$$;

-- One Learn answer (docs/learn-algorithm.md#recordanswer): the same rule as progressAfter in
-- src/domain/learn/progress.ts; change both together. The client sends the intent, never new
-- counts, so two devices cannot overwrite each other's numbers.
-- One statement: the progress upsert skips a row whose last_studied_at already equals
-- p_answered_at (a retry, #51), and the study day is counted only when the upsert returned a
-- row. A concurrent duplicate waits for the row lock, re-checks the `where` and does nothing.
-- A term that is missing or someone else's is invisible under RLS, so nothing is inserted.
create function public.record_answer(
  p_term_id uuid,
  p_correct boolean,
  p_promote boolean,
  p_answered_at timestamptz,
  p_day date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_term_id is null or p_correct is null or p_promote is null or p_answered_at is null
     or p_day is null then
    raise exception 'Every argument is required' using errcode = '22023';
  end if;
  if p_promote and not p_correct then
    raise exception 'A wrong answer cannot promote a term' using errcode = '22023';
  end if;

  with answered as (
    insert into public.progress as p (
      user_id, term_id, box, correct_count, wrong_count, last_wrong_at, last_studied_at,
      last_promoted_day
    )
    -- A first answer: box 1 with zero counts, then this answer applied.
    select t.user_id, t.id,
      case when p_promote then 2 else 1 end,
      case when p_correct then 1 else 0 end,
      case when p_correct then 0 else 1 end,
      case when p_correct then null else p_answered_at end,
      p_answered_at,
      case when p_promote then p_day end
    from public.terms t
    where t.id = p_term_id
    on conflict (user_id, term_id) do update set
      box = case
        when not p_correct then 1
        -- "Different day", not "later day": a clock set back must not block it forever (#50).
        when p_promote and p.last_promoted_day is distinct from p_day then least(p.box + 1, 5)
        else p.box
      end,
      correct_count = p.correct_count + case when p_correct then 1 else 0 end,
      wrong_count = p.wrong_count + case when p_correct then 0 else 1 end,
      last_wrong_at = case when p_correct then p.last_wrong_at else p_answered_at end,
      last_studied_at = p_answered_at,
      last_promoted_day = case when p_promote then p_day else p.last_promoted_day end
    where p.last_studied_at is distinct from p_answered_at
    returning p.user_id
  )
  insert into public.study_days as d (user_id, date, answered_count)
  select user_id, p_day, 1 from answered
  on conflict (user_id, date) do update set answered_count = d.answered_count + 1;
exception
  -- The term was deleted between the read and the write: the same no-op as a missing term.
  when foreign_key_violation then
    null;
end;
$$;

-- A file, its terms and their progress, and the word and meaning of every term in the other
-- files of its folder (distractors, decision #54). jsonb so it is not cut at max_rows, one
-- statement so it is one snapshot. null when the file does not exist for the caller.
create function public.get_learn_data(p_file_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'file', to_jsonb(f),
    'terms', coalesce(
      (select jsonb_agg(to_jsonb(t) order by t.id) from public.terms t where t.file_id = f.id),
      '[]'),
    'progress', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.term_id)
       from public.terms t
       join public.progress p on p.term_id = t.id
       where t.file_id = f.id),
      '[]'),
    'distractors', coalesce(
      (select jsonb_agg(jsonb_build_object('word', t.word, 'meaning', t.meaning) order by t.id)
       from public.files x
       join public.terms t on t.file_id = x.id
       where x.folder_id = f.folder_id and x.id <> f.id),
      '[]')
  )
  from public.files f
  where f.id = p_file_id;
$$;

revoke all on function public.record_answer(uuid, boolean, boolean, timestamptz, date),
  public.get_learn_data(uuid)
  from public, anon, authenticated;
grant execute on function public.record_answer(uuid, boolean, boolean, timestamptz, date),
  public.get_learn_data(uuid)
  to authenticated;
