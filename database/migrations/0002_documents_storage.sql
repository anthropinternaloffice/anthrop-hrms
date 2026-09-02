-- =====================================================================
-- 0002_documents_storage.sql
-- Anthrop HRMS — Task 10. Employee documents.
--
-- Migration 0001 created the `documents` table and its policies. It did
-- not create anywhere to put the files. This does, and adds the one
-- thing the brief asks for that no row trigger can provide: a record of
-- every download.
--
-- Run this in the Supabase SQL editor as `postgres`, once.
--
-- Rule 5 is respected: 0001 is untouched. This is a new numbered file.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. The bucket
--
-- `public => false`. Nothing in here is ever reachable by URL alone.
-- Files are served only through short-lived signed links, which is what
-- the brief means by "no public URLs".
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------
-- 2. Who may touch the files
--
-- Object paths are  <tenant_id>/<person_id>/<random>.<ext>  so the first
-- folder is the tenant and can be checked without a join.
-- ---------------------------------------------------------------------

-- Reading mirrors the `documents` table exactly, by asking it. The inner
-- select runs as the caller, so every policy already written for
-- documents — Owner and HR see their tenant, Staff see only their own —
-- governs the files too, with no second copy of the rules to drift.
drop policy if exists employee_documents_read on storage.objects;
create policy employee_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employee-documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
    )
  );

-- Writing cannot ask the documents table, because the file is uploaded
-- before its row exists. So the tenant is taken from the path and the
-- role is checked directly.
drop policy if exists employee_documents_write on storage.objects;
create policy employee_documents_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
    and (select app.current_app_role()) in ('owner', 'hr')
  );

-- Deletion exists so a half-finished upload can be cleaned up rather
-- than left as an orphaned file nobody can see or account for.
drop policy if exists employee_documents_delete on storage.objects;
create policy employee_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
    and (select app.current_app_role()) in ('owner', 'hr')
  );

-- ---------------------------------------------------------------------
-- 3. Logging a download
--
-- Rule 3 says every change writes to the audit log, and triggers handle
-- that. A download changes nothing, so no trigger fires — but the brief
-- requires it recorded, and `audit_action` already carries 'download'
-- for exactly this.
--
-- `authenticated` holds no insert grant on audit_log, deliberately: an
-- audit trail the client can write is an audit trail the client can
-- forge. This function is SECURITY DEFINER so it can insert, and because
-- that bypasses row-level security it re-checks the caller's right to
-- the document itself rather than assuming it.
--
-- It returns the storage path, so the honest path is also the easy one:
-- the application asks this function where the file is, and logging
-- happens on the way.
--
-- It lives in `public`, unlike the helpers in 0001 which live in `app`.
-- That is not inconsistency: PostgREST only exposes `public`, and this
-- is the one function the client is meant to call. The `app` helpers are
-- internal to the policies and should stay unreachable from a browser.
--
-- KNOWN LIMIT, recorded rather than hidden: Module 1 has no server, so
-- signing the URL and writing the log cannot be made one atomic step.
-- Someone bypassing this application with their own client could obtain
-- a signed link without a log line. They could only do so for documents
-- row-level security already lets them read, so this is a gap in audit
-- completeness, not an unauthorised disclosure. Closing it needs the
-- Module 2 backend, where the signed link can be minted server-side.
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
  if not (
    v_tenant = app.current_tenant_id()
    and (
      app.current_app_role() in ('owner', 'hr')
      or v_person = app.current_person_id()
    )
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

revoke all on function public.log_document_download(uuid) from public;
grant execute on function public.log_document_download(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------
-- Verification. Expect: one row for the bucket showing public = false,
-- three storage policies, and one function.
-- ---------------------------------------------------------------------

select 'bucket' as what, id as detail, case when public then 'PUBLIC - WRONG' else 'private - correct' end as state
  from storage.buckets where id = 'employee-documents'
union all
select 'storage policy', policyname, cmd
  from pg_policies where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'employee_documents%'
union all
select 'function', p.proname, case when p.prosecdef then 'security definer' else 'security invoker - WRONG' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'log_document_download';
