-- =====================================================================
-- 01_seed_two_tenants.sql
-- Anthrop HRMS — Task 4, step 1 of 4
--
-- Creates two complete, unrelated organisations with rows in EVERY
-- table, so that the isolation tests in step 2 have something real to
-- fail against.
--
-- Run this as the default `postgres` user in the Supabase SQL editor.
-- It is NOT a migration. It never runs against production data.
-- Every id below is a fixed literal so the tests can name rows exactly.
--
-- Re-runnable: every insert is ON CONFLICT DO NOTHING.
-- Remove it all again with 99_teardown.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Tenant A — Alpha Institution Limited
-- Tenant B — Beta Authority Limited
-- ---------------------------------------------------------------------

insert into public.tenants (id, name, legal_name, address, contact_email, contact_phone) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alpha Institution',
   'Alpha Institution Limited', '12 Test Close, Ikeja, Lagos',
   'admin@alpha.test', '+2348030000001'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Beta Authority',
   'Beta Authority Limited', '48 Other Road, Abuja',
   'admin@beta.test', '+2348030000002')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- People
--
-- Tenant A gets five. Four of them have logins; the fifth (Emeka, in
-- Finance) has none and exists purely so the Manager test has somebody
-- they must NOT be able to see.
--
-- Nulls are deliberate. Emeka has no phone and no date of birth, which
-- is what "Not stated" has to render from later.
-- ---------------------------------------------------------------------

insert into public.people
  (id, tenant_id, first_name, middle_name, last_name, preferred_name,
   email, phone, date_of_birth, address_line1, city, state, country) values

  -- Tenant A
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Damilola', 'Ayo', 'Ogun', null, 'damilola.ogun@alpha.test', '+2348031000001',
   '1980-04-12', '5 Owner Street', 'Ikeja', 'Lagos', 'Nigeria'),

  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Chinedu', null, 'Eze', null, 'chinedu.eze@alpha.test', '+2348031000002',
   '1988-09-30', '9 People Avenue', 'Ikeja', 'Lagos', 'Nigeria'),

  ('aaaaaaaa-2222-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Bola', 'Ade', 'Adeyemi', 'Bee', 'bola.adeyemi@alpha.test', '+2348031000003',
   '1985-01-22', '14 Manager Way', 'Ikeja', 'Lagos', 'Nigeria'),

  ('aaaaaaaa-2222-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Adaeze', null, 'Okonkwo', null, 'adaeze.okonkwo@alpha.test', '+2348031000004',
   '1994-07-05', '21 Staff Crescent', 'Ikeja', 'Lagos', 'Nigeria'),

  -- No phone, no DOB, no address: the "Not stated" case.
  ('aaaaaaaa-2222-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Emeka', null, 'Nwosu', null, 'emeka.nwosu@alpha.test', null,
   null, null, null, null, null),

  -- Tenant B
  ('bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Folake', null, 'Bello', null, 'folake.bello@beta.test', '+2348032000001',
   '1979-11-02', '3 Beta Lane', 'Garki', 'Abuja', 'Nigeria'),

  ('bbbbbbbb-2222-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Gbenga', null, 'Salami', null, 'gbenga.salami@beta.test', '+2348032000002',
   '1991-03-17', '7 Beta Lane', 'Garki', 'Abuja', 'Nigeria')

on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Departments. Bola heads Operations in tenant A — that is what makes
-- her a Manager for the purposes of app.managed_department_ids().
-- ---------------------------------------------------------------------

insert into public.departments (id, tenant_id, name, head_person_id, is_active) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Operations', 'aaaaaaaa-2222-4000-8000-000000000003', true),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Finance', null, true),
  ('bbbbbbbb-3333-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Administration', null, true)
on conflict (id) do nothing;

insert into public.job_titles (id, tenant_id, title, level, is_active) values
  ('aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Operations Officer', 'Officer', true),
  ('aaaaaaaa-4444-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Finance Officer', 'Officer', true),
  ('bbbbbbbb-4444-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Administrative Officer', 'Officer', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Login users.
--
-- profiles.id IS the Supabase auth user id, so these rows must exist in
-- auth.users first. These accounts are for testing only.
--
-- IF THIS BLOCK ERRORS with 'function gen_salt does not exist', change
-- crypt(...) and gen_salt(...) to extensions.crypt(...) and
-- extensions.gen_salt(...). Nothing else changes.
--
-- The password is the same for all six: Anthrop-Test-2026!
-- These users cannot sign in through the app until step 4 adds their
-- auth.identities rows; they do not need to, for the tests below.
-- ---------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
select
  '00000000-0000-0000-0000-000000000000',
  v.id::uuid, 'authenticated', 'authenticated', v.email,
  crypt('Anthrop-Test-2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
from (values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'owner.a@alpha.test'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'hr.a@alpha.test'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'manager.a@alpha.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'staff.a@alpha.test'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'owner.b@beta.test'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'staff.b@beta.test')
) as v(id, email)
on conflict (id) do nothing;

-- profiles: the login, its organisation, its role, and the human it is.
insert into public.profiles (id, tenant_id, person_id, role, is_active) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000001', 'owner',   true),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000002', 'hr',      true),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000003', 'manager', true),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000004', 'staff',   true),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-2222-4000-8000-000000000001', 'owner',   true),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-2222-4000-8000-000000000002', 'staff',   true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Employments.
--
-- Adaeze and Bola are in Operations. Emeka is in Finance — the row a
-- Manager of Operations must never see.
-- ---------------------------------------------------------------------

