-- =====================================================================
-- 0005_revoke_anon_and_fix_download_guard.sql
-- Anthrop HRMS — two fixes, found by the verification block in 0004.
--
-- 0004 and 0002 are already applied and are not edited (rule 5). Both
-- functions below are replaced from this file.
--
-- ---------------------------------------------------------------------
-- 1. `revoke ... from public` does not remove anon's grant
-- ---------------------------------------------------------------------
--
-- A Supabase project ships with:
--
--   alter default privileges in schema public
--     grant all on functions to anon, authenticated, service_role;
--
-- So every function created in `public` is granted EXECUTE to `anon` at
-- the moment it is created. `revoke all on function ... from public`
-- removes the PUBLIC pseudo-role's default grant — a different thing —
-- and leaves anon's explicit grant in place.
--
-- 0001 got this right for tables: it says `revoke ... from anon`.
-- 0002 and 0004 both used the weaker idiom for functions, so `anon`
-- currently holds EXECUTE on four functions it should not be able to
-- call at all.
--
-- ---------------------------------------------------------------------
-- 2. public.log_document_download() fails OPEN, not closed
-- ---------------------------------------------------------------------
--
-- This is the serious one, and it is not merely a missing grant.
--
-- app.current_tenant_id() returns NULL for three kinds of caller: an
-- anonymous one, a signed-in one with no profile row, and — this is the
-- one that matters — a **deactivated** one, because that function
-- requires is_active.
--
-- The guard was written as:
--
--   if not ( v_tenant = app.current_tenant_id() and ( ... ) ) then
--     raise exception ...
--
-- With a NULL tenant that evaluates NULL, not false:
--
--   v_tenant = NULL   ->  NULL
--   NULL and (...)    ->  NULL
--   not NULL          ->  NULL
--   if NULL then      ->  treated as false, so the body is SKIPPED
--
-- The exception is never raised. Execution falls through to the audit
-- insert and returns the document's storage path.
--
-- SECURITY DEFINER means no policy is standing behind this to catch it,
-- which is the whole reason the test was written out by hand here.
--
-- What that costs, stated plainly:
--
--   - a caller with no readable tenant learns that a given document id
--     exists, and gets its storage_path;
--   - they write a row into audit_log, a table nobody holds an insert
--     grant on, attributed to a null actor;
--   - it holds for a deactivated employee for as long as their existing
--     access token remains valid, which contradicts the promise that
--     switching an account off revokes access immediately.
--
-- It does not hand over the file. The bucket is private and downloading
-- still needs a signed URL issued under the storage policies, which are
-- unaffected. The leak is the path, the existence, and the false audit
-- row.
--
-- The fix is coalesce(..., false): NULL becomes false, `not false`
-- becomes true, and the exception is raised. The three functions added
-- in 0004 do their filtering in WHERE clauses, where NULL drops the row
-- rather than passing it, so they already fail closed and are not
-- changed here.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Take EXECUTE away from anon, by name.
--
-- `anon` is the unauthenticated visitor on the public landing page. It
-- has no business calling any of these. public.heartbeat() is
-- deliberately absent: 0003 grants it to anon on purpose, so that the
-- keep-alive workflow can reach the database without a privileged key.
-- ---------------------------------------------------------------------

revoke all on function
  public.list_user_accounts(),
  public.clear_password_change_flag(),
  public.departments_managed_by(uuid),
  public.log_document_download(uuid)
  from anon;

-- Belt and braces: also remove the PUBLIC default, which is what the
-- previous migrations were reaching for.
revoke all on function
  public.list_user_accounts(),
  public.clear_password_change_flag(),
  public.departments_managed_by(uuid),
  public.log_document_download(uuid)
  from public;

grant execute on function
  public.list_user_accounts(),
  public.clear_password_change_flag(),
  public.departments_managed_by(uuid),
  public.log_document_download(uuid)
  to authenticated;


-- ---------------------------------------------------------------------
-- 2. Make the download guard fail closed.
--
-- Identical to the version in 0002 apart from the coalesce, so that the
-- diff between them is exactly the defect and nothing else.
-- ---------------------------------------------------------------------

