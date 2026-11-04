-- Stage 3b (file notes + pronunciation): docs/cloud-sync.md#giai-đoạn-3b-ghi-chú--phiên-âm.
-- Same rules as the earlier migrations; no new table or function, so no new grants.

-- Nullable without default, so rows written before this migration stay valid and clients that
-- do not know the columns leave them alone (#34). The limits repeat NOTES_MAX_LENGTH and
-- PRONUNCIATION_MAX_LENGTH in src/domain/schemas.ts; char_length counts code points, never more
-- than the UTF-16 length the domain counts, so this check is never stricter than the app.
alter table public.files add column notes text
  check (char_length(notes) between 1 and 10000);
alter table public.terms add column pronunciation text
  check (char_length(pronunciation) between 1 and 100);

-- min_client_version stays at 2 here: raising it now would lock out the app still deployed until
-- the new code is live, for good if that deploy fails. A later migration raises it (#68).

-- Same as in the stage 3 migration, with notes and pronunciation added to the key lists and
-- inserts. `create or replace` keeps the existing grants.
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
    "files": ["id", "folder_id", "name", "name_key", "notes", "created_at", "updated_at"],
    "terms": ["id", "file_id", "word", "word_key", "part_of_speech", "pronunciation", "meaning",
      "example", "created_at", "updated_at"],
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

  insert into public.files (id, user_id, folder_id, name, name_key, notes, created_at, updated_at)
  select r.id, uid, r.folder_id, r.name, r.name_key, r.notes, r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.files, payload -> 'files') r;

  insert into public.terms (
    id, user_id, file_id, word, word_key, part_of_speech, pronunciation, meaning, example,
    created_at, updated_at
  )
  select r.id, uid, r.file_id, r.word, r.word_key, r.part_of_speech, r.pronunciation, r.meaning,
    r.example, r.created_at, r.updated_at
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
