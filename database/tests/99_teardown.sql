-- =====================================================================
-- 99_teardown.sql
-- Anthrop HRMS — Task 4, step 4 of 4
--
-- Removes both test organisations and everything hanging off them.
--
-- Run as `postgres` in the Supabase SQL editor. Deletion order follows
-- the foreign keys: anything with ON DELETE RESTRICT above it has to go
-- first.
--
-- The audit log is cleared LAST, because deleting all the rows above
-- writes a fresh audit entry for every one of them.
--
-- Nothing here touches a row that is not one of the two test tenants.
-- =====================================================================

begin;

delete from public.attendance_records
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.documents
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.emergency_contacts
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.employments
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.profiles
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from auth.users
 where id in ('aaaaaaaa-1111-4000-8000-000000000001',
              'aaaaaaaa-1111-4000-8000-000000000002',
              'aaaaaaaa-1111-4000-8000-000000000003',
              'aaaaaaaa-1111-4000-8000-000000000004',
              'bbbbbbbb-1111-4000-8000-000000000001',
              'bbbbbbbb-1111-4000-8000-000000000002');

delete from public.departments
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.job_titles
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.people
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

delete from public.tenants
 where id in ('aaaaaaaa-0000-4000-8000-000000000001',
              'bbbbbbbb-0000-4000-8000-000000000001');

-- Last: the audit trail of everything above, including these deletes.
delete from public.audit_log
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001');

commit;

-- Should return no rows.
select 'LEFT BEHIND' as warning, 'tenants' as table_name, count(*)
  from public.tenants
 where id in ('aaaaaaaa-0000-4000-8000-000000000001',
              'bbbbbbbb-0000-4000-8000-000000000001')
having count(*) > 0
union all
select 'LEFT BEHIND', 'people', count(*) from public.people
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001')
having count(*) > 0
union all
select 'LEFT BEHIND', 'audit_log', count(*) from public.audit_log
 where tenant_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                     'bbbbbbbb-0000-4000-8000-000000000001')
having count(*) > 0;
