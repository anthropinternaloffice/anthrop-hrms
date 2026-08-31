# Anthrop HRMS — project instructions

HR management system for **Anthrop Management Limited**, an HR consulting firm in Lagos,
Nigeria. Their clients are corporate organisations, government institutions, and legislative
bodies — an institutional audience.

The build brief for the current module is `MODULE-1-BUILD-BRIEF-1.pdf`. It is the
instruction set — read it before working. It sits in the working directory but is
deliberately **not** committed (`*.pdf` is gitignored); ask the human for it if it is not
on disk. `docs/modules/01-hr-core.md` carries the parts that must survive without it.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase — database, authentication, file storage — talked to directly from the frontend
- Deployed on Cloudflare Pages
- No separate backend server in Module 1. One gets added in Module 2 for CV parsing and
  document generation.

## Rules that must never be broken

1. Every table holding organisation data has a `tenant_id` column.
2. Every such table has row-level security enabled, restricting rows to the user's own tenant.
3. Every create, update, and delete writes to the audit log.
4. Never invent a value. Missing data is stored as `null` and displayed as "Not stated" —
   never a plausible guess.
5. Never edit a migration file that has already been run. New change, new numbered file.
6. The `service_role` key never appears in frontend code.
7. Personal data is never written to the console.
8. All timestamps are set by the database server. Never accept a time sent by the browser —
   a device clock can be changed in seconds.
9. Mobile first. Most of this team works from phones.

## How to work

- Work through the brief's tasks in order. Do not skip ahead or combine them.
- A gate means: stop, present what was built, state plainly what needs checking, and wait for
  a reply. Do not continue past a gate unprompted.
- Commit after every completed task with a clear message.
- Ask before installing any library not named in the brief.
- Explain what you are about to do before doing it.
- If something in the brief is ambiguous, ask rather than choosing.

## Scope of Module 1

In scope: public landing page; staff login and password reset; users and roles (Owner, HR,
Manager, Staff); departments and job titles; employee records, profiles and documents; basic
clock in / clock out; audit log.

**Not** in Module 1: recruitment, CVs, work schedules, lateness rules, overtime, leave,
payroll, performance reviews, timesheets. Do not add them, do not scaffold them, do not
leave placeholders for them beyond the sidebar.

## Design direction

Brand authority is the client's live site, https://anthropmanagement.com/ — the sole
authority on brand, tone, and company details.

- Positioning: "Nigeria's Trusted HR Consulting Firm Driving Measurable Performance Across
  Organisations."
- Values: Partnership · Integrity · Performance Focus · Continuous Improvement ·
  Professional Excellence
- Their tone: "We do not measure success by activity. We measure it by performance."

Layout reference is the "HRConnex" concept
(https://behance.net/gallery/199650537/HRMS-Employee-Dashboard-Sass-landing-page) —
**structure only**. Take the clock-in card on the home screen, stat cards in a row (icon,
label, number), clean white cards on a light grey page, generous spacing, and the team table
layout for the employee list. Reject the 3D character, the playful lilac pastels, the nine
horizontal tabs, the sign-up link and Google sign-in, and the timesheet card.

The test for any screen: would this look right on a laptop in a meeting with a government
client? If it looks like a consumer app, pull it back. No mascots, no illustrations, no
gradients. Plain line icons, modest corner radius.

## Company details (from the client's site footer)

27 Acme Road, Agidingbi, Ikeja, Lagos, Nigeria
info@anthropmanagement.com
+234 803 371 3519 · +234 812 330 3836 · WhatsApp +234 813 234 2552

## Repository layout

```
CLAUDE.md                    this file
docs/decisions.md            decisions taken once and never re-argued
docs/modules/01-hr-core.md   Module 1 definition of done
frontend/                    React + Vite application
database/migrations/         numbered SQL migrations, append-only
```
