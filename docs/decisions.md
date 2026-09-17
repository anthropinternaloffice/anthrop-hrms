# Decisions

Decisions recorded here are settled. They are not decided again. To change one, add a new
entry that supersedes the old one — do not rewrite history.

---

## D1 — Stack

**Date:** 2026-08-31
**Status:** Fixed by the Module 1 build brief.

React + Vite + TypeScript + Tailwind CSS + shadcn/ui, talking directly to Supabase for
database, authentication, and file storage. Deployed on Cloudflare Pages. No separate
backend server in Module 1; one is added in Module 2 for CV parsing and document
generation.

---

## D2 — `people` is separate from `employments`

**Date:** 2026-08-31
**Status:** Fixed by the Module 1 build brief.

A person is a human being. An employment is a job they hold. Keeping them apart is what
lets a candidate become an employee in a later module without anything being re-typed, and
what lets a former employee be recognised if they reapply.

---

## D3 — Brand palette and typeface

**Date:** 2026-08-31
**Status:** **Fixed.** Approved at Gate 1. These are not decided again.

Extracted from the client's live site, https://anthropmanagement.com/ — WordPress +
Elementor on the Herrington theme. The owner's configured values sit in a `:root` block in
the site's own stylesheet, which is the authority used here:

```css
:root{--primary-color:#000066;  --secondary-color:#0a1119;
      --third-color:#4b535d;    --body_bg-color:#f5f5f5}

body{ background-color:var(--body_bg-color); color:#4b535d;
      font-family:'Public Sans',sans-serif; font-size:18px; font-weight:400 }
```

### The six brand colours

| Token | Hex | Use | Source |
|---|---|---|---|
| `brand` | `#000066` | Primary buttons, active nav, links, logo panel | `--primary-color` |
| `ink` | `#0A1119` | Headings, table headers, primary values | `--secondary-color` |
| `body` | `#4B535D` | Body copy, labels, secondary text | `--third-color`, `body{color}` |
| `page` | `#F5F5F5` | Page background | `--body_bg-color` |
| `surface` | `#FFFFFF` | Cards, table rows, sidebar | — |
| `line` | `#D3D5D6` | Hairlines, card edges, table rules | Site's most-used border value |

### The two state colours

Anthrop's website has **no accent colour**. Elementor's `--e-global-color-accent:#61CE70`
is a factory default that renders zero times on the live site, and `#25D366` is WhatsApp's
own brand green on the chat button. Neither is Anthrop's. `#61CE70` is dropped.

The brand therefore stays navy everywhere. An HRMS, however, needs colour to carry meaning
the marketing site never had to — clocked in versus clocked out, a destructive action, a
failed login. Two colours are approved for that purpose and no other:

| Token | Hex | Use |
|---|---|---|
| `positive` | `#1B6E4A` | Clocked-in state, active employment, success |
| `negative` | `#9B2C2C` | Destructive actions, errors, failed sign-in |

These two were **proposed, not found on the site**, and approved at Gate 1 as new values.
They are used only to signal status. They are never used decoratively, never as a fill for
anything that is not a state, and never in place of `brand`.

### Typeface

**Public Sans** — the site's actual `body` font-family, loaded from Google Fonts. It is a
common web font, so the brief's fallback to Inter does not apply. It is also the US Web
Design System's typeface: built for government forms and dense tables, carries tabular
figures so time and date columns align, and holds up at small sizes on a phone.

- Weights: 400, 500, 600.
- Stack: `'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`

### Contrast — measured, all AA-passing for text

| Foreground | Background | Ratio |
|---|---|---|
| `#0A1119` ink | `#FFFFFF` surface | 18.97:1 |
| `#0A1119` ink | `#F5F5F5` page | 17.40:1 |
| `#4B535D` body | `#FFFFFF` surface | 7.79:1 |
| `#4B535D` body | `#F5F5F5` page | 7.15:1 |
| `#000066` brand | `#FFFFFF` surface | 17.62:1 |
| `#000066` brand | `#F5F5F5` page | 16.16:1 |
| `#FFFFFF` surface | `#000066` brand | 17.62:1 |

Two constraints that follow from the measurements and must be honoured:

1. `line` `#D3D5D6` is **1.47:1** on white. That is fine for a table hairline, but too faint
   for the border of an interactive control — WCAG 1.4.11 requires 3:1. Form inputs,
   selects, and checkboxes use a darker border, not `line`.
2. Muted text — including the "Not stated" placeholder required by rule 4 — must be no
   lighter than `#6B7280` (4.83:1 on white). Anything lighter fails AA.

### The logo

