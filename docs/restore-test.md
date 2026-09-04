# Testing the restore

A backup nobody has restored is a file, not a backup.

Do this **once in the first month**, on a quiet afternoon, into a throwaway project. Not on
the day it matters, when you will be reading it for the first time under pressure and
discovering what it does not cover.

Budget an hour. Most of it is waiting for a new Supabase project to finish provisioning.

---

## What the backup does and does not contain

Read this part before you need it.

Verified by opening a real artifact on 2026-09-04, not assumed:

| | In the backup? |
|---|---|
| Every `public` table: people, employments, departments, job titles, attendance, audit log | **Yes** |
| Row-level security, policies, triggers, functions | **Yes** — 10 tables with RLS, 30 policies, 20 triggers |
| **Login accounts** — `auth.users`, `auth.identities`, `auth.sessions` | **Yes**, including password hashes |
| Storage **bucket and object metadata** | **Yes** |
| **Employee documents — the actual file contents** | **No** |
| `00-roles.sql` | Almost nothing — see below |

**Documents are the real gap.** `storage.objects` rows restore, so the new database knows a
file existed, what it was called and who uploaded it. The bytes do not: they live in S3, not
in Postgres. After a restore the Documents section of a profile will list a file and fail to
download it. If Anthrop needs the files recoverable too, that is a separate job and it has
not been built. Say so early in an incident rather than discovering it halfway through.

**Logins do come back.** `auth.users` restores with `encrypted_password` and
`email_confirmed_at`, along with `auth.identities`. People should be able to sign in with
their existing passwords, and `profiles.id` will still match. Test it rather than trust it —
but do not plan a recovery around recreating every account, because that is probably
unnecessary.

**`00-roles.sql` is nearly empty**, and that is fine. It carries a few `ALTER ROLE ... SET
statement_timeout` lines and one unrelated grant — no `CREATE ROLE` at all, because `anon`,
`authenticated` and `authenticator` already exist in every Supabase project. Run it for
completeness; do not be alarmed that it is 370 bytes.

**The artifact contains password hashes.** That is worth knowing when deciding who may
download it, and is another reason the repository stays private.

---

## The test

### 1. Get a backup

GitHub → **Actions** → **Nightly backup** → the most recent successful run → download the
artifact under **Artifacts**. You get `00-roles.sql`, `01-schema.sql`, `02-data.sql` and a
`README.txt` saying when it was taken.

If there is no successful run, that is the finding. Stop and fix the workflow — this
exercise has already paid for itself.

### 2. Make a throwaway project

supabase.com → **New project**. Name it something unmistakable such as
`anthrop-restore-test`. Same region (London) so the comparison is fair. Save the password;
you will need it in a moment.

Wait for provisioning to finish before going on.

### 3. Load the three files, in order

Supabase SQL editor on the **throwaway** project. Paste and run each file in full, in this
order, checking each finishes before starting the next:

1. `00-roles.sql`
2. `01-schema.sql`
3. `02-data.sql`

Order is not optional. The schema grants privileges to roles, so the roles must exist first;
the data references tables, so the schema must exist before it.

**Expect some noise.** Roles like `anon` and `authenticated` already exist in a new Supabase
project, so `00-roles.sql` may report that some already exist. That is fine. What is not
fine is an error mentioning a *table*, a *policy* or a *constraint* — write those down.

**Two failures found on 2026-09-04, both since fixed in the workflow.** If you are restoring
an artifact taken *before* that date, you will hit them:

- `00-roles.sql` stops with **permission denied** on a
  `GRANT SET ON PARAMETER "log_min_messages"` line. Delete that line and re-run. Backups
  taken after the fix have it stripped already.
- `02-data.sql` fails with **`syntax error at or near "\"`**. That dump used
  `COPY ... FROM stdin`, whose terminator is a psql client command rather than SQL, so the
  SQL editor cannot run it at all. Such a file can only be loaded with `psql`:
  `psql "<session pooler connection string>" -f 02-data.sql`. Backups taken after the fix
  use `INSERT` statements and paste straight in.

### 4. Check the data is really there

**The one-minute version.** Run this on the throwaway project and on the live one, and
compare the two rows. It answers every question in steps 4 and 5 at once, which is why it is
first — an administrator mid-incident should not have to run five queries to find out whether
the restore worked.

```sql
select (select count(*) from public.tenants)             as tenants,
       (select count(*) from public.people)              as people,
       (select count(*) from public.departments)         as depts,
       (select count(*) from public.job_titles)          as titles,
       (select count(*) from public.profiles)            as profiles,
       (select count(*) from public.employments)         as employments,
       (select count(*) from public.documents)           as docs,
       (select count(*) from public.emergency_contacts)  as emerg,
       (select count(*) from public.attendance_records)  as attend,
       (select count(*) from public.audit_log)           as audit,
       (select count(*) from pg_tables
          where schemaname = 'public' and rowsecurity)    as rls_on,
       (select count(*) from pg_tables
          where schemaname = 'public' and not rowsecurity) as rls_off,
       (select count(*) from pg_policies
          where schemaname = 'public')                    as policies,
       (select count(*) from auth.users)                  as auth_users,
       (select count(*) from storage.objects)             as stor_obj;
```

