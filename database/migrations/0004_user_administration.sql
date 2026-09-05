-- =====================================================================
-- 0004_user_administration.sql
-- Anthrop HRMS — Extension brief, Task 1. Users and roles.
--
-- Everything the Users and Roles screen needs that the schema in 0001
-- does not already provide. 0001 is not edited: rule 5 says a run
-- migration is never touched, so the two functions below are replaced
-- with CREATE OR REPLACE from this file instead.
--
-- Four things:
--
--   1. profiles.must_change_password — for an account whose password
--      was set by somebody else.
--   2. app.guard_role_assignment() — the two rules it already enforced,
--      plus three that stop the organisation locking itself out.
--   3. public.list_user_accounts() — email and last sign-in, which live
--      in auth.users where no policy can reach them.
--   4. public.clear_password_change_flag() — how a person turns their
--      own flag off, without giving anybody an UPDATE on their profile.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. An account whose password was chosen for them
--
-- The invitation flow never sets a password: the invited person follows
-- an emailed link and chooses their own, so this stays false for them.
-- It exists for the accounts that are made by hand in the Supabase
-- dashboard — where setting a password is not optional — starting with
-- the very first Owner, who was created that way by definition.
--
-- Nothing in the application can set this to true, deliberately. It is
-- an administrator's statement that somebody else knows this password,
-- and it is made at the point that becomes true. The snippet is at the
-- bottom of this file.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True when this account''s password was set by somebody other than its owner. The application refuses to show anything until it is changed. Cleared by public.clear_password_change_flag().';


-- ---------------------------------------------------------------------
-- 2. Who may assign a role, and what must survive
--
-- Replaces the version in 0001. The first two rules are unchanged and
-- are repeated in full rather than referenced, because this function
-- body is now the only definition of them.
--
-- The three new rules all defend the same thing: an organisation that
-- can still administer itself tomorrow. Row-level security cannot
-- express any of them — they are conditions across other rows in the
-- same table, evaluated at the moment of the write — so they are a
-- trigger.
--
-- Note what is NOT guarded here. A profile row is deleted only by the
-- cascade from auth.users, which is a dashboard action by somebody with
-- full project access; a trigger that tried to veto it would be
-- claiming an authority it does not have. Deleting the last Owner's
-- login in the Supabase dashboard will still lock the organisation out,
-- and nothing in the database can prevent that.
-- ---------------------------------------------------------------------

create or replace function app.guard_role_assignment() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_role         public.app_role := app.current_app_role();
  v_actor        uuid            := auth.uid();
  v_other_owners integer;
begin
  -- v_role is null when the caller has no profile yet: the very first
  -- Owner, created by the human in the SQL editor. Nothing to guard.
  if v_role is null then
    return new;
  end if;

  -- (1) Only an Owner may change a role.
  if tg_op = 'UPDATE' and new.role is distinct from old.role and v_role <> 'owner' then
    raise exception 'Only an Owner may change a role.'
      using errcode = 'insufficient_privilege';
  end if;

  -- (2) Only an Owner may create an account above Staff.
  if tg_op = 'INSERT' and new.role <> 'staff' and v_role <> 'owner' then
    raise exception 'Only an Owner may create an account with a role above Staff.'
      using errcode = 'insufficient_privilege';
  end if;

  -- (3) An Owner cannot remove their own Owner role.
  --
  -- Separate from rule (4) on purpose, and it fires first. Demoting
  -- yourself while another Owner exists is not a lockout, but it is
  -- almost always a mistake and it is not undoable by the person who
  -- made it — the moment the update lands they no longer hold the role
  -- that would let them reverse it.
  if tg_op = 'UPDATE'
     and old.id = v_actor
     and old.role = 'owner'
     and new.role is distinct from old.role then
    raise exception 'You cannot remove your own Owner role. Another Owner has to do it for you.'
      using errcode = 'insufficient_privilege';
  end if;

  -- (4) The last active Owner keeps the role, and keeps the access.
  --
  -- One test covers both ways out because both have the same result:
  -- an organisation with nobody who can assign a role, invite anybody,
  -- or read the audit log. There is no route back from that inside the
  -- application.
  if tg_op = 'UPDATE'
     and old.role = 'owner'
     and old.is_active
     and (new.role <> 'owner' or not new.is_active) then

    select count(*) into v_other_owners
      from public.profiles p
     where p.tenant_id = old.tenant_id
       and p.role      = 'owner'
       and p.is_active
       and p.id       <> old.id;

    if v_other_owners = 0 then
      raise exception
        'This is the last active Owner. Give somebody else the Owner role first, or the organisation locks itself out.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Email and last sign-in