`https://anthropmanagement.com/wp-content/uploads/2026/02/anthrop-logo-1.jpg`, 234×90.
Pixel analysis with anti-aliased edges filtered out: every solid non-white pixel falls in the
blue band, hue 220–240°, clustering at `#08176C`. There is no second hue in the file. It is a
one-colour navy mark on white; the paler blues in the swoosh are JPEG artefacts and edge
blending, not brand colours. Place it on white or on a solid `brand` panel — never on a
tint, and never recoloured.

---

## D4 — Attendance policy rules are deliberately not built

**Date:** 2026-08-31
**Status:** Fixed by the Module 1 build brief.

Module 1 builds clock-in, clock-out, the employee's own history, who-is-in-today, and HR
correction with a reason. It does **not** build schedules, lateness rules, grace periods,
overtime, absence rules, or location checking. Every one of those is a policy decision
Anthrop has not yet made; building the rules before the answers exist means building them
twice.

---

## D5 — Routing is react-router-dom

**Date:** 2026-09-01
**Status:** Fixed. Approved by the human before Task 5 was written.

The brief requires a route guard and placeholder pages behind each sidebar item, but
names no router. `react-router-dom` was proposed and approved: it is the standard for
React, it is stable, whoever maintains this after us will already know it, and it works
with Vite and with Cloudflare Pages' SPA hosting.

Cloudflare serves a single-page app, so `frontend/public/_redirects` sends every address
to `index.html` and lets the router decide. Without that file a refresh on
`/app/employees` returns a 404 from the CDN rather than the page.

---

## D6 — One appearance, no dark mode

**Date:** 2026-09-01
**Status:** Fixed at Task 5.

D3 measured contrast for one palette and approved one palette. A dark theme would be a
second set of colours nobody extracted from the client's site and nobody checked against
WCAG, maintained forever alongside the first. `frontend/src/theme.css` therefore defines
light values only, and shadcn/ui's `dark:` variants never activate.

---

## D7 — Two theme tokens exist that D3 did not name

**Date:** 2026-09-01
**Status:** Fixed at Task 5.

Both fall directly out of the contrast measurements already recorded in D3, and neither
is a new brand colour.

| Token | Hex | Why it exists |
|---|---|---|
| `control` | `#7C838B` | D3 constraint 1: `line` `#D3D5D6` is 1.47:1 and too faint for the border of an interactive control, which WCAG 1.4.11 requires to be 3:1. This is 3.84:1 and is used on inputs, selects and checkboxes. |
| `quiet` | `#666D7A` | D3 constraint 2 set `#6B7280` as the floor for muted text, including the "Not stated" placeholder that rule 4 requires. That 4.83:1 was measured on **white**; on the `#F5F5F5` page the same grey is **4.43:1 and fails AA**, and muted text lands on the page as often as on a card. This value is 5.21:1 on `surface` and 4.78:1 on `page`. It is darker than D3's floor, so it honours the constraint rather than relaxing it. |

`quiet` is deliberately not called `muted`: Tailwind turns `--color-muted` into the
`bg-muted` fill utility, and pointing a fill at a 4.83:1 text grey would paint dark blocks
the first time anyone used that class.

---

## D8 — Enter and exit animations are written, not installed

**Date:** 2026-09-01
**Status:** Fixed at Task 5.

shadcn/ui's Sheet — the sidebar drawer on a phone — is written against `animate-in`,
`fade-in-0` and `slide-in-from-left`, which come from the `tw-animate-css` plugin. The
brief says to ask before installing a library it does not name. The classes are about
forty lines of CSS, so they are defined at the bottom of `frontend/src/theme.css` instead
of adding a dependency. They honour `prefers-reduced-motion`.

---

## D9 — Unavailable controls are greyed, not faded

**Date:** 2026-09-01
**Status:** Fixed at Task 5, after the Gate 4 review.

shadcn/ui draws a disabled button with `opacity-50`. On the primary button that renders
Anthrop's navy at half strength over the grey page — `#7A7AAE`, a lilac. The brief names
"playful lilac pastels" as the first thing to reject from the layout reference, so the
default was producing precisely the rejected colour by accident.

Disabled controls therefore get their own colours instead of being faded: `wash-strong`
fill, `line` border, `quiet` text, at full opacity. They read as deliberately inert rather
than as a brand colour that went wrong. This applies to the five "Opening soon" controls on
the landing page and to any disabled control added later.

---

## D10 — "Not stated" and "Not visible to you" are different sentences

**Date:** 2026-09-01
**Status:** Fixed at Task 6.

Rule 4 says missing data is displayed as "Not stated". A department's head can be absent
for two quite different reasons, and only one of them is missing data:

| Situation | Shown as |
|---|---|
| `head_person_id` is null — nobody has recorded a head | **Not stated** |
| A head is recorded, but row-level security will not let this viewer read that person | **Not visible to you** |

