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
