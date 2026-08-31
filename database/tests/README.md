# Security tests

Proof that tenant isolation and the role rules actually hold. Everything
in the system rests on this: if a user in one organisation can read
another organisation's rows, no screen should be built until that is
fixed.

These are **not migrations.** They do not run automatically and they
never run against real data.

## Why impersonation is necessary

The Supabase SQL editor connects as `postgres`. That role owns these
tables, so it **bypasses row-level security completely**. Pasting the
queries in as-is would show you every row in the database and tell you
nothing about whether the policies work.

Two statements are needed to test as a real user, and both matter:

```sql
set local request.jwt.claims = '{"sub":"<auth user id>","role":"authenticated"}';
set local role authenticated;
```

- The first is where `auth.uid()` gets its answer. It makes the database
  believe it is serving that person.
- The second drops out of `postgres` into the role the frontend actually
  connects as. **Without it every test passes vacuously.**

`set local` lasts only until the end of the transaction, which is why
each block is wrapped in `begin` / `commit`. That is not decoration — it
stops the impersonation leaking into whatever you run next.

## How to run

Open the Supabase SQL editor. Run the files in order, **one block at a
time**, reading the verdict column after each.

| Step | File | What it does |
|---|---|---|
| 1 | `01_seed_two_tenants.sql` | Creates two unrelated organisations with rows in every table |
| 2 | `02_prove_tenant_isolation.sql` | The required proof: tenant A cannot reach tenant B, for every table |
| 3 | `03_prove_role_scoping.sql` | Manager, Staff and HR limits; server-set time; corrections; audit log |
| 4 | `99_teardown.sql` | Removes both test organisations and their users |

### Step 1 first, and read its output

The last query in `01_seed_two_tenants.sql` prints a row per table with
a count for each tenant. **Every row must show a non-zero count for
both.** If a table is empty, the isolation test for it will return zero
foreign rows because there is nothing to find, and will look like a pass
while proving nothing.

If the `auth.users` block fails with `function gen_salt does not exist`,
change `crypt(...)` to `extensions.crypt(...)` and `gen_salt(...)` to
`extensions.gen_salt(...)`. Nothing else changes.

### Reading the results

Blocks that produce a table have a `verdict` column saying PASS or FAIL
in words. Blocks that test a *write* have no verdict column, because a
correctly blocked write either raises an error or reports affecting zero
rows — read the message the editor prints:

| Block | A pass looks like |
|---|---|
| 02 block 4a | `ERROR: new row violates row-level security policy for table "people"` |
| 02 block 4b | `UPDATE 0` |
| 02 block 4c | `DELETE 0` |
| 02 block 4d | `ERROR: new row violates row-level security policy for table "people"` |
| 03 block 2 | `UPDATE 0` |
| 03 block 4 | `ERROR: new row violates row-level security policy` |
| 03 block 8 | `ERROR: Only an Owner may change a role.` |
| 03 block 9 | `UPDATE 1` |
| 03 block 10 | `ERROR: A correction to an attendance record requires a reason.` |

Every write test ends in `rollback`, so nothing it does survives — even
if a test unexpectedly succeeds, the damage is undone.

### The control blocks

`02` block 5 and `03` block 7 are there on purpose. Everything else
returns zero, and a zero is only meaningful if the same query against
the same table returns something non-zero for the person who *is*
entitled to it. If a control block also returns zero, the test above it
proved nothing.

## The test accounts

All six share the password `Anthrop-Test-2026!`. They exist to be
impersonated in SQL; they can also be used to sign in through the app
once Task 5 exists, which is how definition-of-done items 9 and 10 get
checked by hand.

| Email | Role | Organisation | Person |
|---|---|---|---|
| `owner.a@alpha.test` | Owner | Alpha Institution | Damilola Ogun, Operations |
| `hr.a@alpha.test` | HR | Alpha Institution | Chinedu Eze, Finance |
| `manager.a@alpha.test` | Manager | Alpha Institution | Bola Adeyemi, head of Operations |
| `staff.a@alpha.test` | Staff | Alpha Institution | Adaeze Okonkwo, Operations |
| `owner.b@beta.test` | Owner | Beta Authority | Folake Bello |
| `staff.b@beta.test` | Staff | Beta Authority | Gbenga Salami |

Emeka Nwosu (Alpha, Finance) has **no login on purpose**. He is the row
the Operations manager must not be able to see, and he carries no phone,
no date of birth and no address — the `null` case that has to render as
"Not stated".

## Delete these before go-live

`99_teardown.sql` removes both organisations, their six auth users, and
their audit rows. Run it once the tests pass and again before the
system carries any real staff data.
