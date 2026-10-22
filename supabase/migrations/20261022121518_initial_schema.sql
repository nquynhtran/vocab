-- Initial cloud schema (phase 7). Rules: docs/cloud-sync.md, constraints: docs/data-model.md.
-- Never edit this file once it has been applied to the cloud project (`supabase db push`);
-- add a new migration instead.
--
-- Conventions:
-- * `id`, `created_at`, `updated_at` come from the client (kept as-is when local data is
--   uploaded), so there is no `default now()` and no `updated_at` trigger.
-- * `name_key` / `word_key` are `toKey(...)` computed by the client. Postgres `lower()` and
--   regex classes differ from JS, so duplicates are never decided by an expression index here.
-- * CHECK constraints are a safety net only: the client validates every row it reads (#35).
-- * Foreign keys include `user_id`. Postgres checks foreign keys without RLS, so a plain
--   `folder_id` key would let one user attach rows to another user's folder.
-- * Constraint names are part of the client contract: `*_name_key_unique` maps to
--   DuplicateNameError, so do not rename them.

-- ---- Tables ----

create table public.folders (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  name_key text not null check (name_key <> ''),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint folders_user_id_id_unique unique (user_id, id),
  constraint folders_name_key_unique unique (user_id, name_key)
);

create table public.files (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  name_key text not null check (name_key <> ''),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint files_user_id_id_unique unique (user_id, id),
  -- Also serves lookups by folder: (user_id, folder_id) is its prefix.
  constraint files_name_key_unique unique (user_id, folder_id, name_key),
  constraint files_folder_fkey foreign key (user_id, folder_id)
    references public.folders (user_id, id) on delete cascade
);

create table public.terms (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_id uuid not null,
  word text not null check (char_length(word) between 1 and 200),
  word_key text not null check (word_key <> ''),
  -- Same list as PARTS_OF_SPEECH in src/domain/schemas.ts; changing it needs a migration here.
  part_of_speech text check (
    part_of_speech in (
      'noun', 'verb', 'adjective', 'adverb', 'phrasal verb', 'phrase',
      'preposition', 'conjunction', 'pronoun', 'other'
    )
  ),
  meaning text not null check (char_length(meaning) between 1 and 200),
  example text check (char_length(example) between 1 and 500),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint terms_user_id_id_unique unique (user_id, id),
  constraint terms_file_fkey foreign key (user_id, file_id)
    references public.files (user_id, id) on delete cascade
);

create index terms_file_idx on public.terms (user_id, file_id);
-- Duplicate warnings only, so not unique: the same word may live in several files.
create index terms_word_key_idx on public.terms (user_id, word_key);

create table public.progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  term_id uuid not null,
  box smallint not null check (box between 1 and 5),
  correct_count integer not null check (correct_count >= 0),
  wrong_count integer not null check (wrong_count >= 0),
  last_wrong_at timestamptz,
  last_studied_at timestamptz,
  primary key (user_id, term_id),
  constraint progress_term_fkey foreign key (user_id, term_id)
    references public.terms (user_id, id) on delete cascade
);

create table public.study_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Local calendar day of the device that answered (docs/streak.md), not a UTC instant.
  date date not null,
  answered_count integer not null check (answered_count >= 0),
  primary key (user_id, date)
);

-- Lowest client version allowed to keep running; older clients reload (#34). Exactly one row.
create table public.app_config (
  id boolean primary key default true check (id),
  min_client_version integer not null check (min_client_version >= 1)
);

insert into public.app_config (min_client_version) values (1);

-- ---- Privileges ----
-- Local Supabase grants everything to anon and authenticated by default, while the cloud
-- project has auto-expose turned off. Revoke and grant explicitly so both behave the same.

revoke all on public.folders, public.files, public.terms, public.progress, public.study_days,
  public.app_config from anon, authenticated;

grant select, insert, update, delete
  on public.folders, public.files, public.terms, public.progress, public.study_days
  to authenticated;
grant select on public.app_config to authenticated;

-- ---- Row Level Security ----
-- All four policies per table: without `select`, `update ... returning` finds no row and the
-- client would report "no longer exists".

alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.terms enable row level security;
alter table public.progress enable row level security;
alter table public.study_days enable row level security;
alter table public.app_config enable row level security;

create policy folders_select on public.folders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy folders_insert on public.folders for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy folders_update on public.folders for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy folders_delete on public.folders for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy files_select on public.files for select to authenticated
  using ((select auth.uid()) = user_id);
create policy files_insert on public.files for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy files_update on public.files for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy files_delete on public.files for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy terms_select on public.terms for select to authenticated
  using ((select auth.uid()) = user_id);
create policy terms_insert on public.terms for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy terms_update on public.terms for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy terms_delete on public.terms for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy progress_select on public.progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy progress_insert on public.progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy progress_update on public.progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy progress_delete on public.progress for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy study_days_select on public.study_days for select to authenticated
  using ((select auth.uid()) = user_id);
create policy study_days_insert on public.study_days for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy study_days_update on public.study_days for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy study_days_delete on public.study_days for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy app_config_select on public.app_config for select to authenticated
  using (true);

-- ---- Functions ----
-- SECURITY INVOKER so RLS still applies; `user_id` always comes from auth.uid(), never from
-- the payload. Empty search_path so every name is resolved exactly as written.

-- Uploads the local data once (#33), in one transaction. Rows are snake_case table rows with
-- name_key/word_key filled in by the client and every column present (null when unset), as in
-- other writes (#34). Refuses when the account already has data, so a second click cannot
-- duplicate anything. "Replace all" (phase 5) needs its own RPC that deletes and inserts in one
-- transaction; calling this after a separate delete would lose data when the import fails.
create function public.import_snapshot(payload jsonb)
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
      "last_studied_at"],
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
    user_id, term_id, box, correct_count, wrong_count, last_wrong_at, last_studied_at
  )
  select uid, r.term_id, r.box, r.correct_count, r.wrong_count, r.last_wrong_at,
    r.last_studied_at
  from jsonb_populate_recordset(null::public.progress, payload -> 'progress') r;

  insert into public.study_days (user_id, date, answered_count)
  select uid, r.date, r.answered_count
  from jsonb_populate_recordset(null::public.study_days, payload -> 'study_days') r;
end;
$$;

-- Every row the caller owns (RLS filters), as snake_case table rows. A single statement on
-- purpose: it reads all tables from one snapshot, so a backup never mixes the states before
-- and after a write from another device.
create function public.export_backup()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'folders', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.folders t), '[]'),
    'files', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.files t), '[]'),
    'terms', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.terms t), '[]'),
    'progress',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.term_id) from public.progress t), '[]'),
    'study_days',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.date) from public.study_days t), '[]')
  );
$$;

revoke all on function public.import_snapshot(jsonb), public.export_backup()
  from public, anon, authenticated;
grant execute on function public.import_snapshot(jsonb), public.export_backup()
  to authenticated;