The second case is normal rather than exceptional. Every role can read every department in
their tenant, but a Manager can only read people in their own department and a Staff user
can only read themselves — so for them most heads resolve to nothing. Showing "Not stated"
there would assert that no head exists, which is false, and would quietly contradict what
an Owner sees on the same screen.

The same distinction applies anywhere a joined name is shown to a role that cannot read the
joined table. Do not collapse the two.

---

## D11 — The site's own address is read at runtime, not built in

**Date:** 2026-09-02
**Status:** Fixed. Supersedes the build brief's instruction on this one point.

The brief says the site address "goes in an environment variable, because the domain changes
later". It was `VITE_SITE_URL`, and that turned out to be the wrong tool for the reason the
brief gives.

Vite replaces `import.meta.env.*` with a string literal during `npm run build`. The address
was therefore frozen at the moment the site was built — a scan of the production bundle
during Task 13 found `VITE_SITE_URL:"http://localhost:5173"` sitting in the JavaScript.
Anyone who changed the domain without also rebuilding would carry on sending password-reset
emails pointing at the old address, with nothing to suggest anything was wrong: every other
part of the site would work perfectly.

`window.location.origin` is read fresh each time it is needed. It is correct on localhost,
correct on every preview deployment, and correct after the move to
`hr.anthropmanagement.com` — with no rebuild and nothing to configure.

**This honours the brief's reasoning while departing from its letter.** The instruction was
given "because the domain changes later"; reading the address live serves that purpose
strictly better than an environment variable, and it is the opposite of hard-coding.

**It is not an open redirect.** Supabase only redirects to addresses on its own allowlist
(Authentication → URL Configuration). A tampered origin is refused there rather than
honoured. That allowlist is the security control; this value only has to be honest about
where the browser currently is.

`VITE_SITE_URL` survives as an optional override for the single case the browser cannot see:
serving from behind a proxy on a different public address. It should normally be unset.

---

## D12 — The backup is dumped as INSERT statements, not COPY

**Date:** 2026-09-04
**Status:** Fixed at the first restore test. Supersedes the `--use-copy` flag used in Task 14.

`pg_dump` can write table data two ways. `COPY ... FROM stdin` is the faster and more
compact one, and it is what `supabase db dump --use-copy` produces. It is also the wrong
one here.

A `COPY` block is terminated by a line containing `\.`, which is a **psql client
meta-command, not SQL**. Anything that speaks plain SQL to the server — the Supabase SQL
editor included — reaches that line and stops with `syntax error at or near "\"`. The dump
was therefore restorable only by somebody with `psql` installed and configured against the
right connection string.

`docs/restore-test.md` tells the reader to paste the files into the SQL editor, because the
person doing this is an administrator in a browser during an incident, quite possibly not
the person who built the system and quite possibly on a borrowed laptop. **The restore
procedure has to work for the people who will actually run it**, and dump efficiency is
worth nothing measured against that.

The cost is real and accepted: `INSERT` dumps are bulkier and slower to load. At this
data volume the difference is seconds, and it would take an enormous database before it
outweighed being able to restore at all.

Two guards were added with it, both in `.github/workflows/backup.yml`:

- The run **fails** if `FROM stdin` appears in the data file, or if the file contains no
  `INSERT` statements. This regression shipped once and passed every check we had,
  including a by-hand inspection of the artifact.
- `GRANT SET ON PARAMETER` lines are stripped from the roles file. `pg_dump` emits a grant
  on a database parameter that the `postgres` role of a fresh project may not make, so the
  file died on its first real statement with "permission denied" and nothing after it ran.

**The wider point, recorded because it was expensive to learn:** the artifact passed every
automated check and a manual inspection, and was still unrestorable. Inspecting a backup
and restoring one are different activities, and only the second tells you anything. See the
log at the bottom of `docs/restore-test.md`.

---

## D13 — The invitation runs in a Supabase Edge Function

**Date:** 2026-09-05
**Status:** Fixed at Task 1 of the extension brief. Approved by the human before it was built.

Creating a login for somebody else needs Supabase's admin API, and that needs the
`service_role` key. Rule 6 says that key never appears in frontend code. Module 1 has no
backend server. Those three facts have to be reconciled before a Users and Roles screen can
exist at all, and until they were, Anthrop could not onboard anybody without direct database
access — which is the whole reason the extension brief exists.

The key lives in `supabase/functions/invite-user/`, which runs on Supabase's own
infrastructure and is never downloaded by a browser.

**This is not the backend server Module 1 rules out.** There is nothing to provision, patch,
scale or pay for. It is part of the Supabase project in the same way Storage is, and Storage
was never counted as a server either. The brief's constraint was about not standing up a
service to maintain; this does not stand one up.

Two alternatives were put to the human and declined:

