-- =====================================================================
-- 02_prove_tenant_isolation.sql
-- Anthrop HRMS — Task 4, step 2 of 4
--
-- THE TEST EVERYTHING ELSE RESTS ON.
--
-- Proves that a user in tenant A cannot read a single row belonging to
-- tenant B, for every one of the ten tables — and then proves the same
-- in the other direction.
--
-- Run 01_seed_two_tenants.sql first and check its final table: every
-- row must show a non-zero count for BOTH tenants. A test that returns
-- zero foreign rows because the table is empty proves nothing.
--
-- HOW THIS IMPERSONATES A USER
-- ----------------------------
-- The SQL editor connects as `postgres`, which owns these tables and
-- therefore bypasses row-level security entirely. Running the queries
-- as-is would show you everything and tell you nothing.
--
-- Two statements fix that, and both are required:
--
--   set local request.jwt.claims = '{"sub":"<user id>", ...}';
--       auth.uid() reads the `sub` claim out of this setting. This is
--       what makes the database believe it is serving that person.
--
--   set local role authenticated;
--       Drops out of `postgres` into the same role the frontend uses.
--       Without this, RLS is still bypassed and every test passes
--       vacuously.
--
-- `set local` lasts only to the end of the transaction, so the
-- begin/commit around each block is not decoration — it is what stops
-- the impersonation leaking into your next query.
--
-- RUN EACH BLOCK SEPARATELY and read its verdict column.
-- =====================================================================


-- =====================================================================
-- BLOCK 1 — as the OWNER of tenant A: 'owner.a@alpha.test'
--
-- Owner is the most privileged role there is, so this is the strongest
-- possible version of the test. If tenant B's rows are invisible to
-- tenant A's Owner, they are invisible to everyone in tenant A.
--
-- EXPECT: foreign_rows = 0 on all ten rows, verdict PASS throughout.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select table_name, rows_visible, foreign_rows,
       case when foreign_rows = 0 then 'PASS'
            else 'FAIL — LEAKED ' || foreign_rows || ' ROWS' end as verdict
from (
  select 'tenants' as table_name, count(*) as rows_visible,
         count(*) filter (where id = 'bbbbbbbb-0000-4000-8000-000000000001') as foreign_rows
    from public.tenants
  union all select 'people',             count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.people
  union all select 'departments',        count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.departments
  union all select 'job_titles',         count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.job_titles
  union all select 'profiles',           count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.profiles
  union all select 'employments',        count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.employments
  union all select 'documents',          count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.documents
  union all select 'emergency_contacts', count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.emergency_contacts
  union all select 'attendance_records', count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.attendance_records
  union all select 'audit_log',          count(*), count(*) filter (where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001') from public.audit_log
) t
order by table_name;

commit;


-- =====================================================================
-- BLOCK 2 — the same test in the opposite direction.
-- As the OWNER of tenant B: 'owner.b@beta.test'
--
-- Isolation is not symmetrical by default. A policy can be written that
-- happens to hide B from A while leaving A exposed to B, so the mirror
-- has to be run rather than assumed.
--
-- EXPECT: foreign_rows = 0 on all ten rows, verdict PASS throughout.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select table_name, rows_visible, foreign_rows,
       case when foreign_rows = 0 then 'PASS'
            else 'FAIL — LEAKED ' || foreign_rows || ' ROWS' end as verdict
from (
  select 'tenants' as table_name, count(*) as rows_visible,
         count(*) filter (where id = 'aaaaaaaa-0000-4000-8000-000000000001') as foreign_rows
    from public.tenants
  union all select 'people',             count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.people
  union all select 'departments',        count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.departments
  union all select 'job_titles',         count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.job_titles
  union all select 'profiles',           count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.profiles
  union all select 'employments',        count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.employments
  union all select 'documents',          count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.documents
  union all select 'emergency_contacts', count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.emergency_contacts
  union all select 'attendance_records', count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.attendance_records
  union all select 'audit_log',          count(*), count(*) filter (where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001') from public.audit_log
) t
order by table_name;

commit;


-- =====================================================================
-- BLOCK 3 — naming the row directly.
--
-- The counts above could in principle be satisfied by a policy that
-- filters aggregates but not lookups. This asks for tenant B's people
-- by primary key, as tenant A's Owner. There is no aggregate to hide
-- behind.
--
-- EXPECT: zero rows returned. Not a row of nulls — no rows at all.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select 'DIRECT LOOKUP LEAKED THIS ROW' as verdict, id, first_name, last_name, email, phone
  from public.people
 where id in ('bbbbbbbb-2222-4000-8000-000000000001',
              'bbbbbbbb-2222-4000-8000-000000000002');

-- Same again through a join, in case a policy is bypassed by the
-- planner when the table is reached indirectly.
select 'JOIN LEAKED THIS ROW' as verdict, p.last_name, d.name as department, e.start_date
  from public.employments e
  join public.people p      on p.id = e.person_id
  join public.departments d on d.id = e.department_id
 where e.tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001';

-- And the audit log, which carries whole rows of other tenants' data
-- inside its before/after columns.
select 'AUDIT LOG LEAKED THIS ROW' as verdict, id, table_name, action, occurred_at
  from public.audit_log
 where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001';

commit;


-- =====================================================================
-- BLOCK 4 — writing across the boundary.
--
-- Reading is only half of isolation. A tenant that cannot read another
-- tenant's rows but can overwrite them is not isolated.
--
-- Run these ONE AT A TIME. Each must raise an error or affect 0 rows.
-- If any of them succeeds, that is a FAIL.
-- =====================================================================

-- 4a. Insert a person into tenant B while logged in as tenant A's Owner.
--     EXPECT: ERROR — new row violates row-level security policy.
begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

insert into public.people (tenant_id, first_name, last_name)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'Injected', 'Row');

rollback;   -- if it did NOT error, this undoes the damage


-- 4b. Update one of tenant B's people as tenant A's Owner.
--     EXPECT: UPDATE 0.
begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

update public.people
   set last_name = 'Tampered'
 where id = 'bbbbbbbb-2222-4000-8000-000000000001';

rollback;


-- 4c. Delete one of tenant B's people as tenant A's Owner.
--     EXPECT: DELETE 0.
begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

delete from public.people
 where id = 'bbbbbbbb-2222-4000-8000-000000000001';

rollback;


-- 4d. Move one of tenant A's own rows into tenant B — the subtle one.
--     Reading and writing are both correctly scoped, but if WITH CHECK
--     were missing, a user could push their own row across the border.
--     EXPECT: ERROR — new row violates row-level security policy.
begin;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

update public.people
   set tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001'
 where id = 'aaaaaaaa-2222-4000-8000-000000000004';

rollback;


-- =====================================================================
-- BLOCK 5 — the control.
--
-- Everything above returns zero. This block exists to prove that zero
-- means "blocked" and not "the query is broken" or "the table is
-- empty". Same connection, same statements, same tables — only the
-- impersonated user changes, to tenant B's own Owner.
--
-- EXPECT: NON-ZERO counts. If this block also returns zeros, the tests
-- above are meaningless and nothing has been proved.
-- =====================================================================

begin;
set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select 'people in tenant B, seen by tenant B'      as control, count(*) as must_be_above_zero from public.people
union all
select 'employments in tenant B, seen by tenant B', count(*) from public.employments
union all
select 'documents in tenant B, seen by tenant B',   count(*) from public.documents
union all
select 'attendance in tenant B, seen by tenant B',  count(*) from public.attendance_records
union all
select 'audit rows in tenant B, seen by tenant B',  count(*) from public.audit_log;

commit;
