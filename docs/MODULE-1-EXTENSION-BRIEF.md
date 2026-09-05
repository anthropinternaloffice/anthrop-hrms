# Module 1 Extension Brief — Anthrop HRMS

**Six additions that complete Module 1 honestly, before the unaided acceptance test.**

Read this fully before doing anything. It supplements MODULE-1-BUILD-BRIEF.md; every rule in that brief still applies — tenant scoping, row-level security, audit log on every write, never invent a value, database-server timestamps, mobile first.

---

## Why these six

Module 1 is code-complete but two things block acceptance criterion 12 ("someone other than the builder adds three real employees unaided"):

- There is no way to create a user account without giving someone direct database access.
- Deactivating an employee exists in the data model but isn't visible on screen, so a normal user hits a dead end and assumes the system is broken.

The other four are usability and reporting gaps found while reviewing the live build.

**Not in this brief:** anything belonging to Module 2 (candidates, CVs, recruitment) or Module 3 (attendance rules, lateness, overtime). Do not build them, do not scaffold them.

---

## Working method

- One task at a time, in order. Commit after each.
- ⛔ marks a gate: stop, show what you built, wait for a reply.
- Ask before installing any library not already in the project.
- Every new screen gets tested at phone width before it's called done.

---

## Task 1 — Users and Roles screen ⛔

**Why:** Anthrop cannot onboard anyone today without database access. This is the honest completion of Module 1 — the handover already claims four roles exist and are usable, and the enforcement is real, but the means of assigning them is not.

**Screens**
- User list: name, email, role, active/inactive, last sign-in
- Invite user: email, role, link to an existing person record (or create one)
- Change role (Owner only)
- Deactivate / reactivate a user account

**Rules**
- Only an Owner may set or change a role. That guard already exists in the database — surface it clearly in the interface rather than restating it in code.
- An invited person receives an email link, sets their own password on first sign-in, and is forced to change it if one was set for them.
- A user account is never deleted, only deactivated. Deactivating revokes access immediately.
- Every invite, role change, and deactivation writes to the audit log.
- An Owner cannot remove their own Owner role, and the last remaining Owner cannot be deactivated. Otherwise the system can be locked out of itself.

**Note the existing subtlety, and make it visible on screen:** a Manager's department is resolved from the department of their own active employment, plus any department where they are recorded as head. Giving someone the Manager role therefore gives them their own department automatically. If they should manage a different one, they must be set as that department's head. A user assigned Manager with no department resolves to nothing and sees an empty screen — warn at the point of assignment, don't let it happen silently.

**Finished when:** an Owner can invite a colleague by email, that colleague sets their own password, signs in, sees exactly what their role permits, and every step of it appears in the audit log.

**⛔ GATE.** Show the screens at desktop and phone width before moving on.

---

## Task 2 — Make deactivation visible

**Why:** an employee record shows an Edit button and nothing else. A user looking for a way to remove someone finds no option and concludes the system is incomplete. The underlying design is correct and must not change — records are deactivated, never deleted, because the audit log references them and an HR system that can erase a person erases the history of what was done to them.

**The fix is discoverability, not behaviour.**

- On the employee profile, add a clearly labelled control: **Deactivate employee**, not "Delete"
- Ask for a reason and an effective date; both are stored
- Deactivated employees drop out of the default list but remain findable behind a "Show inactive" filter, shown with a clear status marker
- Reactivating is possible and is itself audited
- Anywhere a user might reasonably look for "delete", the answer should be visible rather than absent

**Do not build permanent erasure in this task.** Genuine deletion — an NDPA data-subject request — is a separate deliberate flow with its own reason, approval and audit trail. Record it as a Module 12 item; do not put it next to Edit.

**Finished when:** a person who has never seen the system can find how to remove someone from the active list, and understands from the interface why it's called deactivation.

---

## Task 3 — 12-hour clock display

**Why:** times currently display on a 24-hour clock. Anthrop's staff read time as 1pm, not 13:00.

**Scope: display only.** Storage, comparison, sorting, and export values stay exactly as they are. This is a formatting layer, nothing more.

- `1:00 PM` not `13:00`
- `9:30 AM` not `09:30`
- Applies everywhere a time is shown: clock-in card, My attendance, Who is in today, attendance corrections, audit log
- Dates stay unambiguous — `4 Sep 2026`, never `04/09/26`, which reads differently in different countries
- Times remain in Africa/Lagos, fixed, as already built. Do not read the device's timezone.
- Put the formatting in one shared helper that every screen calls, so this is never decided twice

**Finished when:** no 24-hour time appears anywhere in the interface, and the underlying stored values are unchanged.

---

## Task 4 — Attendance export

**Why:** attendance data is currently only viewable on screen. Anthrop needs to work with it and to file it.

**Two formats only:**

| Format | For | Why |
|---|---|---|
| **Excel / CSV** | Anything someone will work with | Filter, total hours, sort by person. This is what "a report" usually means in practice |
| **PDF** | Anything someone will file, sign, or send | Fixed layout, looks the same everywhere |