- **An invitations table with a link the Owner sends by hand.** No new infrastructure, but it
  needs Supabase's public sign-up left enabled so the invitee can create their own auth
  account — reintroducing exactly the sign-up path the Module 1 brief told us to remove — and
  it turns "receives an email link" into "receives a link somehow".
- **Leaving account creation in the Supabase dashboard.** Does not clear the blocker.

### The function uses two clients, and that is the point

`service_role` is used for exactly one call: `inviteUserByEmail`. That is the only step no
policy can express, because the person does not exist yet.

The `profiles` row is then written with a *second* client carrying the inviter's own access
token. It would have been one line shorter to write it with the admin client, and it would
have been wrong:

- row-level security still applies (`profiles_write_owner_hr`);
- `app.guard_role_assignment()` still applies, so the **database** is what stops an HR user
  handing out an Owner role, not the TypeScript above it;
- `auth.uid()` is the inviter, so `app.audit_row()` records **who** invited them.

That last one decides it. The brief requires every invite to reach the audit log, and an
entry written by `service_role` has a null actor — it says the database did it. An audit log
whose "who" column cannot name a person is not an audit log.

### When the email does not arrive

A Supabase project on the free plan sends a handful of emails an hour through a shared
service the vendor states is not for production use. Invitation emails **will** sometimes not
arrive until Anthrop configures their own SMTP.

The function therefore falls back: if the email cannot be sent, it generates the same
single-use, expiring link and returns it, and the screen shows it to the administrator who
just asked for it, saying plainly that it was not sent. The account exists either way;
refusing to show the link would leave an account nobody can reach and no way to tell.

The link is shown only to the Owner or HR user who created the account, over HTTPS, and it is
the same link the email would have carried. It is not written to the console (rule 7).

### One rule, written twice, with a check

`app.managed_department_ids()` decides which departments a Manager covers, and the Users and
Roles screen has to show the same answer for *somebody else* before the role is assigned.
Migration 0004 adds `public.departments_managed_by(uuid)` rather than refactoring the
existing function to serve both.

That is a deliberate acceptance of duplication. `app.managed_department_ids()` is called
inside three row-level security policies — `people_select_manager`,
`employments_select_manager` and `attendance_select_manager` — on a database that already
holds real staff. Rewriting it to gain a tidier call graph would risk every Manager's access
in exchange for nothing a user can see.

The answer to the duplication is not a promise to be careful. It is the last query in
`database/migrations/0004_user_administration.sql`, which computes both definitions for every
profile in the database and prints `DISAGREE - do not ship` if they ever part company. Run it
after touching either function.

---

## D14 — On Supabase, `revoke ... from public` does not remove `anon`

**Date:** 2026-09-05
**Status:** Fixed at migration 0005, after the 0004 verification block failed on the live
database.

A Supabase project ships with default privileges configured:

```sql
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
```

Every function created in `public` therefore receives an **explicit** `EXECUTE` grant to
`anon` at the moment it is created — including immediately after a `create or replace`, which
re-applies them.

`revoke all on function ... from public` removes the `PUBLIC` pseudo-role's default grant.
That is a different grant. It leaves anon's alone.

The rule, for every function added to `public` from here:

```sql
revoke all on function public.thing(args) from anon, public;
grant execute on function public.thing(args) to authenticated;
```

`revoke ... from anon`, by name. 0001 already did this correctly for tables; 0002 and 0004
used the weaker idiom for functions and both were wrong. `public.heartbeat()` is the one
deliberate exception (D-none; see 0003) and 0005's verification treats it as such.

### The defect this uncovered, which was the more serious half

Chasing the failing grant led to `public.log_document_download()`, whose permission check
**failed open**.

`app.current_tenant_id()` returns NULL for an anonymous caller, for a signed-in caller with
no profile row, and for a **deactivated** one — the last because that function requires
`is_active`. The guard read:

```sql
if not ( v_tenant = app.current_tenant_id() and ( ... ) ) then
  raise exception 'That document is not available.';
end if;
```

With a NULL tenant: `v_tenant = NULL` is NULL, `NULL and (...)` is NULL, `not NULL` is NULL,
and PL/pgSQL treats NULL in an `IF` as false — so the body is skipped and the exception is
never raised. Execution reached the audit insert and returned the document's `storage_path`.

It did not hand over the file: the bucket is private and a download still needs a signed URL
issued under the storage policies. What leaked was the existence of a document id, its
storage path, and a forged `audit_log` row with a null actor — in a table nobody holds an
insert grant on. And it held for a deactivated employee for as long as their access token
stayed valid, contradicting the promise that switching an account off revokes access at once.

