-- =====================================================================
-- 03_prove_role_scoping.sql
-- Anthrop HRMS — Task 4, step 3 of 4
--
-- Tenant isolation (step 2) is the line everything rests on. This file
-- tests the line inside a tenant: that Manager, Staff and HR each see
-- and touch only what they should, and that the rules the database is
-- supposed to enforce actually raise when broken.
--
-- Same impersonation mechanism as step 2. Run each block separately.
--
-- The cast in tenant A:
--   Damilola Ogun   owner    Operations
--   Chinedu Eze     hr       Finance
--   Bola Adeyemi    manager  Operations, and head of Operations
--   Adaeze Okonkwo  staff    Operations
--   Emeka Nwosu     (no login)  Finance
-- =====================================================================


-- =====================================================================
-- BLOCK 1 — Manager sees their own department and nothing else.
-- As 'manager.a@alpha.test' (Bola, head of Operations).
--
-- EXPECT: three people — Damilola, Bola, Adaeze. All in Operations.
--         Chinedu and Emeka are in Finance and must be ABSENT.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;

select last_name, first_name from public.people order by last_name;

select case
         when count(*) filter (where last_name in ('Eze', 'Nwosu')) > 0
           then 'FAIL — a Finance employee is visible to the Operations manager'
         when count(*) = 3
           then 'PASS — 3 Operations people visible, no Finance people'
         else 'CHECK — expected 3 people, saw ' || count(*)
       end as verdict
  from public.people;

-- Attendance follows the same boundary.
select case
         when count(*) filter (
                where e.department_id <> 'aaaaaaaa-3333-4000-8000-000000000001') > 0
           then 'FAIL — attendance outside Operations is visible'
         else 'PASS — attendance limited to Operations'
       end as verdict
  from public.attendance_records a
  join public.employments e on e.id = a.employment_id;

-- Documents: a department head is deliberately NOT given sight of
-- personnel files. EXPECT 0.
select count(*) as documents_visible,
       case when count(*) = 0 then 'PASS — manager cannot see personnel files'
            else 'FAIL — manager can read ' || count(*) || ' documents' end as verdict
  from public.documents;

commit;


-- =====================================================================
-- BLOCK 2 — Manager is read-only.
-- EXPECT: UPDATE 0 (no write policy matches a manager).
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;

update public.people set last_name = 'ChangedByManager'
 where id = 'aaaaaaaa-2222-4000-8000-000000000004';

rollback;


-- =====================================================================
-- BLOCK 3 — Staff sees themselves and no one else.
-- As 'staff.a@alpha.test' (Adaeze).
--
-- EXPECT: exactly one person — Okonkwo. One employment. Her own
--         attendance only. Her own documents only.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;

select last_name, first_name from public.people;

select case when count(*) = 1 and min(last_name) = 'Okonkwo'
              then 'PASS — staff sees only themselves'
            else 'FAIL — staff sees ' || count(*) || ' people' end as verdict
  from public.people;

select case when count(*) filter (
              where e.person_id <> 'aaaaaaaa-2222-4000-8000-000000000004') > 0
              then 'FAIL — staff can see someone else''s attendance'
            else 'PASS — staff sees only their own attendance' end as verdict
  from public.attendance_records a
  join public.employments e on e.id = a.employment_id;

select case when count(*) filter (
              where person_id <> 'aaaaaaaa-2222-4000-8000-000000000004') > 0
              then 'FAIL — staff can see someone else''s documents'
            else 'PASS — staff sees only their own documents' end as verdict
  from public.documents;

commit;


-- =====================================================================
-- BLOCK 4 — Staff cannot clock in on somebody else's behalf.
-- EXPECT: ERROR — new row violates row-level security policy.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;

-- Emeka's employment, not Adaeze's.
insert into public.attendance_records (tenant_id, employment_id)
values ('aaaaaaaa-0000-4000-8000-000000000001',
        'aaaaaaaa-5555-4000-8000-000000000005');

rollback;


-- =====================================================================
-- BLOCK 5 — Rule 8. A time sent by the browser is discarded.
--
-- Adaeze has an open record. She tries to backdate her clock-in to
-- 2020, the way a phone with a changed clock would.
--
-- EXPECT: clock_in_at is unchanged — today, not 2020. The update is
--         not rejected; the value is simply thrown away and replaced
--         with what the server already had.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;

