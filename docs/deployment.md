# Deploying Anthrop HRMS

Module 1 is a static single-page application talking directly to Supabase. There is no
server to run. Cloudflare Pages builds the site from this repository and serves the result.

The human does the deploying. This document is the whole of what that takes.

---

## The one thing that catches people out

**Environment variables are baked into the JavaScript at build time, not read when the page
loads.** Vite replaces `import.meta.env.VITE_*` with literal strings during `npm run build`.

Two consequences:

1. **Set the variables in Cloudflare _before_ the first build.** A build made without them
   ships a site that cannot reach Supabase at all.
2. **Changing a variable does nothing until you rebuild.** After editing one in the
   Cloudflare dashboard, trigger a new deployment. Nothing about the running site picks it
   up on its own.

**The site's own address is deliberately not one of them.** It is read from the browser
(`window.location.origin`) each time it is needed, so it is correct on localhost, on every
preview deployment, and after the move to `hr.anthropmanagement.com` — with no rebuild and
nothing to configure. See D11 in `docs/decisions.md` for why that is safe.

---

## Before the first deployment

These are database steps, not Cloudflare ones, and the site will look broken without them.

| Step | Where | Why |
|---|---|---|
| Run `database/migrations/0001_module1_core_schema.sql` | Supabase SQL editor | Tables, row-level security, triggers |
| Run `database/migrations/0002_documents_storage.sql` | Supabase SQL editor | Private document bucket and the download log |
| Run `database/migrations/0003_heartbeat.sql` | Supabase SQL editor | Gives the keep-alive workflow something to call |
| Run `database/migrations/0004_user_administration.sql` | Supabase SQL editor | Lockout guards, and the two functions the Users and roles screen needs |
| Run `database/migrations/0005_revoke_anon_and_fix_download_guard.sql` | Supabase SQL editor | Takes `EXECUTE` away from `anon`, and makes the document-download permission check fail closed. **Not optional** — see D14 |
| Create the Owner's login | Supabase → Authentication → Users → Add user, **Auto Confirm** ticked | Nothing in the application can create the first administrator |
| Run `database/seed/01_bootstrap_first_owner.sql` | Supabase SQL editor | Creates the organisation and makes that login its Owner |
| Deploy the `invite-user` function | See below | Without it, nobody can be given an account from inside the application |

Verify each one: every script ends with a query that prints what it created.

0004 ends with two extra checks worth reading rather than skipping: four `correct`/`WRONG`
lines, and a comparison proving that the two places which decide a Manager's departments
still agree with each other.

---

## Cloudflare Pages settings

Connect the GitHub repository, then set exactly this:

| Setting | Value |
|---|---|
| Framework preset | **Vite** |
| Build command | **`npm run build`** |
| Build output directory | **`dist`** |
| Root directory | **`frontend`** |

The root directory matters. This repository holds `frontend/`, `database/` and `docs/` side
by side, and Cloudflare needs to be told the application is in the first of them.

`frontend/public/_redirects` is copied into the build and sends every address to
`index.html`. Without it, a refresh on `/app/employees` returns a 404 from the CDN rather
than the page — the router never gets a chance to run. Confirm `_redirects` is present in
the deployed files if deep links 404.

### Node version

The build needs **Node 22.12 or newer**. `@supabase/supabase-js` requires Node 22 or above
and Vite 8 requires `^20.19 || >=22.12`, so the two together rule out anything older. It is
declared in `frontend/package.json` under `engines`.

`frontend/.node-version` contains `22` and Cloudflare Pages reads it, so this should be
handled already. If a build fails with a syntax error inside a dependency, or a message
about an unsupported engine, set **`NODE_VERSION`** to `22` in the environment variables as
well — that is the same problem wearing a different hat, and it is the likeliest reason a
build that works locally fails on Cloudflare.

---

## Environment variables

Set both in **Cloudflare Pages → Settings → Environment variables**, for the **Production**
environment (and Preview too, if you use preview deployments).

| Variable | Where to find it | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **Publishable** key (or the legacy **anon** key) | `sb_publishable_…` |

There used to be a third, `VITE_SITE_URL`. It is now optional and should be left unset — the
address is read live from the browser. Set it only if the app is ever served from behind a
proxy on a different public address than the browser sees.

### What must never go here

The **`service_role`** key. It bypasses every row-level security policy in the database, and
anything in this file ships inside the JavaScript bundle where anyone can read it. Rule 6.

The application defends itself: `frontend/src/lib/env.ts` decodes the key it is given and
refuses to start if it turns out to be a `service_role` token. If a future security scan
reports the string `service_role` inside the bundle, that is this guard, not a key.

If a `service_role` key ever reaches a deployment, rotate it in Supabase immediately.
Removing it from Cloudflare is not enough — it is already in a build that someone may have
downloaded.