**The general rule, which is the part worth keeping: a permission check that evaluates to
NULL must deny.** In a row-level security policy that happens for free — a `USING` clause
that returns NULL filters the row out. In PL/pgSQL it does not, and `IF NOT (...)` around a
comparison to a nullable value is the shape to watch for. Wrap it in `coalesce(..., false)`.

The three functions added in 0004 do their filtering in `WHERE` clauses, so they already fail
closed. They were checked rather than assumed.

### Why the check existed to catch it

0004's verification block asserted that `anon` could call none of the functions it added. It
was written as routine defence in depth and it failed on the first real run, on a claim that
looked too obvious to be worth testing. The same lesson as D12: an assertion nobody has run
is not a guarantee, and the cheap checks are the ones that catch the expensive things.

---

## D15 — Deactivation is a flag on the person, and the function that sets it is not privileged

*Extension brief, Task 2. Migration `0006_deactivation.sql`.*

### Where "active" lives

Until 0006 a person's activity was inferred from `employments.status`. Making deactivation a
visible action forced the question of what it actually changes, and the inferred version
broke on a case that already exists in the live database: **a person with no employment row
at all.** The employee list supports them deliberately — somebody can be added before anyone
has recorded what they do — and there is nothing to end, so under an employment-only model
they could never be taken off the list. Anyone entered by mistake would be permanent.

So the roster flag went on `people` (`is_active`, `deactivation_reason`,
`deactivated_effective_on`, `deactivated_at`), and ending the employment became a
*consequence* of deactivating somebody rather than the mechanism. Both writes happen inside
one function, in one transaction, so a phone that loses signal halfway cannot leave a record
saying the person has left while their job is still open.

Rejected: a person flag with the employment left untouched. It is the smallest migration and
it leaves the record asserting two contradictory things — person inactive, employment active
— with every report written later having to know which one to believe.

### Reactivating does not resurrect the employment

It restores the person to the list and clears the reason and effective date, which described
a departure that is now over. The old employment stays closed. Somebody returning holds a new
post from a new date; reviving the old row would invent a start date and an end date nobody
stated, which is rule 4. The dialog says so before the click rather than leaving it to be
discovered afterwards.

### `set_person_active` is SECURITY INVOKER, and that is the point

It does nothing the caller could not already do. `people_write_owner_hr` and
`employments_write_owner_hr` decide who may write, and they keep deciding it inside the
function. The function exists for **atomicity, not privilege**.

This is D14 applied before the fact. A `SECURITY DEFINER` function has to restate its
permission check by hand, and 0005 exists because a hand-written check got it wrong in a way
no policy would have. Here a Manager or Staff caller simply updates zero rows, and the
`row_count` of zero is what raises "not yours to change" — the policy is the check.

The migration's verification block asserts `prosecdef` is false, for the same reason 0004
asserted the `anon` grants: it is the claim that looks too obvious to test, and those are the
ones that turn out to be false.

### The effective date does not schedule anything

It is recorded as a business fact — their last day — and may be in the past or the future.
Deactivation takes effect immediately, and the dialog says so in a sentence. Nothing in
Module 1 runs on a timer, and a flag that silently flips on a date nobody is watching would
be worse than one that is honest about being manual.

### Deletion is still absent, but no longer silent

The fix asked for was discoverability, not erasure. The control is called **Deactivate**, it
sits beside Edit where somebody goes looking for a way to remove a leaver, and the dialog
gives the one-sentence reason it is not called Delete: the audit log refers to these records,
and deleting a person deletes the history of what was done to them.

Genuine erasure — an NDPA data-subject request — is a **Module 12** item with its own reason,
approval and audit trail. It is deliberately not next to Edit, where a busy administrator
would meet it on the way to something else.

---

## D16 — The 12-hour clock is one function, and the locale on it is 'en-US' on purpose

*Extension brief, Task 3.*

`formatTime()` in `frontend/src/lib/format.ts` is the only place in the system that turns a
time into words, and every screen already called it — so Task 3 was one function body. That
is the whole reason it was one function body, and it should stay that way.

**The locale reads `en-US` and that is not an oversight.** It is the locale that renders the
suffix as `AM`/`PM` rather than `am`/`pm`. Nothing else about US convention is wanted or
reachable: only `hour` and `minute` are requested, and `timeZone` stays `Africa/Lagos`. Dates
are formatted by different functions and stay British-long — `4 September 2026`, never
`04/09/26`, which means two different days depending on who is reading it.

`hour: 'numeric'`, not `'2-digit'`: `1:00 PM`, not `01:00 PM`. A leading zero is a 24-hour
habit and reads as a typo on a 12-hour clock.

**The narrow no-break space.** Recent ICU builds put U+202F before AM/PM where older ones use
an ordinary space. It is invisible to a reader and different to everything else — a string
comparison, a CSV cell, a search box. `formatTime` normalises it, written as `\u202f` rather
than the literal character so that an editor or a lint autofix cannot silently remove the
thing that exists to fix it.