insert into public.employments
  (id, tenant_id, person_id, job_title_id, department_id, start_date, status) values

  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001',
   'aaaaaaaa-3333-4000-8000-000000000001', '2020-01-06', 'active'),

  ('aaaaaaaa-5555-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-4444-4000-8000-000000000001',
   'aaaaaaaa-3333-4000-8000-000000000002', '2021-03-01', 'active'),

  ('aaaaaaaa-5555-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000003', 'aaaaaaaa-4444-4000-8000-000000000001',
   'aaaaaaaa-3333-4000-8000-000000000001', '2019-06-17', 'active'),

  ('aaaaaaaa-5555-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000004', 'aaaaaaaa-4444-4000-8000-000000000001',
   'aaaaaaaa-3333-4000-8000-000000000001', '2023-02-13', 'active'),

  -- Finance: invisible to the Operations manager
  ('aaaaaaaa-5555-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000005', 'aaaaaaaa-4444-4000-8000-000000000002',
   'aaaaaaaa-3333-4000-8000-000000000002', '2022-08-01', 'active'),

  ('bbbbbbbb-5555-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-4444-4000-8000-000000000001',
   'bbbbbbbb-3333-4000-8000-000000000001', '2018-05-02', 'active'),

  ('bbbbbbbb-5555-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-2222-4000-8000-000000000002', 'bbbbbbbb-4444-4000-8000-000000000001',
   'bbbbbbbb-3333-4000-8000-000000000001', '2024-01-15', 'active')

on conflict (id) do nothing;

-- Bola manages Adaeze.
update public.employments
   set manager_employment_id = 'aaaaaaaa-5555-4000-8000-000000000003'
 where id = 'aaaaaaaa-5555-4000-8000-000000000004'
   and manager_employment_id is null;

-- ---------------------------------------------------------------------
-- Documents (metadata only — no files are uploaded by this script)
-- ---------------------------------------------------------------------

insert into public.documents
  (id, tenant_id, person_id, storage_path, original_filename, mime_type,
   size_bytes, document_type) values
  ('aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000004',
   'alpha/2f9c1d84a0e5/contract.pdf', 'contract.pdf', 'application/pdf', 18244, 'Contract'),
  ('aaaaaaaa-6666-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000005',
   'alpha/7b31ee02c4aa/id-card.pdf', 'id-card.pdf', 'application/pdf', 9120, 'Identification'),
  ('bbbbbbbb-6666-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-2222-4000-8000-000000000002',
   'beta/c05a9917f3d1/contract.pdf', 'contract.pdf', 'application/pdf', 20551, 'Contract')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Emergency contacts
-- ---------------------------------------------------------------------

insert into public.emergency_contacts
  (id, tenant_id, person_id, name, relationship, phone) values
  ('aaaaaaaa-7777-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000004', 'Ifeoma Okonkwo', 'Sister', '+2348039000001'),
  ('aaaaaaaa-7777-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-2222-4000-8000-000000000005', 'Ngozi Nwosu', null, null),
  ('bbbbbbbb-7777-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-2222-4000-8000-000000000002', 'Tunde Salami', 'Brother', '+2348039000002')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Attendance.
--
-- clock_in_at is NOT supplied: the trigger sets it from this server,
-- and would discard any value given here anyway. Each employment gets
-- one completed pair, then the two Staff get a second, still-open
-- record so "who is in today" has something to report.
-- ---------------------------------------------------------------------

insert into public.attendance_records (id, tenant_id, employment_id) values
  ('aaaaaaaa-8888-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-5555-4000-8000-000000000004'),
  ('aaaaaaaa-8888-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-5555-4000-8000-000000000005'),
  ('aaaaaaaa-8888-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-5555-4000-8000-000000000003'),
  ('bbbbbbbb-8888-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-5555-4000-8000-000000000002')
on conflict (id) do nothing;

-- Close them. The trigger stamps clock_out_at with the server's time;
-- the value written here is only a signal that a clock-out happened.
update public.attendance_records
   set clock_out_at = now()
 where id in ('aaaaaaaa-8888-4000-8000-000000000001',
              'aaaaaaaa-8888-4000-8000-000000000002',
              'aaaaaaaa-8888-4000-8000-000000000003',
              'bbbbbbbb-8888-4000-8000-000000000001')
   and clock_out_at is null;

-- Two people currently clocked in.
insert into public.attendance_records (id, tenant_id, employment_id) values
  ('aaaaaaaa-8888-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-5555-4000-8000-000000000004'),
  ('bbbbbbbb-8888-4000-8000-000000000009', 'bbbbbbbb-0000-4000-8000-000000000001',
   'bbbbbbbb-5555-4000-8000-000000000002')
on conflict (id) do nothing;

commit;

-- ---------------------------------------------------------------------
-- What was created. Both columns must be non-zero on every row, or the
-- isolation tests in step 2 will "pass" against empty tables and prove
-- nothing at all.
-- ---------------------------------------------------------------------

select 'tenants'            as table_name,
       count(*) filter (where id        = 'aaaaaaaa-0000-4000-8000-000000000001') as tenant_a,
       count(*) filter (where id        = 'bbbbbbbb-0000-4000-8000-000000000001') as tenant_b
  from public.tenants
union all select 'people',             count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.people
union all select 'departments',        count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.departments
union all select 'job_titles',         count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.job_titles
union all select 'profiles',           count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.profiles
union all select 'employments',        count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.employments
union all select 'documents',          count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.documents
union all select 'emergency_contacts', count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.emergency_contacts
union all select 'attendance_records', count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.attendance_records
union all select 'audit_log',          count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.audit_log
order by 1;
