-- =====================================================================
-- 0007_attendance_export_audit.sql
-- Anthrop HRMS — Extension brief, Task 4: attendance export.
--
-- The export itself is done in the browser: the rows are already on
-- screen under row-level security, and turning them into a CSV or a PDF
-- needs no database. This migration exists for the one part that cannot
-- be done there.
--
-- "Every export writes to the audit log — who exported what range, for
-- whom, and when. Exporting personnel data is exactly the action that
-- should leave a trace."
--
-- ---------------------------------------------------------------------
-- WHY THIS NEEDS A FUNCTION AT ALL
-- ---------------------------------------------------------------------
--
-- Nobody holds an insert grant on public.audit_log, deliberately: every
-- row in it is written by app.audit_row(), an AFTER trigger, so the log
-- cannot be forged by whatever happens to be holding a session. An
-- export triggers nothing — it is a read, and a read leaves no trigger
-- behind. Same problem 0002 solved for document downloads, same shape of
-- solution.
--
-- ---------------------------------------------------------------------
-- WHAT IS TRUSTED FROM THE BROWSER, AND WHAT IS NOT
-- ---------------------------------------------------------------------
--
-- Trusted, because they are claims about what the person asked for:
-- the date range, the format, and the row count.
--
-- NOT trusted, because they are claims about authority: the scope and
-- the department name. Both are derived here — the scope from the
-- caller's own role, the department name by looking the id up within the
-- caller's own tenant. A log where the subject line came from the client
-- is a log that can be made to say anything.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The audit log needs a word for this.
--
-- Outside the transaction below, on purpose. Postgres will not let a new
-- enum value be *used* in the transaction that adds it, and keeping this
-- statement on its own removes the question entirely.
--
-- 'download' already exists and was reused for documents in 0002. It is
-- not reused here: one person taking one file is a different event from
-- somebody taking a month of everybody's movements, and an audit log
-- that renders them with the same word makes the second one easy to miss
-- while reading past the first.
-- ---------------------------------------------------------------------

alter type public.audit_action add value if not exists 'export';


begin;

-- ---------------------------------------------------------------------
-- 2. Record that an export happened.
-- ---------------------------------------------------------------------

create or replace function public.log_attendance_export(
  p_format        text,
  p_from          date,
  p_to            date,
  p_department_id uuid default null,
  p_row_count     int  default null
)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $fn$
declare
  v_tenant     uuid := app.current_tenant_id();
  v_role       public.app_role := app.current_app_role();
  v_dept_name  text;
  v_scope      text;
begin
  -- D14, stated as a rule: a permission check that evaluates to NULL
  -- must deny. app.current_tenant_id() returns NULL for an anonymous
  -- caller, for one with no profile, and for a deactivated one — and a
  -- deactivated account must not be able to write into the audit log any
  -- more than it can read a document.
  --
  -- Written as an explicit IS NULL rather than as part of a larger
  -- boolean, because that larger boolean is exactly the shape that
  -- failed open in 0002.
  if v_tenant is null or v_role is null then
    raise exception 'That export is not available.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_format not in ('csv', 'pdf') then
    raise exception 'Unknown export format.'
      using errcode = 'check_violation';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'That date range is not valid.'
      using errcode = 'check_violation';
  end if;

  -- The department name is looked up rather than accepted, and looked up
  -- inside the caller's own tenant. An id from another organisation
  -- simply finds nothing, and the log says so instead of quietly naming
  -- somebody else's department.
  if p_department_id is not null then
    select d.name into v_dept_name
      from public.departments d
     where d.id = p_department_id
       and d.tenant_id = v_tenant;

    if v_dept_name is null then
      raise exception 'That department is not available.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Derived from the role, never sent. What the browser asked for and
  -- what row-level security actually handed over are two different
  -- things, and the log has to describe the second.
  v_scope := case
    when v_dept_name is not null then 'department: ' || v_dept_name
    when v_role in ('owner', 'hr')  then 'the whole organisation'
    when v_role = 'manager'         then 'their own department'
    else 'their own attendance'
  end;

  insert into public.audit_log
    (tenant_id, actor_user_id, action, table_name, record_id, before, after)
  values
    (v_tenant, auth.uid(), 'export', 'attendance_records', null, null,
     jsonb_build_object(
       'format',        p_format,
       'from',          p_from,
       'to',            p_to,
       'scope',         v_scope,
       'department_id', p_department_id,
       -- A count of what the browser said it wrote out. It cannot be
       -- checked from here, and it is recorded as a claim rather than
       -- presented as a fact the database verified.
       'rows_reported', p_row_count
     ));
end;
$fn$;

comment on function public.log_attendance_export(text, date, date, uuid, int) is
  'Writes the audit entry for an attendance export. Scope and department name are derived from the caller, never accepted from them.';

-- D14: Supabase grants EXECUTE on every new public function to anon by
-- default, and `revoke ... from public` does not remove that grant.
-- Name anon, and do it after the create.
revoke all on function public.log_attendance_export(text, date, date, uuid, int) from anon, public;
grant execute on function public.log_attendance_export(text, date, date, uuid, int) to authenticated;

commit;


-- =====================================================================
-- Verification
-- =====================================================================
--
-- Wrapped in a transaction that is rolled back. If the fail-closed test
-- FAILS it will have written a row into audit_log, and that row must not
-- survive a test that was only ever asking whether it could.

begin;

create temp table _export_check (check_name text, result text);

do $$
begin
  -- Behavioural, not a text match. Nobody is signed in in the SQL
  -- editor, so app.current_tenant_id() is NULL — the exact condition
  -- that let log_document_download() fail open until 0005 fixed it. If
  -- this is accepted, an unauthenticated caller can write into a table
  -- nobody holds an insert grant on.
  begin
    perform public.log_attendance_export('csv', current_date, current_date);
    insert into _export_check values
      ('refuses a caller with no tenant',
       'FAIL - an unauthenticated call was accepted. Do not deploy.');
  exception when others then
    insert into _export_check values
      ('refuses a caller with no tenant', 'PASS - refused with: ' || sqlerrm);
  end;
end $$;

-- One result set, because the SQL editor shows only the last one.
select 'export exists in audit_action' as check_name,
       case when exists (
         select 1
           from pg_enum e
           join pg_type t on t.oid = e.enumtypid
          where t.typname = 'audit_action' and e.enumlabel = 'export'
       ) then 'correct' else 'WRONG - every export will fail on the insert' end as result

union all
select 'anon cannot log an export',
       case when has_function_privilege('anon',
              'public.log_attendance_export(text, date, date, uuid, int)', 'execute')
            then 'WRONG - revoke it' else 'correct' end

union all
select 'authenticated can log an export',
       case when has_function_privilege('authenticated',
              'public.log_attendance_export(text, date, date, uuid, int)', 'execute')
            then 'correct' else 'WRONG - every export will fail' end

union all
select 'runs as definer, so it can reach audit_log',
       case when p.prosecdef then 'correct'
            else 'WRONG - nobody holds an insert grant, so it cannot write' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'log_attendance_export'

union all
select check_name, result from _export_check;

rollback;