### The corner this does not reach, stated rather than glossed

The attendance correction dialog uses `datetime-local` inputs. Their **value** is fixed by
the HTML specification as 24-hour, and their **widget** is drawn by the browser in the
device's own locale. Neither is ours to change: on a phone set to en-GB that picker shows a
24-hour clock no matter what this codebase does.

So `formatWallClock()` echoes the entered time back in words beneath each input — the
24-hour picker is never the only reading available. It also catches the mistake this dialog
is most likely to produce, `08:00` typed when `20:00` was meant.

It parses the string by hand rather than through `new Date()`. That value has no timezone in
it and already *is* Lagos time; handing it to the Date constructor would have the browser
read it in the device's zone and shift every correction by however many hours that device is
out. Anyone tempted to simplify it should read the cases in `format.check.ts` first.

### Why there is a check script

`npm run check:format`, alongside `check:phone`, same reasoning as D-for-phone: no test
library is named in the brief and adding one is the human's decision, but Node runs
TypeScript directly. Task 3 makes a claim — no 24-hour time anywhere — that is easy to state
and easy to break, and the 22 cases hold the shared helper to it. Midnight and noon are in
there because `hour % 12` gives zero for both, which is how a hand-rolled 12-hour clock
usually goes wrong.

---

## D17 - The export's audit entry is a precondition, not a receipt

*Extension brief, Task 4. Migration `0007_attendance_export_audit.sql`.*

The order is **fetch, log, then build the file**. If the audit write fails, no file is
produced and the person is told why.

That is the wrong way round for convenience and the right way round for personnel data.
Logging afterwards means a crash, a closed tab or a dropped request leaves an export that
happened and no record of it. Logging first can at worst record an export that was then
abandoned. An over-recorded log is a far cheaper mistake than an under-recorded one, and the
brief's reason for the requirement - "exporting personnel data is exactly the action that
should leave a trace" - only holds if the trace cannot be skipped.

The one deliberate exception: an export that matches **zero rows** is not logged, because no
file was produced and nothing left the system.

### What is trusted from the browser, and what is not

Trusted, because they are claims about what the person asked for: the date range, the format,
the row count. The count is recorded as `rows_reported` and rendered as "reported" - it came
from the browser, nothing could check it, and the log says so rather than stating it as fact.

**Not** trusted, because they are claims about authority: the scope and the department name.
The scope is derived inside the function from the caller's own role; the department name is
looked up by id **within the caller's own tenant**, and an id from elsewhere raises rather
than being written down. A log whose subject line came from the client is a log that can be
made to say anything.

`log_attendance_export()` is `SECURITY DEFINER` - it has to be, because nobody holds an
insert grant on `audit_log` - so it carries D14's rule explicitly: the tenant and role checks
are written as `IS NULL` tests before anything else, not folded into a larger boolean. That
larger boolean is the exact shape that failed open in 0002.

### 'export' is a new action, not a reuse of 'download'

`audit_action` already carried `download`, added in 0002 for document reads. One person
taking one file is a different event from somebody taking a month of everybody's movements,
and an audit log that renders both with the same word makes the second easy to read past
while skimming the first. The enum gains a value, `ALTER TYPE` sits outside the transaction
so the "cannot use a new enum value in the transaction that added it" question never arises,
and the audit screen gained a line rendering the range and scope - a range sitting unread
inside a `jsonb` column is not an audit trail, it is a place one could have been.

### CSV, not xlsx; jsPDF, not print-to-PDF

Both put to the human, both chosen by them. CSV needs no dependency and opens in Excel; it
carries **both** a readable duration ("8 hr 43 min") and a decimal `Hours` column, because
the brief wants totals and no spreadsheet can sum the first. It is written with CRLF endings
and a UTF-8 BOM - without the BOM Excel reads it as the system codepage and mangles every
name with a diacritic.

Fields beginning with an equals sign, plus, minus or at-sign are prefixed with an apostrophe.
Correction reasons are free text typed by an HR user and names come from whatever was entered
on a record, so this file carries strings this codebase did not choose, and a spreadsheet
will offer to execute a cell that begins with one of those characters.

jsPDF was chosen over `window.print()` because the brief requires the filename to carry the
tenant, the range and the generation date, and a print dialog's filename is the browser's to
decide - iOS Safari ignores it entirely. It is loaded by dynamic `import()`, so it is fetched
the first time somebody exports and never for anybody who does not: **roughly 650 kB raw,
about 197 kB gzipped**, in its own chunk. Most of that is `html2canvas` and `dompurify`,
which jsPDF pulls in for its `.html()` method that this codebase does not call. Stubbing them
out was considered and rejected - it would save a one-off download on a lazy chunk in
exchange for a build that breaks quietly on the next jsPDF upgrade.

