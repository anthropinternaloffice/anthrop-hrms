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