--
-- Both live in auth.users. No row-level security policy can reach that
-- table, and exposing it wholesale would hand out password hashes,
-- recovery tokens and every other project's identities. So one function
-- returns the five columns the screen needs and nothing else.
--
-- SECURITY DEFINER, and therefore the whole of its own access control:
--
--   - the caller's tenant is resolved from their own profile, never
--     passed in, so there is no argument to tamper with;
--   - Owner and HR see the accounts in their own organisation;
--   - everybody else sees exactly their own row;
--   - a deactivated caller sees nothing, because
--     app.current_tenant_id() requires is_active and returns null,
--     and null = anything is null rather than true.
--
-- It takes no parameters for the same reason.
-- ---------------------------------------------------------------------

create or replace function public.list_user_accounts()
returns table (
  id              uuid,
  email           text,
  last_sign_in_at timestamptz,
  invited_at      timestamptz,
  confirmed_at    timestamptz
)
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    u.invited_at,
    u.email_confirmed_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.tenant_id = (select app.current_tenant_id())
    and (
      (select app.current_app_role()) in ('owner', 'hr')
      or p.id = (select auth.uid())
    );
$$;

comment on function public.list_user_accounts() is
  'Email and sign-in dates for the accounts in the caller''s own organisation. Owner and HR see all of them; everybody else sees only their own. Exists because auth.users cannot be reached by a policy.';

revoke all on function public.list_user_accounts() from public;
grant execute on function public.list_user_accounts() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Turning your own flag off
--
-- The alternative was an UPDATE policy letting somebody write their own
-- profile row. That would have handed every Staff user their own
-- tenant_id, person_id and is_active columns to edit, to solve a
-- one-column problem. This function touches one column on one row, and
-- the row is chosen by auth.uid() rather than by anything the caller
-- says.
--
-- It does not check that a password was actually changed. It cannot —
-- passwords are Supabase's, not ours. It is called immediately after
-- auth.updateUser() succeeds, and the worst case if somebody calls it
-- by hand is that they have cleared their own reminder to do a thing
-- only they are harmed by not doing.
-- ---------------------------------------------------------------------

create or replace function public.clear_password_change_flag()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles
     set must_change_password = false
   where id = (select auth.uid())
     and must_change_password;
$$;

comment on function public.clear_password_change_flag() is
  'Clears must_change_password on the caller''s own profile. Called after a successful password change.';

revoke all on function public.clear_password_change_flag() from public;
grant execute on function public.clear_password_change_flag() to authenticated;


-- ---------------------------------------------------------------------
-- 5. What a Manager would actually be able to see
--
-- Giving somebody the Manager role does not give them a department.
-- A Manager's departments are worked out, not stored: the department of
-- their own active employment, plus any department they are recorded as
-- the head of. Someone with neither gets the role, signs in, and finds
-- an empty screen — and the system looks broken when it is doing
-- exactly what it was told.
--
-- The Users and Roles screen therefore shows what the role will resolve
-- to *before* it is assigned. That needs the same answer
-- app.managed_department_ids() gives, for somebody other than the
-- caller, and by name rather than by id.
--
-- ---------------------------------------------------------------------
-- WHY THIS IS A SECOND FUNCTION AND NOT A REFACTOR
-- ---------------------------------------------------------------------
--
-- The obvious move is to make app.managed_department_ids() delegate to
-- this one, so the rule has a single definition. It was not done.
--
-- app.managed_department_ids() is called inside three row-level
-- security policies — people_select_manager, employments_select_manager
-- and attendance_select_manager — on a database that currently holds
-- real staff. Changing it to gain a tidier call graph risks every
-- Manager's access to buy nothing a user can see.
--
-- Two definitions of one rule is a genuine cost, and the answer to it
-- is not a promise to be careful. It is the last query in this file,
-- which computes both answers for every profile in the database and
-- fails visibly if they ever disagree. Run it after any change to
-- either function.
-- ---------------------------------------------------------------------

create or replace function public.departments_managed_by(p_person_id uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select d.id, d.name
  from (
    -- The department of their own active employment.
    select dep.id, dep.name
    from public.employments e
    join public.departments dep on dep.id = e.department_id
    where e.person_id = p_person_id
      and e.status = 'active'

    union   -- deduplicates: someone may both work in a department and head it

    -- Any department they are recorded as the head of.
    select dep.id, dep.name
    from public.departments dep
    where dep.head_person_id = p_person_id
  ) d
  where p_person_id is not null
    -- The caller may ask about somebody in their own organisation, and
    -- only if they administer it or are asking about themselves. The
    -- tenant comes from the person's own row, so there is no argument
    -- here that widens what the caller can reach.
    and exists (
      select 1
      from public.profiles viewer
      join public.people subject on subject.id = p_person_id
      where viewer.id = (select auth.uid())
        and viewer.is_active
        and viewer.tenant_id = subject.tenant_id
        and (viewer.role in ('owner', 'hr') or viewer.person_id = p_person_id)
    )
  order by 2;
$$;

comment on function public.departments_managed_by(uuid) is
  'The departments the Manager role would resolve to for this person: their own active employment, plus anything they head. Must agree with app.managed_department_ids(); the check is at the end of migration 0004.';

revoke all on function public.departments_managed_by(uuid) from public;
grant execute on function public.departments_managed_by(uuid) to authenticated;

commit;


-- =====================================================================
-- Verification. Four checks; every one should print `correct`.
-- =====================================================================

select
  'must_change_password column' as check_name,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'must_change_password'
  ) then 'correct' else 'MISSING' end as result