The PDF puts corrections in a **second table** rather than nine more columns. Fourteen
columns on A4 is unreadable at any font size that fits, and a corrected record is the
exception rather than the rule. Nothing the brief asks for is dropped; it is arranged so it
can be read.

### The one browser-supplied time in the system

`generatedOn` is taken from the device clock and printed on the file. It is safe because
nothing reads it back: it is a label, never stored and never compared. Rule 8 is about times
the system will later treat as fact, and the authoritative record of when an export happened
is `audit_log.occurred_at`, stamped by the database. If the two ever disagree, the audit log
is right and the paper is wrong.

### Refusing rather than guessing the organisation's name

`getTenantName()` returns null when it cannot be read, and the export refuses instead of
substituting a plausible name. Rule 4 is usually about a blank field on a screen. Here it
would be a filename and a document header asserting whose staff these are - and that guess
travels, because the file gets emailed on to people with no way to check it.

---

## D18 - The import preview is a promise the module graph keeps

*Extension brief, Task 5. Migration `0008_employee_import_audit.sql`.*

"Nothing is written until the person confirms the preview."

That is enforced structurally rather than by discipline. `employeeImportPlan.ts` holds the
planner and **cannot reach the database**: it has no Supabase import, and the only thing it
borrows from the write path is a type, which is erased at compile time. `employeeImport.ts`
holds the reads and the writes. A future change that tried to write during planning would
have to add an import to do it, which is a visible thing to do in review.

The split also makes the planner runnable without a database, which is what
`npm run check:import` depends on - 29 checks, including the brief's own finish condition.

### All the errors, not the first one

A validator that stops at the first problem makes somebody upload the same file four times to
find four mistakes, and that is the difference between a feature people use and one they
abandon. Every row accumulates a list of reasons, and every row is reported.

### An empty cell means "the spreadsheet does not say", never "make this blank"

This is the safety of the whole feature. A file carrying three columns must not erase the
twelve it omits; somebody importing a phone list must not silently strip everybody's address.
So `updateEmployee()` from `employeeWrite.ts` is deliberately **not** reused here. That
function writes every column, which is right for a form where every field was on screen and
wrong for a spreadsheet. The import computes an explicit list of changed fields, shows it,
and writes only those columns.

Passing a null employment id to `updateEmployee()` would also have *inserted* an employment
rather than amending one, so re-importing the same file twice would give everybody two jobs.
The planner resolves the open employment and the writer amends it.

A row that matches an existing person and changes nothing is its own outcome - "already
matches" - rather than an update with an empty list. Counting it as an update would overstate
what the import did to somebody re-uploading a corrected file.

### Dates are refused, not guessed

Only `yyyy-mm-dd` is accepted. `04/09/1990` is the fourth of September to the person who
typed it in Lagos and the ninth of April to most parsers, and a date of birth silently wrong
by five months is exactly the corruption rule 4 exists to prevent. Better to make somebody
reformat a column than to be confidently wrong about when they were born.

### Duplicates, and what counts as certain

An email address that already exists is a definite match and updates that person. Anything
softer - the same name, no email - is put in front of a human alongside the record it
resembles, and **defaults to being skipped**. Two people can share a name, and merging two
who turn out to be different is not something anybody can undo from the interface.

A repeated email address *within one file* is treated as an error rather than a decision:
the same address cannot belong to two people, and importing both would create the duplicate
the feature exists to avoid.

### The template has no example row

Headings only. An example row is a row somebody forgets to delete, and it imports as a
person - the cheapest possible way for this feature to put a fictional employee into a real
HR system. The worked example lives on the screen, where it cannot be uploaded.

### Unknown departments and job titles

Collected and shown, never invented. A misspelling and a genuinely new department are
indistinguishable from here, and only the person reading the preview knows which it is. Until
they choose, rows naming an unknown department cannot import; choosing to create them clears
those rows, and the names are still listed so nothing is created quietly.

### Why the summary is logged afterwards, when an export is logged first

D17 argued that an export must be logged *before* the file is produced, because a read fires
no trigger and an interrupted export would leave no trace at all.

An import is the opposite case. Every row it writes has already written its own audit entry
through the triggers on `people` and `employments` by the time the summary is due, so an
import that dies halfway is still recorded in full, person by person. The summary is a cover
note, and it cannot honestly be written before the work it describes. The failure modes are
not symmetrical: a crashed export would be invisible, whereas a crashed import is visible in
detail and merely missing its heading.

### CSV parsing is written out rather than pulled in

