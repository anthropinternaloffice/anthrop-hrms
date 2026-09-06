-- =====================================================================
-- 0008_employee_import_audit.sql
-- Anthrop HRMS — Extension brief, Task 5: bulk employee import.
--
-- "The whole import writes one audit entry with a count, plus individual
-- entries per record."
--
-- The individual entries need nothing built. Every row goes in through
-- the ordinary insert and update paths, so app.audit_row() fires on
-- public.people and public.employments exactly as it does when somebody
-- types one person into the form. An import is not a special way of
-- writing to the database; it is the same writes, in a loop.
--
-- The summary entry is the part that has no trigger to write it. Nobody
-- holds an insert grant on audit_log, so it needs a definer function —
-- the same shape as log_attendance_export() in 0007.
--
-- ---------------------------------------------------------------------
-- WHY THIS ONE IS LOGGED AFTERWARDS, WHEN THE EXPORT IS LOGGED FIRST
-- ---------------------------------------------------------------------
--
-- D17 argued that an export must be logged before the file is produced,
-- because a read fires no trigger and an interrupted export would
-- otherwise leave no trace at all.
--
-- An import is the opposite case. Every row it writes has already
-- written its own audit entry by the time the summary is due, so an
-- import that dies halfway is still fully recorded, person by person.
-- The summary is a description of what happened, and it cannot honestly
-- be written before it has.
--
-- The failure modes are therefore not symmetrical: a crashed export
-- would be invisible, whereas a crashed import is visible in full detail
-- and merely missing its cover note.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

-- Outside the transaction, for the same reason as 0007: Postgres will
-- not let a new enum value be used in the transaction that adds it.
alter type public.audit_action add value if not exists 'import';


begin;

create or replace function public.log_employee_import(
  p_created   int,
  p_updated   int,
  p_skipped   int,
  p_failed    int,
  p_filename  text default null
)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $fn$
declare
  v_tenant uuid := app.current_tenant_id();
  v_role   public.app_role := app.current_app_role();
begin
  -- D14: a permission check that evaluates to NULL must deny. Written as
  -- explicit IS NULL tests rather than folded into a larger boolean,
  -- which is the shape that failed open in 0002.
  if v_tenant is null or v_role is null then
    raise exception 'That import is not available.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Mirrors people_write_owner_hr and employments_write_owner_hr. Those
  -- policies are what actually stopped the rows being written; this
  -- refuses to record an import that could not have happened, so the log
  -- cannot be given entries describing work nobody was able to do.
  if v_role not in ('owner', 'hr') then
    raise exception 'Only an Owner or HR can import employees.'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_created, 0) < 0 or coalesce(p_updated, 0) < 0
     or coalesce(p_skipped, 0) < 0 or coalesce(p_failed, 0) < 0 then
    raise exception 'That import summary is not valid.'
      using errcode = 'check_violation';
  end if;

  insert into public.audit_log
    (tenant_id, actor_user_id, action, table_name, record_id, before, after)
  values
    (v_tenant, auth.uid(), 'import', 'people', null, null,
     jsonb_build_object(
       'created', coalesce(p_created, 0),
       'updated', coalesce(p_updated, 0),
       'skipped', coalesce(p_skipped, 0),
       'failed',  coalesce(p_failed, 0),
       -- The name of the file the administrator uploaded. Truncated
       -- because it is free text from a filesystem and there is no
       -- reason for the log to carry an arbitrarily long one.
       'filename', left(nullif(btrim(coalesce(p_filename, '')), ''), 200)
     ));
end;
$fn$;

comment on function public.log_employee_import(int, int, int, int, text) is
  'Writes the one summary audit entry for a bulk employee import. The per-record entries come from app.audit_row() on people and employments.';

-- D14: Supabase grants EXECUTE on every new public function to anon by
-- default, and `revoke ... from public` does not remove that grant.
revoke all on function public.log_employee_import(int, int, int, int, text) from anon, public;
grant execute on function public.log_employee_import(int, int, int, int, text) to authenticated;

commit;


-- =====================================================================
-- Verification
-- =====================================================================
--
-- Rolled back, so a FAIL cannot leave its audit row behind.

begin;

create temp table _import_check (check_name text, result text);

do $$
begin
  -- Behavioural. Nobody is signed in in the SQL editor, so
  -- app.current_tenant_id() is NULL — the condition that let
  -- log_document_download() fail open until 0005.
  begin
    perform public.log_employee_import(1, 0, 0, 0, 'verification.csv');
    insert into _import_check values
      ('refuses a caller with no tenant',
       'FAIL - an unauthenticated call was accepted. Do not deploy.');
  exception when others then
    insert into _import_check values
      ('refuses a caller with no tenant', 'PASS - refused with: ' || sqlerrm);
  end;
end $$;

select 'import exists in audit_action' as check_name,
       case when exists (
         select 1
           from pg_enum e
           join pg_type t on t.oid = e.enumtypid
          where t.typname = 'audit_action' and e.enumlabel = 'import'
       ) then 'correct' else 'WRONG - the summary insert will fail' end as result

union all
select 'anon cannot log an import',
       case when has_function_privilege('anon',
              'public.log_employee_import(int, int, int, int, text)', 'execute')
            then 'WRONG - revoke it' else 'correct' end

union all
select 'authenticated can log an import',
       case when has_function_privilege('authenticated',
              'public.log_employee_import(int, int, int, int, text)', 'execute')
            then 'correct' else 'WRONG - every import will fail to record' end

union all
select 'people and employments still audit each row',
       case when (
         select count(*) from pg_trigger
          where tgname in ('audit_people', 'audit_employments')
            and not tgisinternal
       ) = 2 then 'correct - the per-record entries come from these'
         else 'WRONG - an import would record only its summary' end

union all
select check_name, result from _import_check;

rollback;