---

## Supabase settings the deployment depends on

Easy to miss, because everything else works without them and only password reset breaks.

**Supabase → Authentication → URL Configuration**

- **Site URL** — the deployed address, e.g. `https://anthrop-hrms.pages.dev`
- **Redirect URLs** — add `https://anthrop-hrms.pages.dev/reset-password`

The application sends users to `<the address they are on>/reset-password` from the reset email.
Supabase refuses to redirect anywhere that is not on that allowlist, so a reset link will
fail silently until the address is added. Keep `http://localhost:5173/reset-password` on the
list as well while anyone is still developing locally.

---

## The `invite-user` Edge Function

The one piece of this system that is not either a static file or a database. It exists
because creating a login for somebody else needs the `service_role` key, and that key must
never reach a browser (rule 6). It lives inside the function instead. See D13 in
`docs/decisions.md` for why this is not the "backend server" Module 1 rules out.

**Nothing works on the Users and roles screen until this is deployed.** Everything else on it
— the list, roles, switching accounts off — is ordinary database work and will function; only
inviting somebody will fail.

### Deploying it

Either way works. The dashboard is fine if you would rather not install anything.

**From the dashboard:** Supabase → Edge Functions → Deploy a new function → name it exactly
`invite-user`, and paste in the contents of `supabase/functions/invite-user/index.ts`.

**From the command line**, with the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed:

```
supabase login
supabase functions deploy invite-user
```

`supabase/config.toml` already names the project, so there is no `--project-ref` to remember.

### There is no secret to set

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` into
every function on that project automatically. Do not add them by hand, and **do not put the
`service_role` key anywhere else** — not in Cloudflare, not in `.env.local`, not in GitHub
Actions.

### Checking it

Sign in as the Owner, open **Users and roles**, and invite an address you can read. Then look
at the audit log: there should be a new `User account` entry naming **you** as the actor. If
the actor column is empty, the function is writing the profile with the wrong client and the
audit trail cannot say who invited whom.

---

## Email, and why invitations may not arrive

Supabase's built-in email service is shared, rate-limited to a handful of messages an hour,
and the vendor states plainly that it is not intended for production. Invitation and
password-reset emails will sometimes simply not be delivered.

**Before Anthrop uses this for real staff, configure custom SMTP:** Supabase →
Project Settings → Authentication → SMTP Settings, using Anthrop's own mail provider. That is
the fix, and it is a five-minute job that nobody thinks about until an invitation goes
missing.

Until it is done, the application degrades honestly rather than silently: when the email
cannot be sent, the account is still created and the invitation link is shown on screen for
the administrator to pass on themselves. It is the same single-use, expiring link.

**Also add the redirect address to the allowlist** — the invitation link lands on
`/reset-password`, the same address as a password reset, so if reset already works this needs
nothing further.

---

## The address

**Use the free `.pages.dev` address for now.** The custom domain comes before Module 2 goes
public.

When that switch happens, two things change together:

1. The custom domain is added in Cloudflare Pages
2. The Supabase **Site URL** and **Redirect URLs** are updated to match

The application needs no change and no rebuild — it reads its own address. Forgetting step 2
is the failure to watch for: Supabase will refuse to redirect to an address that is not on
its allowlist, and password reset stops working while everything else carries on fine.

The subdomain itself is still an open question for Anthrop — `hr.` or `portal.` — see
`docs/modules/01-hr-core.md`.

---

## After deploying, check these

Nothing here needs a tool. It is the Definition of Done, walked through on a phone.

- [ ] The landing page loads, and "Staff login" is the only control that works
- [ ] Privacy and Terms open the real pages on anthropmanagement.com
- [ ] Signing in works; signing out and revisiting `/app` returns you to the login page
- [ ] **Refresh the page while on `/app/employees`** — it should reload the list, not 404.
      This is the `_redirects` check and it only fails once deployed.
- [ ] **Request a password reset** and confirm the emailed link opens the deployed site. If
      it fails, the address is almost certainly missing from Supabase's redirect allowlist.
- [ ] Add a department, a job title and an employee
- [ ] Upload a document and download it back
- [ ] Clock in, clock out, and see both in "My attendance"
- [ ] Open the audit log as Owner and find every action above in it

---

## Rebuilding

Cloudflare rebuilds on every push to the connected branch. To rebuild without a code change —
after editing an environment variable, for instance — use **Deployments → Retry deployment**
in the Cloudflare dashboard.

## Local development

```
cd frontend
cp .env.example .env.local     # then fill in the two values
npm install
npm run dev
```

`.env.local` is gitignored and must stay that way. `npm run build` locally is the same build
Cloudflare runs, so if it fails on your machine it will fail there too.