union all

select
  'guard_role_assignment has the lockout rules',
  case when (
    select pg_get_functiondef(p.oid) like '%last active Owner%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'guard_role_assignment'
  ) then 'correct' else 'STILL THE 0001 VERSION' end

union all

select
  'list_user_accounts is security definer',
  case when (
    select p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_user_accounts'
  ) then 'correct' else 'WRONG - it cannot read auth.users' end

union all

select
  'anon cannot call any of the three functions',
  case when
    not has_function_privilege('anon', 'public.list_user_accounts()', 'execute')
    and not has_function_privilege('anon', 'public.clear_password_change_flag()', 'execute')
    and not has_function_privilege('anon', 'public.departments_managed_by(uuid)', 'execute')
  then 'correct' else 'WRONG - revoke it' end;


-- ---------------------------------------------------------------------
-- The drift check promised in section 5.
--
-- One rule — "which departments does this Manager cover" — is now
-- written in two places. This query computes both, for every active
-- profile linked to a person, and reports whether they agree.
--
-- Both expressions are inlined rather than called. public.departments_
-- managed_by() would return nothing here: its access check is on
-- auth.uid(), and there is no signed-in user in the SQL editor. So what
-- is compared is the two statements of the rule, which is precisely
-- what can drift. Re-run this after touching either function.
--
-- Expect every row to read `agree`. An empty result means no profile is
-- linked to a person yet, which is not a failure.
-- ---------------------------------------------------------------------

select
  u.email,
  p.role,
  old_way.ids as managed_department_ids_says,
  new_way.ids as departments_managed_by_says,
  case when old_way.ids = new_way.ids then 'agree' else 'DISAGREE - do not ship' end as verdict
from public.profiles p
join auth.users u on u.id = p.id

-- The body of app.managed_department_ids(), keyed on the profile.
cross join lateral (
  select coalesce(array_agg(distinct s.d order by s.d), '{}'::uuid[]) as ids
  from (
    select e.department_id as d
    from public.employments e
    join public.profiles pr
      on pr.person_id = e.person_id and pr.tenant_id = e.tenant_id
    where pr.id = p.id
      and pr.is_active
      and e.status = 'active'
      and e.department_id is not null
    union
    select dep.id
    from public.departments dep
    join public.profiles pr2 on pr2.tenant_id = dep.tenant_id
    where pr2.id = p.id
      and pr2.is_active
      and pr2.person_id is not null
      and dep.head_person_id = pr2.person_id
  ) s
) old_way

-- The body of public.departments_managed_by(), keyed on the person.
cross join lateral (
  select coalesce(array_agg(distinct d.id order by d.id), '{}'::uuid[]) as ids
  from (
    select dep.id
    from public.employments e
    join public.departments dep on dep.id = e.department_id
    where e.person_id = p.person_id
      and e.status = 'active'
    union
    select dep.id
    from public.departments dep
    where dep.head_person_id = p.person_id
  ) d
) new_way

where p.person_id is not null
  and p.is_active
order by u.email;


-- ---------------------------------------------------------------------
-- The accounts as they now stand. The first Owner will show
-- must_change_password = false, because this migration defaults it that
-- way and nothing has said otherwise.
--
-- If that Owner's password was set for them in the Supabase dashboard —
-- and it was, because the dashboard requires one — and they have not
-- changed it since, set the flag by hand. Substitute the address:
--
--   update public.profiles
--      set must_change_password = true
--    where id = (select id from auth.users where lower(email) = lower('THEM@anthropmanagement.com'));
--
-- They will be asked to choose a new password the next time they open
-- the application, and will not reach any screen until they have.
-- ---------------------------------------------------------------------

select
  u.email,
  p.role,
  p.is_active,
  p.must_change_password,
  u.last_sign_in_at,
  case when p.person_id is null then 'Not linked to an employee record' else 'Linked' end
    as employee_record
from public.profiles p
join auth.users u on u.id = p.id
order by p.role, u.email;
