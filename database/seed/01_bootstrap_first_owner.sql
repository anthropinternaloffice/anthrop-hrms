-- =====================================================================
-- 01_bootstrap_first_owner.sql
-- Anthrop HRMS — first-run setup. NOT a migration, NOT a test fixture.
--
-- Module 1 creates staff accounts by invitation from an administrator.
-- That leaves one thing nothing in the application can do: create the
-- FIRST administrator. This script is that step, run once by hand.
--
-- It is safe to run more than once. Running it again finds what already
-- exists and changes nothing.
--
-- ---------------------------------------------------------------------
-- BEFORE YOU RUN THIS
-- ---------------------------------------------------------------------
--
-- Create the Owner's login in the Supabase dashboard first:
--
--   Authentication -> Users -> Add user -> Create new user
--     Email:              the Owner's real work email
--     Password:           set one; the Owner can change it later
--     Auto Confirm User:  TICK THIS. Without it the account cannot
--                         sign in and no confirmation email is sent.
--
-- Create the user through the dashboard, never with an INSERT here.
-- Supabase writes an auth.identities row alongside auth.users, and a
-- hand-written user without one looks fine in the table and then fails
-- at the login screen for reasons that are hard to see.
--
-- ---------------------------------------------------------------------
-- THEN
-- ---------------------------------------------------------------------
--
-- Change the email on the marked line below to the one you just created,
-- and run the whole file in the Supabase SQL editor.
-- =====================================================================

do $$
declare
  -- ▼▼▼ EDIT THIS LINE ▼▼▼
  v_owner_email text := 'CHANGE-ME@anthropmanagement.com';
  -- ▲▲▲ EDIT THIS LINE ▲▲▲

  v_tenant_name text := 'Anthrop Management Limited';
  v_user_id     uuid;
  v_tenant_id   uuid;
  v_existing    public.app_role;
begin
  if v_owner_email = 'CHANGE-ME@anthropmanagement.com' then
    raise exception
      'Edit v_owner_email first: put in the address you created in Authentication -> Users.';
  end if;

  -- 1. Find the login. It must already exist.
  select id into v_user_id
    from auth.users
   where lower(email) = lower(v_owner_email);

  if v_user_id is null then
    raise exception
      'No auth user with email %. Create it in the Supabase dashboard under '
      'Authentication -> Users -> Add user, and tick Auto Confirm User.', v_owner_email;
  end if;

  -- 2. The organisation. Details are Anthrop's own, from the footer of
  --    anthropmanagement.com. Nothing here is invented; anything the
  --    client has not stated stays null (rule 4).
  select id into v_tenant_id
    from public.tenants
   where name = v_tenant_name;

  if v_tenant_id is null then
    insert into public.tenants (name, legal_name, address, contact_email, contact_phone)
    values (
      v_tenant_name,
      v_tenant_name,
      '27 Acme Road, Agidingbi, Ikeja, Lagos, Nigeria',
      'info@anthropmanagement.com',
      '+2348033713519'
    )
    returning id into v_tenant_id;

    raise notice 'Created tenant % (%)', v_tenant_name, v_tenant_id;
  else
    raise notice 'Tenant % already exists (%)', v_tenant_name, v_tenant_id;
  end if;

  -- 3. The profile: this login, in that organisation, as Owner.
  --
  --    person_id stays null. A profile is a login; a person is a human
  --    being (D2). The Owner's employee record gets created through the
  --    application in Task 9 and linked then — inventing a half-filled
  --    people row here would be rule 4.
  --
  --    app.guard_role_assignment() permits this: it returns early when
  --    the caller has no profile of their own, which is exactly the
  --    first-Owner case it was written for.
  select role into v_existing from public.profiles where id = v_user_id;

  if v_existing is null then
    insert into public.profiles (id, tenant_id, person_id, role, is_active)
    values (v_user_id, v_tenant_id, null, 'owner', true);
    raise notice 'Created Owner profile for %', v_owner_email;
  else
    raise notice 'Profile already exists for % with role %. Left alone.',
      v_owner_email, v_existing;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Verification. Expect exactly one row: your email, role owner, active.
--
-- The audit log will also show these inserts with a null actor_user_id.
-- That is correct: nobody was signed in, the database itself did it.
-- ---------------------------------------------------------------------
select
  u.email,
  t.name  as organisation,
  p.role,
  p.is_active,
  case when p.person_id is null
       then 'Not linked to an employee record yet'
       else 'Linked'
  end as employee_record
from public.profiles p
join auth.users u     on u.id = p.id
join public.tenants t on t.id = p.tenant_id
order by u.email;
