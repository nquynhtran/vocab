-- Stage 3c, step B (#68, docs/cloud-sync.md): raise the minimum to 4 and refuse writes to terms
-- from older builds. NOT in supabase/migrations yet: it moves there only after client 4 is live
-- (CI green, Pages deployed), so a failed deploy never locks out the app still online.

-- Refuses an insert or update of a term unless the request says it comes from client 4 or newer.
-- The client sends its version in X-Client-Version (src/data/supabaseClient.ts). Only the role
-- "authenticated" is an app request: migrations and admin sessions are not clients, so they pass.
-- This is a compatibility gate for tabs left open on an old build, not a security control: the
-- header is set by the caller.
create function public.terms_require_current_client()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  minimum integer := (select min_client_version from public.app_config);
  sent text := current_setting('request.headers', true)::json ->> 'x-client-version';
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if sent is null or sent !~ '^[0-9]{1,9}$' or sent::integer < minimum then
    raise exception 'A new version is available. Reload the page to update the app.'
      using errcode = 'VC003';
  end if;
  return new;
end;
$$;

revoke all on function public.terms_require_current_client() from public, anon;
grant execute on function public.terms_require_current_client() to authenticated;

create trigger terms_require_current_client
  before insert or update on public.terms
  for each row execute function public.terms_require_current_client();

update public.app_config set min_client_version = 4;
