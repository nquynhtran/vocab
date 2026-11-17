-- Stage 3c: a term can be a collocation that is not learned, and can have several parts of
-- speech (#90, docs/cloud-sync.md). This is the EXPAND step: the new columns sit beside
-- part_of_speech, which older clients still read. Dropping part_of_speech is a later migration,
-- once no client older than 4 is left. Client 4 (which sends its X-Client-Version header) is
-- deployed before migration B (the write gate).

-- The allowed parts of speech. A function because a CHECK cannot contain a subquery. Must equal
-- PARTS_OF_SPEECH in src/domain/schemas.ts; a test keeps the two equal.
create function public.parts_of_speech_valid(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
    and not exists (
      select 1 from unnest(p) as x(v)
      where x.v is null
        or x.v <> all (array['noun', 'verb', 'adjective', 'adverb', 'phrasal verb', 'phrase',
          'preposition', 'conjunction', 'pronoun', 'other']::text[])
    )
    and not exists (
      select 1
      from unnest(p) with ordinality as a(v, i)
      join unnest(p) with ordinality as b(v, j) on a.v = b.v and a.i < b.j
    );
$$;

-- Not callable by anon: a CHECK runs with the privileges of the writer, so only authenticated
-- (and the owner) get EXECUTE.
revoke all on function public.parts_of_speech_valid(text[]) from public, anon;
grant execute on function public.parts_of_speech_valid(text[]) to authenticated;

alter table public.terms
  add column kind text not null default 'word'
    constraint terms_kind_check check (kind in ('word', 'collocation')),
  add column parts_of_speech text[] not null default '{}'
    constraint terms_parts_of_speech_check check (public.parts_of_speech_valid(parts_of_speech));

-- Copy before the trigger exists: the trigger below would otherwise overwrite part_of_speech.
update public.terms
set parts_of_speech = case when part_of_speech is null then '{}' else array[part_of_speech] end;

-- Keeps part_of_speech equal to the first entry of parts_of_speech, for older clients to read.
-- parts_of_speech is the truth. An insert from an older client carries only part_of_speech, so
-- that value becomes the list. An update that leaves the list alone keeps the column as sent:
-- deriving it again would undo an older client's write.
create function public.terms_sync_part_of_speech()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and cardinality(new.parts_of_speech) = 0
     and new.part_of_speech is not null then
    new.parts_of_speech := array[new.part_of_speech];
  end if;
  if tg_op = 'INSERT' or new.parts_of_speech is distinct from old.parts_of_speech then
    new.part_of_speech := new.parts_of_speech[1];
  end if;
  return new;
end;
$$;

revoke all on function public.terms_sync_part_of_speech() from public, anon;
grant execute on function public.terms_sync_part_of_speech() to authenticated;

create trigger terms_sync_part_of_speech
  before insert or update on public.terms
  for each row execute function public.terms_sync_part_of_speech();

-- Same contract as before, with the new columns. Rows are still read whole (to_jsonb) so the
-- client mapper decides what it keeps.
create or replace function public.import_snapshot(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  -- The exact keys of each row. jsonb_populate_recordset silently ignores unknown keys and
  -- fills missing ones with null, so a mapper typo would drop data unnoticed. No user_id:
  -- ownership comes from auth.uid() only. A row from an older client still carries
  -- part_of_speech and no parts_of_speech, so it is rejected loudly (the trigger fills it).
  columns constant jsonb := '{
    "folders": ["id", "name", "name_key", "created_at", "updated_at"],
    "files": ["id", "folder_id", "name", "name_key", "notes", "created_at", "updated_at"],
    "terms": ["id", "file_id", "word", "word_key", "kind", "parts_of_speech", "pronunciation",
      "meaning", "example", "created_at", "updated_at"],
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
    id, user_id, file_id, word, word_key, kind, parts_of_speech, pronunciation, meaning, example,
    created_at, updated_at
  )
  select r.id, uid, r.file_id, r.word, r.word_key, r.kind, r.parts_of_speech, r.pronunciation,
    r.meaning, r.example, r.created_at, r.updated_at
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

-- A folder, its files, and per term only what the counts need: its file, kind and Leitner box
-- (null when never studied). Whether a box counts as mastered is decided by the client
-- (isMastered), so that rule lives in one place. null when the folder does not exist for the caller.
create or replace function public.get_folder_contents(p_folder_id uuid)
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
      (select jsonb_agg(
          jsonb_build_object('file_id', t.file_id, 'kind', t.kind, 'box', p.box) order by t.id)
       from public.files x
       join public.terms t on t.file_id = x.id
       left join public.progress p on p.term_id = t.id
       where x.folder_id = f.id),
      '[]')
  )
  from public.folders f
  where f.id = p_folder_id;
$$;

-- Only learnable terms (kind = 'word') reach Learn: the file's terms, their progress, and the
-- distractors (#90). The client applies the same rule (isLearnable); a test keeps them equal.
create or replace function public.get_learn_data(p_file_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'file', to_jsonb(f),
    'terms', coalesce(
      (select jsonb_agg(to_jsonb(t) order by t.id)
       from public.terms t where t.file_id = f.id and t.kind = 'word'),
      '[]'),
    'progress', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.term_id)
       from public.terms t
       join public.progress p on p.term_id = t.id
       where t.file_id = f.id and t.kind = 'word'),
      '[]'),
    'distractors', coalesce(
      (select jsonb_agg(jsonb_build_object('word', t.word, 'meaning', t.meaning) order by t.id)
       from public.files x
       join public.terms t on t.file_id = x.id
       where x.folder_id = f.folder_id and x.id <> f.id and t.kind = 'word'),
      '[]')
  )
  from public.files f
  where f.id = p_file_id;
$$;

-- Same rule as before; a collocation is refused before anything is written (#90). A missing
-- term stays the same no-op as before.
create or replace function public.record_answer(
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
  if exists (select 1 from public.terms t where t.id = p_term_id and t.kind <> 'word') then
    raise exception 'This entry is not learned' using errcode = 'VC002';
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