`rls_off` must be **zero**. Not "small" — zero. Any table in `public` without row-level
security is one where every tenant can read every other tenant's rows, and a restore that
brings the data back without the policies is a leak wearing the costume of a recovery.

As of 2026-09-04 the live project answers: 1, 2, 2, 2, 1, 1, 1, 0, 1, 41 — then **10** tables
with RLS, **0** without, **30** policies, 1 auth user, 1 storage object. Your numbers will
have grown; the shape is what matters.

The rest of this section is the longer form, worth running when you have time rather than an
incident.

Run this on the throwaway project:

```sql
select 'tenants' as table_name, count(*) from public.tenants
union all select 'people',             count(*) from public.people
union all select 'departments',        count(*) from public.departments
union all select 'job_titles',         count(*) from public.job_titles
union all select 'profiles',           count(*) from public.profiles
union all select 'employments',        count(*) from public.employments
union all select 'documents',          count(*) from public.documents
union all select 'emergency_contacts', count(*) from public.emergency_contacts
union all select 'attendance_records', count(*) from public.attendance_records
union all select 'audit_log',          count(*) from public.audit_log
order by 1;
```

Run the same query on the **live** project and compare. The numbers should match, allowing
for anything added since the backup was taken.

**A count is not enough on its own.** Open a few rows and look at them:

```sql
select first_name, last_name, phone, email from public.people limit 5;
select clock_in_at, clock_out_at, correction_reason from public.attendance_records limit 5;
```

Phone numbers should still be in `+234…` form. Timestamps should still carry their zone. A
dump that restored the right *number* of rows with mangled *contents* is a failure that a
count would have passed.

### 5. Check the security came back with it

The point of restoring is to have a working system, and this system's guarantees are its
policies. A restore that brings the data but not the row-level security is not a recovery —
it is a leak.

```sql
select tablename,
       rowsecurity                                          as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
order by tablename;
```

Every table must show `rls_enabled = true` and a non-zero policy count. Ten tables, thirty
policies, matching the live project.

If RLS came back disabled anywhere, stop and treat it as a serious finding: it means a
restore performed in a hurry would quietly expose every tenant's data to every user.

### 6. Write down what you found

In this file, at the bottom, add a line: the date, the backup you used, whether the counts
matched, and anything that went wrong. Three lines is enough. The next person to do this —
possibly you in a year — needs to know it has been done and what to expect.

### 7. Delete the throwaway project

Supabase → the test project → Settings → General → **Delete project**.

Do it now, not later. It holds a full copy of Anthrop's personnel data, and a forgotten test
project is exactly the kind of thing that turns into an incident on its own. Check the name
twice before confirming.

---

## If you are doing this for real

Not a drill — the live project is gone or corrupted. Same steps, plus:

1. **Restore into a new project, never over the damaged one.** Whatever is left may be
   evidence of what went wrong, and you get one chance to keep it.
2. **Check whether people can sign in.** The logins should restore with their passwords.
   If they do not, create the Owner in Authentication → Users and repoint
   `public.profiles.id` at the new auth user id — start with the Owner or nobody can
   administer anything.
3. **The document files are not coming back from this.** The records of them will be there,
   which is worse than nothing if nobody says so — the app will list files it cannot serve.
   Tell whoever is waiting, early.
4. **Repoint the application**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
   Cloudflare, then rebuild — the values are baked in at build time, so editing them alone
   changes nothing. The site address needs no change; it is read from the browser (D11).
   See `docs/deployment.md`.
5. **Redo the Supabase Auth URL configuration** — Site URL and the redirect allowlist — or
   password reset will fail silently while everything else appears to work.

---

## Restore test log

Add a line each time. Empty until the first test is run.

| Date | Backup used | Counts matched? | Notes |
|---|---|---|---|
| 2026-09-04 | `anthrop-hrms-backup-2026-09-04T10-45-07Z` | Inspected only | Contents verified against the live database: 10 tables, 30 policies, 52 data rows, correction trail intact. |
| 2026-09-04 | same artifact | **No — restore FAILED** | Roles: permission denied on a `GRANT SET ON PARAMETER` line. Schema: restored cleanly. **Data: would not load at all** — the dump used `COPY ... FROM stdin`, which the SQL editor cannot execute. The data was never at risk, but the documented restore path did not work. Both causes fixed in `backup.yml`; needs re-testing with a fresh artifact. |
| 2026-09-04 | `anthrop-hrms-backup-2026-09-04T12-10-02Z` | **Yes — restore PASSED** | First clean end-to-end restore into a throwaway project. All three files ran in the SQL editor with no errors. 52 rows across the ten public tables, 10 tables with RLS on and 0 without, 30 policies, 1 auth user, 1 storage object — all matching live. Throwaway project deleted afterwards. |
