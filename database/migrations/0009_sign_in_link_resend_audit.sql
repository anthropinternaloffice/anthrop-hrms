-- =====================================================================
-- 0009_sign_in_link_resend_audit.sql
-- Anthrop HRMS — resending a sign-in link.
--
-- Supabase's invitation and password-reset links are single use and they
-- expire. Both of those are correct. What was missing was a way to send
-- somebody another one without opening the Supabase dashboard, which in
-- practice meant asking the person who built the system.
--
-- The sending itself needs no database change — it is a Supabase auth
-- call, made by the `invite-user` Edge Function. This migration exists
-- for the other half: an administrator causing a fresh credential link
-- to be sent to somebody else's address is exactly the kind of event an
-- audit log is for, and no trigger can catch it, because no row is
-- written. Same shape as log_attendance_export() in 0007 and
-- log_employee_import() in 0008.
--
-- ---------------------------------------------------------------------
-- WHY THIS IS LOGGED BEFORE THE LINK IS SENT, AND REFUSES IF IT CANNOT
-- ---------------------------------------------------------------------
--
-- D17 settled this for the export: a log entry written first is a
-- precondition, not a receipt, and the function refuses the action when
-- it cannot record it.
--
-- A sign-in link is the stronger case. An email that was sent and not
-- recorded is a credential in somebody's inbox with nothing in the
-- system that says who caused it to be there. An entry recorded for an
-- email that then failed to send is a false line in the log, which is
-- worse in a different way — so the entry says a link was *requested*
-- for this account, which stays true either way, and the screen tells
-- the administrator plainly whether the email went.
--
-- ---------------------------------------------------------------------
-- WHAT IT DOES NOT COVER
-- ---------------------------------------------------------------------
--
-- Somebody asking for their own link on /forgot-password. There is no
-- signed-in caller there, no tenant, and no way to attribute it — and
-- the screen is reachable by anyone, including a stranger typing in an
-- address. Logging what an unauthenticated visitor typed would be
-- recording guesses, not activity. So the log covers links an
-- administrator sent to somebody else, which is the part with a person
-- behind it.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

-- Outside the transaction, for the same reason as 0007 and 0008:
-- Postgres will not let a new enum value be used in the transaction that
-- adds it.
alter type public.audit_action add value if not exists 'resend';


begin;

create or replace function public.log_sign_in_link_sent(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $fn$
declare
  v_tenant    uuid := app.current_tenant_id();
  v_role      public.app_role := app.current_app_role();
  v_person    uuid;
  v_active    boolean;
  v_name      text;
begin
  -- D14: a permission check that evaluates to NULL must deny. Written as
  -- explicit IS NULL tests rather than folded into a larger boolean,
  -- which is the shape that failed open in 0002.
  if v_tenant is null or v_role is null then
    raise exception 'That is not available.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Mirrors profiles_write_owner_hr and the Edge Function's own check.
  if v_role not in ('owner', 'hr') then
    raise exception 'Only an Owner or HR can send somebody a sign-in link.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Rule 1, at the only point it can be enforced for this event. The
  -- Edge Function reads the recipient's email address with the
  -- service_role key, which no policy applies to, so the tenant test has
  -- to happen here — before the log entry and therefore before the send.
  select person_id, is_active
    into v_person, v_active
    from public.profiles
   where id = p_user_id
     and tenant_id = v_tenant;

  if not found then
    raise exception 'That account is not in this organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not v_active then
    raise exception 'That account is switched off. Switch it back on before sending a sign-in link.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Who it was for, as they were called at the time. A profiles row
  -- carries no name, so without this the entry could only name a UUID.
  -- Null when the account has no employee record behind it, which is a
  -- real state and not an error (rule 4) — the screen renders the entry
  -- without a name rather than inventing one.
  if v_person is not null then
    select nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
      into v_name
      from public.people
     where id = v_person
       and tenant_id = v_tenant;
  end if;

  insert into public.audit_log
    (tenant_id, actor_user_id, action, table_name, record_id, before, after)
  values
    (v_tenant, auth.uid(), 'resend', 'profiles', p_user_id, null,
     jsonb_build_object(
       'recipient_name', v_name,
       -- Not the email address. The log is Owner-only, but the address
       -- adds nothing a reader needs: the account is identified by
       -- record_id, and where the link went is whatever that account's
       -- address was at the time.
       'link', 'sign_in'
     ));
end;
$fn$;

comment on function public.log_sign_in_link_sent(uuid) is
  'Records that an administrator caused a fresh sign-in link to be sent to another account. Called by the invite-user Edge Function before the link is sent; refusing here refuses the send.';

-- D14: Supabase grants EXECUTE on every new public function to anon by
-- default, and `revoke ... from public` does not remove that grant.
revoke all on function public.log_sign_in_link_sent(uuid) from anon, public;
grant execute on function public.log_sign_in_link_sent(uuid) to authenticated;

commit;


-- =====================================================================
-- Verification
-- =====================================================================
--
-- Rolled back, so a FAIL cannot leave its audit row behind.

begin;

create temp table _resend_check (check_name text, result text);

do $$
begin
  -- Behavioural. Nobody is signed in in the SQL editor, so
  -- app.current_tenant_id() is NULL — the condition that let
  -- log_document_download() fail open until 0005.
  begin
    perform public.log_sign_in_link_sent('00000000-0000-0000-0000-000000000000'::uuid);
    insert into _resend_check values
      ('refuses a caller with no tenant',
       'FAIL - an unauthenticated call was accepted. Do not deploy.');
  exception when others then
    insert into _resend_check values
      ('refuses a caller with no tenant', 'PASS - refused with: ' || sqlerrm);
  end;
end $$;

select 'resend exists in audit_action' as check_name,
       case when exists (
         select 1
           from pg_type t
           join pg_enum e on e.enumtypid = t.oid
          where t.typname = 'audit_action' and e.enumlabel = 'resend'
       ) then 'PASS' else 'FAIL - the enum value was not added' end as result
union all
select 'anon cannot execute it',
       case when has_function_privilege('anon', 'public.log_sign_in_link_sent(uuid)', 'execute')
            then 'FAIL - anon holds EXECUTE. See D14.' else 'PASS' end
union all
select 'authenticated can execute it',
       case when has_function_privilege('authenticated', 'public.log_sign_in_link_sent(uuid)', 'execute')
            then 'PASS' else 'FAIL - the grant is missing' end
union all
select * from _resend_check;

rollback;
