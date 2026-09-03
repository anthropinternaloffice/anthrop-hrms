-- =====================================================================
-- 0003_heartbeat.sql
-- Anthrop HRMS — Task 14. Something the keep-alive can call.
--
-- Supabase pauses a free project after seven days without database
-- activity, and waking it is a manual step somebody has to notice is
-- needed. The keep-alive workflow prevents that by touching the
-- database every two days.
--
-- It needs something to touch. As things stand `anon` has no grant on
-- any table — every grant in 0001 went to `authenticated` — so an
-- anonymous request gets `42501 permission denied`. That error does
-- reach Postgres, and would technically count as activity, but building
-- a health check that succeeds only by failing is a poor idea: it reads
-- as broken, it fills the logs with permission errors, and it changes
-- meaning the day somebody grants `anon` something.
--
-- So there is one function, callable by anyone, that returns the time
-- and reveals nothing else. No table is exposed and no policy is
-- weakened.
--
-- The alternative was to give the workflow a service_role key. That key
-- bypasses every policy in the database, and putting it in CI to
-- perform `select 1` would be the largest privilege in the system spent
-- on the smallest possible task.
--
-- Run in the Supabase SQL editor as `postgres`, once.
-- =====================================================================

begin;

create or replace function public.heartbeat()
returns timestamptz
language sql
stable
-- Deliberately NOT security definer. It reads nothing, so it needs no
-- privileges beyond the caller's own.
set search_path = pg_temp
as $$
  select now();
$$;

comment on function public.heartbeat() is
  'Returns the server time. Exists so the keep-alive workflow can reach the database without a privileged key. Reveals nothing.';

revoke all on function public.heartbeat() from public;
grant execute on function public.heartbeat() to anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- Verification. Expect one row: the function, security invoker, and
-- execute granted to anon.
-- ---------------------------------------------------------------------

select
  p.proname                                                    as function_name,
  case when p.prosecdef then 'definer - WRONG' else 'invoker - correct' end as security,
  has_function_privilege('anon', p.oid, 'execute')             as anon_may_execute,
  public.heartbeat()                                           as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'heartbeat';
