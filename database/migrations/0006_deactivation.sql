-- =====================================================================
-- 0006_deactivation.sql
-- Anthrop HRMS — Extension brief, Task 2: make deactivation visible.
--
-- The behaviour is not changing. Records are still never deleted: the
-- audit log references them, and a system that can erase a person erases
-- the history of what was done to them. What changes is that the way to
-- take somebody off the active roster now exists, is called what it is,
-- and records why.
--
-- ---------------------------------------------------------------------
-- WHERE "ACTIVE" LIVES, AND WHY IT MOVED
-- ---------------------------------------------------------------------
--
-- Until now a person's activity was inferred from employments.status.
-- That reads well until you meet somebody with no employment row at all
-- — added to the system before anyone recorded what they do, which the
-- employee list explicitly supports (see the comment at the top of
-- frontend/src/lib/employees.ts). There is nothing to end, so under an
-- employment-only model they could never be taken off the list.
--
-- So the roster flag goes on the person, and ending the employment
-- becomes a consequence of deactivating them rather than the mechanism.
-- Both happen inside one function, so they cannot drift apart.
--
-- ---------------------------------------------------------------------
-- SECURITY INVOKER, DELIBERATELY
-- ---------------------------------------------------------------------
--
-- This function is NOT security definer. It does nothing the caller is
-- not already allowed to do — people_write_owner_hr and
-- employments_write_owner_hr are what decide that, and they keep
-- deciding it here. The function exists for atomicity, not for
-- privilege.
--
-- That is the lesson of 0005 applied in advance: a definer function has
-- to restate a permission check by hand, and a permission check restated
-- by hand is one that can be got wrong. A Manager or Staff caller
-- reaching this function updates zero rows and is told the record is not
-- theirs to change.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. The roster flag, and the two facts that go with it.
-- ---------------------------------------------------------------------

alter table public.people
  add column if not exists is_active boolean not null default true;

-- Why they left. Required when deactivating — enforced in the function
-- below rather than by a check constraint, because the column is
-- legitimately null for everybody who is still here.
alter table public.people
  add column if not exists deactivation_reason text;

-- Their last day, as a business fact. A date, not a timestamp: this is
-- somebody typing "the 30th", not an instant.
--
-- Note it does NOT schedule anything. Deactivating removes them from the
-- active list immediately; this records when the employment actually
-- ended, which may be in the past (recorded late) or the future (they
-- have given notice). Nothing in Module 1 runs on a timer, and a flag
-- that silently flips on a date nobody is watching would be worse than
-- one that is honest about being manual.
alter table public.people
  add column if not exists deactivated_effective_on date;

-- When the action was taken, as opposed to when it takes effect. Set by
-- the database (rule 8) and never accepted from the browser.
alter table public.people
  add column if not exists deactivated_at timestamptz;

-- The same reason, kept against the employment it ended, so the
-- employment history reads on its own without having to join back to
-- the person's current state.
alter table public.employments
  add column if not exists end_reason text;

-- The default list reads `where is_active` on every load. Partial, so it
-- only covers the rows that are normally wanted.
create index if not exists people_active_idx
  on public.people (tenant_id, last_name)
  where is_active;


-- ---------------------------------------------------------------------
-- 2. Deactivate, and reactivate, as one action each.
-- ---------------------------------------------------------------------

