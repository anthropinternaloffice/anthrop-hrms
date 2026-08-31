# Module 1 — HR core

The foundation, plus employee records, plus basic clocking.

## In scope

- A public landing page
- Staff login and password reset
- Users and roles: Owner, HR, Manager, Staff
- Departments and job titles
- Employee records, profiles, and documents
- Basic clock in / clock out
- An audit log

## Not in scope

Recruitment, CVs, work schedules, lateness rules, overtime, leave, payroll, performance
reviews, timesheets. These are not added, not scaffolded, and not left placeholders for
beyond the sidebar.

## Definition of done

Module 1 is finished when a person can, on the deployed site, from a phone:

1. Open the address and reach a landing page explaining what this is, with a clear way in for
   staff
2. Log in, and be refused when logged out
3. Create a department and a job title
4. Add an employee with all their details
5. Upload a document to an employee and download it back
6. Clock in, clock out, and see both in their own history
7. See who is currently clocked in, as HR
8. Correct an attendance record with a reason, and still see the original value
9. Log in as a Manager and see only their own department
10. Log in as Staff and see only themselves and their own attendance
11. Open the audit log as Owner and find every action above recorded
12. Have someone other than the builder add three real employees unaided

## Tasks

| # | Task | Gate |
|---|------|------|
| 1 | Repository scaffolding | — |
| 2 | Extract the brand palette | Gate 1 |
| 3 | Database schema | Gate 2 |
| 4 | Prove the security works | Gate 3 |
| 5 | Shell, landing page, login | Gate 4 |
| 6 | Departments and job titles | — |
| 7 | Employee list | — |
| 8 | Employee profile | — |
| 9 | Add and edit employee | — |
| 10 | Documents | — |
| 11 | Clocking | — |
| 12 | Audit log viewer | — |
| 13 | Deployment preparation | — |
| 14 | Keep-alive and backup | — |

## Open questions for Anthrop

These are raised, not decided.

1. **The website already collects CVs.** anthropmanagement.com has a `/jobs/` page and a
   `/submit-cv/` page, and its FAQ promises candidates their CV will be reviewed and matched
   to future openings — the same promise this system is being built to keep. If both keep
   running, applications arrive in two places, the candidate database is silently incomplete,
   and the returning-applicant check in Module 2 misses people. Recommended: WordPress
   `/jobs/` links to the portal, `/submit-cv/` redirects to it, WordPress stays the marketing
   site. Needs Anthrop's agreement. Blocks Module 2, not Module 1.
2. **Privacy policy.** Anthrop's published Privacy Policy will need a paragraph on
   AI-assisted screening before real CVs go through the system.
3. **Attendance policy.** Before the full attendance module can be built, Anthrop must
   answer: standard working hours and grace period? Clock in from anywhere or office only?
   What happens when someone forgets to clock out? Who may correct a record, and does the
   original stay visible? Is overtime tracked, and is it paid or taken as time off? Same rules
   for field and office staff? Ask during Module 1 so Module 3 is a clean build.
4. **Subdomain** when the switch happens: `hr.anthropmanagement.com` or
   `portal.anthropmanagement.com`.