create or replace function public.log_document_download(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_tenant   uuid;
  v_person   uuid;
  v_path     text;
  v_filename text;
begin
  select d.tenant_id, d.person_id, d.storage_path, d.original_filename
    into v_tenant, v_person, v_path, v_filename
    from public.documents d
   where d.id = p_document_id;

  if not found then
    raise exception 'That document is not available.'
      using errcode = 'no_data_found';
  end if;

  -- The same test the documents policies apply. Written out because
  -- SECURITY DEFINER means they are not applied for us here.
  --
  -- coalesce(..., false) is load-bearing. app.current_tenant_id() is
  -- NULL for an anonymous caller, for one with no profile, and for a
  -- deactivated one; without it the whole condition evaluates to NULL,
  -- `if NULL then` is treated as false, and the exception below is
  -- never raised. A permission check that returns NULL must deny.
  if not coalesce(
    v_tenant = app.current_tenant_id()
    and (
      app.current_app_role() in ('owner', 'hr')
      or v_person = app.current_person_id()
    ),
    false
  ) then
    -- Same message as "not found", so this cannot be used to discover
    -- which documents exist for staff outside the caller's reach.
    raise exception 'That document is not available.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_log
    (tenant_id, actor_user_id, action, table_name, record_id, before, after)
  values
    (v_tenant, auth.uid(), 'download', 'documents', p_document_id, null,
     jsonb_build_object('original_filename', v_filename, 'storage_path', v_path));

  return v_path;
end;
$$;

-- The replace re-applies the default privileges, so anon gets its grant
-- back. Take it away again, after.
revoke all on function public.log_document_download(uuid) from anon, public;
grant execute on function public.log_document_download(uuid) to authenticated;

commit;


-- =====================================================================
-- Verification
-- =====================================================================

-- 1. anon can call heartbeat() and nothing else.
select
  'anon may execute ' || f.name as check_name,
  has_function_privilege('anon', f.name, 'execute') as anon_may_execute,
  case
    when f.name = 'public.heartbeat()'
      then case when has_function_privilege('anon', f.name, 'execute')
                then 'correct - deliberate, see 0003' else 'WRONG - keep-alive will break' end
    else case when has_function_privilege('anon', f.name, 'execute')
              then 'WRONG - revoke it' else 'correct' end
  end as result
from (values
  ('public.list_user_accounts()'),
  ('public.clear_password_change_flag()'),
  ('public.departments_managed_by(uuid)'),
  ('public.log_document_download(uuid)'),
  ('public.heartbeat()')
) as f(name);


-- 2. authenticated kept the access it needs.
select
  'authenticated may execute ' || f.name as check_name,
  case when has_function_privilege('authenticated', f.name, 'execute')
       then 'correct' else 'WRONG - the application will break' end as result
from (values
  ('public.list_user_accounts()'),
  ('public.clear_password_change_flag()'),
  ('public.departments_managed_by(uuid)'),
  ('public.log_document_download(uuid)')
) as f(name);


-- 3. The guard actually refuses now.
--
-- Behavioural, not a text match: it calls the function as it currently
-- stands, with no signed-in user — which is the exact condition that
-- used to fall through. Wrapped in a transaction that is rolled back,
-- so the audit_log row written by a FAIL does not survive the test.
begin;

create temp table _guard_check (result text);

do $$
declare
  v_doc uuid;
  v_out text;
begin
  select id into v_doc from public.documents limit 1;

  if v_doc is null then
    insert into _guard_check
      values ('SKIPPED - no documents exist yet, so there was nothing to test with');
    return;
  end if;

  begin
    v_out := public.log_document_download(v_doc);
    insert into _guard_check
      values ('FAIL - an unauthenticated call returned a storage path. Do not deploy.');
  exception when others then
    insert into _guard_check
      values ('PASS - refused with: ' || sqlerrm);
  end;
end $$;

select result as fail_closed_test from _guard_check;

rollback;