create or replace function public.set_person_active(
  p_person_id    uuid,
  p_active       boolean,
  p_reason       text default null,
  p_effective_on date default null
)
returns void
language plpgsql
-- security invoker, by omission and on purpose. See the header.
set search_path = public, app, pg_temp
as $fn$
declare
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_touched int;
begin
  if p_active then
    -- Reactivating. The reason and the effective date are cleared: they
    -- described a departure that is now over, and leaving them behind
    -- would have the record assert two contradictory things at once.
    --
    -- The employment is deliberately NOT resurrected. Somebody coming
    -- back holds a new post, from a new date — that is a new employment
    -- row, entered the ordinary way. Silently reviving the old one would
    -- invent a start date and an end date nobody stated (rule 4).
    update public.people
       set is_active                = true,
           deactivation_reason      = null,
           deactivated_effective_on = null,
           deactivated_at           = null
     where id = p_person_id;

    get diagnostics v_touched = row_count;
  else
    -- Deactivating.
    if v_reason is null then
      raise exception 'Give a reason for deactivating this employee.'
        using errcode = 'check_violation';
    end if;

    if p_effective_on is null then
      raise exception 'Give the date this takes effect.'
        using errcode = 'check_violation';
    end if;

    -- You cannot take your own record off the roster. The same rule the
    -- Users and roles screen applies to accounts, applied to people: an
    -- administrator who removes themselves by accident is left with a
    -- system that no longer believes they work here.
    if p_person_id = (select app.current_person_id()) then
      raise exception 'You cannot deactivate your own employee record. Somebody else has to do it for you.'
        using errcode = 'insufficient_privilege';
    end if;

    update public.people
       set is_active                = false,
           deactivation_reason      = v_reason,
           deactivated_effective_on = p_effective_on,
           -- now(), not a value from the browser. Rule 8.
           deactivated_at           = now()
     where id = p_person_id;

    get diagnostics v_touched = row_count;

    -- Ending the employment is a consequence of the person leaving, not
    -- a separate thing to remember. Only genuinely open ones are
    -- touched, and coalesce means re-running this cannot rewrite a date
    -- that was already recorded properly.
    if v_touched > 0 then
      update public.employments
         set status     = 'ended',
             end_date   = coalesce(end_date, p_effective_on),
             end_reason = coalesce(end_reason, v_reason)
       where person_id = p_person_id
         and status    = 'active';
    end if;
  end if;

  -- Zero rows means row-level security filtered the person out: either
  -- they are in another organisation, or this caller is not an Owner or
  -- HR. Both get the same sentence, for the same reason
  -- getEmployeeProfile does not distinguish them — saying "that person
  -- exists but is not yours" leaks who exists.
  if v_touched = 0 then
    raise exception 'That employee record is not yours to change.'
      using errcode = 'insufficient_privilege';
  end if;

  -- No audit insert here. app.audit_row() is an AFTER trigger on both
  -- public.people and public.employments, so the updates above have
  -- already written themselves to the log, with auth.uid() as the actor
  -- and the full before/after of each row. Rule 3, without application
  -- code being trusted to remember it.
end;
$fn$;

comment on function public.set_person_active(uuid, boolean, text, date) is
  'Take an employee off the active roster, or put them back. Ends any open employment on the way out. Security invoker: the people and employments write policies decide who may call it.';

-- D14: a Supabase project grants EXECUTE on every new public function to
-- anon by default, and `revoke ... from public` does not remove it.
-- Name anon explicitly, and do it after the create.
revoke all on function public.set_person_active(uuid, boolean, text, date) from anon, public;
grant execute on function public.set_person_active(uuid, boolean, text, date) to authenticated;

commit;


-- =====================================================================
-- Verification
-- =====================================================================

-- 1. The five columns exist.
select
  table_name || '.' || column_name as column_added,
  data_type,
  coalesce(column_default, '(none)') as default_value,
  case
    when table_name = 'people' and column_name = 'is_active'
      then case when is_nullable = 'NO' and column_default = 'true'
                then 'correct' else 'WRONG - must be not null default true' end
    else 'correct'
  end as result
from information_schema.columns
where (table_name = 'people'
       and column_name in ('is_active', 'deactivation_reason',
                           'deactivated_effective_on', 'deactivated_at'))
   or (table_name = 'employments' and column_name = 'end_reason')
order by table_name, column_name;


-- 2. The migration deactivated nobody.
select
  count(*) filter (where is_active)     as active_people,
  count(*) filter (where not is_active) as inactive_people,
  case when count(*) filter (where not is_active) = 0
       then 'correct - everyone kept their place on the list'
       else 'WRONG - the migration should not deactivate anybody' end as result
from public.people;


-- 3. anon cannot call it, authenticated can.
select
  'anon may execute set_person_active' as check_name,
  case when has_function_privilege('anon',
         'public.set_person_active(uuid, boolean, text, date)', 'execute')
       then 'WRONG - revoke it' else 'correct' end as result
union all
select
  'authenticated may execute set_person_active',
  case when has_function_privilege('authenticated',
         'public.set_person_active(uuid, boolean, text, date)', 'execute')
       then 'correct' else 'WRONG - the screen will break' end;


-- 4. It is NOT security definer.
--
-- The check worth reading. If prosecdef ever comes back true, the
-- function has stopped being governed by the write policies and has
-- become a way for any signed-in user to deactivate anybody at all.
select
  'set_person_active runs as the caller' as check_name,
  case when p.prosecdef
       then 'WRONG - it is security definer, the policies no longer apply'
       else 'correct' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_person_active';