Writing a CSV is easy; reading one is where the trouble is, and the file arrives from
somebody else's spreadsheet. Quoted commas, line breaks inside cells from Alt+Enter, doubled
quotes, a BOM that would otherwise become part of the first heading so that "First name"
silently stops matching, and CRLF mixed with LF. Each of those produces a file that looks
fine and imports wrongly, which is the failure a preview can least afford - the preview is
only worth anything if what it shows is what will happen. `lib/csv.ts` is one pass, no
dependency, and its behaviour is pinned by the check script.

---

## D19 - The greeting carries a name and nothing else

*Extension brief, Task 6.*

A time-aware greeting, the date, and directly beneath it the clock card that already holds
the person's status and the one action they came to do. That is the whole of it.

### The absence of a gender column is deliberate, and this is where that is written down

The original request was an animated character matched to the user's gender. It is not built,
and the reasons belong next to the code so that nobody later reads the missing column as an
oversight and helpfully adds it.

Collecting a sensitive personal attribute so that a cartoon can match it is a weak purpose
under Nigeria's Data Protection Act, which expects a stated reason for every field held. It
also leaves no answer for anybody who has not stated one. And it is off-brand: the character
was removed from the HRConnex reference on purpose, because Anthrop advises government
institutions and corporate boards.

If avatars are wanted later, people upload their own photograph. Self-chosen, nothing
inferred, nothing sensitive stored.

### `greetingName` is the only piece of the person record the session carries

The `profiles` query gained an embed of `first_name` and `preferred_name`, resolved to one
field. The preferred name wins - somebody who goes by Bola should be greeted as Bola by their
own HR system - and it is null when the account has no employee record behind it, in which
case the greeting simply has no name in it rather than saying "Good morning, there".

Nothing else from `people` is carried. A greeting needs a first name; it does not need a date
of birth, and holding one in the session would put it in memory on every screen for no
reason.

The embed is read defensively: PostgREST types an embedded relation as an array even where
the foreign key makes it at most one row, and returns an object at runtime. Both shapes are
handled rather than one being cast away, because a cast there is a silent assumption about a
client library on a screen nobody would think to re-test.

### The animation was already in the codebase

`animate-in fade-in-0 slide-in-from-bottom-2 duration-700` - a fade with a small rise, once,
then finished. The utilities and the `prefers-reduced-motion` guard that clamps them to 1ms
were written for the Sheet component in Module 1 and needed nothing new. Someone who has told
their operating system to stop moving things has told this application too, and that is
handled in CSS rather than by branching in the component and rendering two different trees.

### The boundaries are written out

Morning until noon, afternoon until five, evening after that, read in Lagos and never from
the device. Written as three plain comparisons rather than folded into an expression, because
they are a judgement about the Lagos working day that somebody may reasonably want to move.

They are not a policy about anything. No part of this system treats the working day as having
started or ended, and the greeting says nothing about whether somebody is early or late (D4).

---

## D20 — The audit log says what happened, not what the database did

**Date:** 2026-09-17

An Owner watching the log saw `Created attendance record` when somebody clocked in, and
`Changed attendance record` when they clocked out. Both are accurate descriptions of the SQL
and neither is what happened. Anthrop asked for the activity.

The heading for each entry is now derived from the row's own `before`/`after` snapshot, in
`frontend/src/lib/auditNarrative.ts`:

| Row | Heading |
|---|---|
| insert on `attendance_records` | Clocked in |
| `clock_out_at` null → set | Clocked out |
| `corrected_at` or `correction_reason` moved | Corrected attendance record |
| any other update | Changed attendance record |

### Nothing is stored and nothing is backfilled

No column was added and no existing row was touched. The distinctions were already in the
snapshots, unread — so entries written months ago now read correctly too, and the log stays
what it is: append-only, written by triggers, never edited. Had this been solved by stamping
a label at write time, every entry already in the table would still be wrong.

### The correction test runs first, and that is the whole subtlety

A correction is allowed to supply a missing clock-out, which looks exactly like a clock-out —
null becomes a time. Testing for the clock-out first would credit an employee with an action
HR took on their record. `auditNarrative.check.ts` holds that ordering in place with a case,
because it is the kind of thing a later refactor reorders without noticing.

### The module was split so it could be checked

`auditLog.ts` keeps the Supabase queries; `auditNarrative.ts` holds the wording and imports
nothing that needs a browser, a network or a signed-in user. `npm run check:audit` then runs
it the way `check:format` and `check:import` already run theirs. Same reasoning as D18.

### An import used to render as "undefined"

Found while doing the above. Migration 0008 added `import` to `audit_action`; the union in
`types.ts` never gained it, so the lookup table missed and the heading came out as the word
`undefined` — and the counts the migration carefully recorded were displayed nowhere at all.
Both are fixed, and the fallback now degrades to a word rather than to `undefined` when the
database knows an action this code does not.