update public.attendance_records
   set clock_in_at = timestamptz '2020-01-01 06:00+01'
 where id = 'aaaaaaaa-8888-4000-8000-000000000009';

select clock_in_at,
       case when clock_in_at > now() - interval '1 day'
              then 'PASS — the browser''s time was discarded'
            else 'FAIL — a client-supplied timestamp was stored' end as verdict
  from public.attendance_records
 where id = 'aaaaaaaa-8888-4000-8000-000000000009';

rollback;


-- =====================================================================
-- BLOCK 6 — HR cannot read the audit log.
-- As 'hr.a@alpha.test' (Chinedu).
--
-- HR has no policy on audit_log at all, so the table returns nothing
-- rather than raising. EXPECT 0.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

select count(*) as audit_rows_visible_to_hr,
       case when count(*) = 0 then 'PASS — HR is blind to the audit log'
            else 'FAIL — HR read ' || count(*) || ' audit rows' end as verdict
  from public.audit_log;

commit;


-- =====================================================================
-- BLOCK 7 — Owner CAN read the audit log, and it is not empty.
--
-- The control for block 6: proves the zero above is a policy decision
-- and not an empty table.
-- EXPECT: a non-zero count, and rows from the seeding in step 1.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select count(*) as audit_rows_visible_to_owner,
       case when count(*) > 0 then 'PASS — owner can read the audit log'
            else 'FAIL — audit log empty, so block 6 proved nothing' end as verdict
  from public.audit_log;

select table_name, action, count(*)
  from public.audit_log
 group by table_name, action
 order by table_name, action;

commit;


-- =====================================================================
-- BLOCK 8 — Only an Owner may assign a role.
--
-- Row-level security cannot express a column-level rule, so this one is
-- a trigger. HR may edit a profile, but not its role.
-- EXPECT: ERROR — Only an Owner may change a role.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

update public.profiles
   set role = 'owner'
 where id = 'aaaaaaaa-1111-4000-8000-000000000004';   -- HR promotes Adaeze

rollback;


-- =====================================================================
-- BLOCK 9 — the same change, by the Owner. EXPECT: UPDATE 1.
-- Rolled back, so nothing actually changes.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

update public.profiles
   set role = 'manager'
 where id = 'aaaaaaaa-1111-4000-8000-000000000004';

rollback;


-- =====================================================================
-- BLOCK 10 — a correction without a reason is refused.
-- As HR. EXPECT: ERROR — A correction to an attendance record
-- requires a reason.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

update public.attendance_records
   set clock_in_at = now() - interval '3 hours'
 where id = 'aaaaaaaa-8888-4000-8000-000000000001';

rollback;


-- =====================================================================
-- BLOCK 11 — a correction WITH a reason succeeds, and the original
-- value survives beside it.
--
-- EXPECT: original_clock_in_at holds the time the record had before the
-- correction, corrected_by names HR, and the reason is stored.
-- Rolled back at the end.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

select clock_in_at as before_correction
  from public.attendance_records
 where id = 'aaaaaaaa-8888-4000-8000-000000000001';

update public.attendance_records
   set clock_in_at       = now() - interval '3 hours',
       correction_reason = 'Staff member was on site but the network was down.'
 where id = 'aaaaaaaa-8888-4000-8000-000000000001';

select clock_in_at,
       original_clock_in_at,
       clock_in_source,
       correction_reason,
       corrected_by,
       corrected_at,
       case when original_clock_in_at is not null
             and corrected_by = 'aaaaaaaa-1111-4000-8000-000000000002'
             and clock_in_source = 'hr_correction'
              then 'PASS — original preserved, correction attributed'
            else 'FAIL — the original value was lost' end as verdict
  from public.attendance_records
 where id = 'aaaaaaaa-8888-4000-8000-000000000001';

rollback;


-- =====================================================================
-- BLOCK 12 — Rule 3. Every change wrote itself to the audit log.
--
-- Nothing in this file's rolled-back blocks should appear. What should
-- appear is the seeding from step 1: inserts and updates across every
-- table, with before/after values.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select occurred_at, action, table_name, record_id,
       (before is not null) as has_before,
       (after  is not null) as has_after
  from public.audit_log
 order by occurred_at desc, id desc
 limit 25;

commit;