**Deliberately not built:** JPEG or image exports — an image of a table cannot be searched, copied, or read on a small screen. Word documents — attendance is rows and columns, and a Word table cannot be filtered or totalled. If a specific signed document is needed later, that is a formatted monthly summary (see below), not a raw export.

**Rules**
- HR and Owner export any date range, for the whole tenant or one department
- A Manager exports their own department only
- Staff export their own attendance only
- Columns: employee, date, clock in, clock out, duration, source, and where a correction exists — the corrected value, the original value, the reason, who corrected it and when
- Times in the export follow Task 3's 12-hour format
- **Every export writes to the audit log** — who exported what range, for whom, and when. Exporting personnel data is exactly the action that should leave a trace.
- Filename includes the tenant, the range, and the date generated

**Deferred deliberately:** the monthly *summary* — days present, total hours, lateness counts, overtime. That requires Anthrop's answers on working hours, grace period, and overtime handling. Building it before those answers exist means building it twice. Raw export covers the need in the meantime.

**Finished when:** HR can download a month of attendance as a spreadsheet and open it in Excel with the columns intact, and as a PDF that prints cleanly.

---

## Task 5 — Bulk employee import

**Why:** employees are added one at a time. Anthrop has existing staff to enter now and will onboard in batches later. Manual entry of a whole team is how a system quietly stops being used.

- Download a template spreadsheet with the correct column headings
- Upload a filled-in file
- **Preview before committing**: show exactly what will be created, what will be updated, and what has a problem — with the row number and the reason
- Nothing is written until the person confirms the preview
- Phone numbers are normalised on import, exactly as the add-employee form does
- Duplicate detection within the file and against existing records; a possible duplicate is flagged for a human decision, never merged automatically
- Departments and job titles that don't exist yet are listed clearly; the user chooses whether to create them or correct the spelling
- The whole import writes one audit entry with a count, plus individual entries per record

**Finished when:** ten employees can be added from a spreadsheet in under two minutes, and a file with three deliberate errors shows all three before anything is saved.

---

## Task 6 — Personalised welcome

**Why:** the signed-in home screen opens cold. A short personal greeting makes the system feel like it belongs to the person using it.

**What to build**
- Time-aware greeting using the person's first name: "Good morning, Olumide" / "Good afternoon" / "Good evening", based on Africa/Lagos time
- Directly beneath it, their current status and the action they most likely came to do — clocked in since 8:42 AM, or the clock-in button
- A subtle, brief animation on the Anthrop mark or the greeting itself. Restrained: a fade or a gentle motion, not a bounce. It plays once and gets out of the way.
- Respect the operating system's reduce-motion setting

**What NOT to build, and why — this replaces the originally requested gendered animated character:**

1. **Gender is not in the database, and should not be added for this.** Collecting a sensitive personal attribute so that a cartoon can match it is a weak justification under Nigeria's Data Protection Act, which expects a clear purpose for every field held. It also creates an unanswerable case for anyone who hasn't stated one.
2. **It is off-brand.** The cartoon character was deliberately removed from the HRConnex reference because Anthrop advises government institutions and corporate boards. Reintroducing an animated person undoes that decision.

**If avatars are wanted later:** let each person upload their own photo to their profile. Self-chosen, nothing inferred, nothing sensitive stored, and it looks better than any generated character.

**Finished when:** signing in feels personal and takes the user straight to what they came to do, and nothing about it would look out of place on a laptop in a client meeting.

---

## Definition of done for this brief

1. An Owner invites a colleague by email; the colleague sets their own password and signs in
2. That colleague sees exactly what their role permits, and nothing more
3. A user who has never seen the system can find how to deactivate an employee, and can see why it isn't called delete
4. No 24-hour time appears anywhere in the interface
5. HR downloads a month of attendance as a spreadsheet and as a PDF; both appear in the audit log
6. Ten employees import from a spreadsheet, with errors caught in the preview before anything saves
7. Signing in shows a personal greeting and the clock-in action, with no cartoon characters and no gender field anywhere in the database
8. All of the above works on a phone

---

## Then, and only then

Acceptance criterion 12 from the original brief: someone other than the builder adds three real employees, on a phone, unaided, with no walkthrough. Their confusion is a finding about the screen, not about them.

---

## Still open with Anthrop — unchanged, not blocked by this brief

1. The website already collects CVs at `/submit-cv/` — two intake paths will split the candidate database. Blocks Module 2.
2. Privacy policy needs an AI-screening paragraph before real CVs go through.
3. **Attendance policy** — hours, grace period, forgotten clock-outs, who may correct. Raise this soonest; answers take time to come back and Module 3 stalls without them. It also unblocks the monthly summary deferred in Task 4.
4. Subdomain: `hr.` or `portal.anthropmanagement.com`. Currently on the pages.dev address.
