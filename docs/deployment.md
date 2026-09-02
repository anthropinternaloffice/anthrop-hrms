# Deploying Anthrop HRMS

Module 1 is a static single-page application talking directly to Supabase. There is no
server to run. Cloudflare Pages builds the site from this repository and serves the result.

The human does the deploying. This document is the whole of what that takes.

---

## The one thing that catches people out

**Environment variables are baked into the JavaScript at build time, not read when the page
loads.**

Vite replaces `import.meta.env.VITE_*` with literal strings during `npm run build`. You can
see it in the output of a local build — the bundle contains
`VITE_SITE_URL:"http://localhost:5173"` if that is what was set when it ran.

Two consequences, and both have bitten real projects:

1. **Set the variables in Cloudflare _before_ the first build.** A build made without them
   ships a site whose password-reset emails point at `localhost`.
2. **Changing a variable does nothing until you rebuild.** After editing one in the
   Cloudflare dashboard, trigger a new deployment. Nothing about the running site picks it
   up on its own.

---

## Before the first deployment

These are database steps, not Cloudflare ones, and the site will look broken without them.

| Step | Where | Why |
|---|---|---|
| Run `database/migrations/0001_module1_core_schema.sql` | Supabase SQL editor | Tables, row-level security, triggers |
| Run `database/migrations/0002_documents_storage.sql` | Supabase SQL editor | Private document bucket and the download log |
| Create the Owner's login | Supabase → Authentication → Users → Add user, **Auto Confirm** ticked | Nothing in the application can create the first administrator |
| Run `database/seed/01_bootstrap_first_owner.sql` | Supabase SQL editor | Creates the organisation and makes that login its Owner |

Verify each one: every script ends with a query that prints what it created.

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

Set all three in **Cloudflare Pages → Settings → Environment variables**, for the
**Production** environment (and Preview too, if you use preview deployments).

| Variable | Where to find it | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **Publishable** key (or the legacy **anon** key) | `sb_publishable_…` |
| `VITE_SITE_URL` | The address this deployment answers on, **no trailing slash** | `https://anthrop-hrms.pages.dev` |

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

The application sends users to `${VITE_SITE_URL}/reset-password` from the reset email.
Supabase refuses to redirect anywhere that is not on that allowlist, so a reset link will
fail silently until the address is added. Keep `http://localhost:5173/reset-password` on the
list as well while anyone is still developing locally.

---

## The address

**Use the free `.pages.dev` address for now.** The custom domain comes before Module 2 goes
public.

When that switch happens, three things change together and all three must be done:

1. The custom domain is added in Cloudflare Pages
2. `VITE_SITE_URL` is updated **and the site is rebuilt**
3. The Supabase Site URL and Redirect URLs are updated to match

Doing any one of them alone leaves password reset pointing at the old address. The subdomain
itself is still an open question for Anthrop — `hr.` or `portal.` — see
`docs/modules/01-hr-core.md`.

---

## After deploying, check these

Nothing here needs a tool. It is the Definition of Done, walked through on a phone.

- [ ] The landing page loads, and "Staff login" is the only control that works
- [ ] Privacy and Terms open the real pages on anthropmanagement.com
- [ ] Signing in works; signing out and revisiting `/app` returns you to the login page
- [ ] **Refresh the page while on `/app/employees`** — it should reload the list, not 404.
      This is the `_redirects` check and it only fails once deployed.
- [ ] **Request a password reset** and confirm the emailed link opens the deployed site, not
      `localhost`. This is the check that catches a build made before the variables were set.
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
cp .env.example .env.local     # then fill in the three values
npm install
npm run dev
```

`.env.local` is gitignored and must stay that way. `npm run build` locally is the same build
Cloudflare runs, so if it fails on your machine it will fail there too.
