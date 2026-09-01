import { Placeholder } from '@/pages/app/Placeholder'

/**
 * The seven Module 1 screens, as empty pages behind their sidebar items.
 *
 * Each names the task from the build brief that fills it in, so the
 * ordering stays visible and nothing gets built out of turn.
 */

export function Home() {
  return <Placeholder title="Home" task="Task 11 — clocking, and the status cards above it" />
}

export function Employees() {
  return <Placeholder title="Employees" task="Task 7 — the employee list" />
}

export function Departments() {
  return <Placeholder title="Departments" task="Task 6 — departments and job titles" />
}

export function JobTitles() {
  return <Placeholder title="Job titles" task="Task 6 — departments and job titles" />
}

export function Attendance() {
  return (
    <Placeholder
      title="Attendance"
      task="Task 11 — my attendance, and who is in today"
    />
  )
}

export function UsersAndRoles() {
  return <Placeholder title="Users and roles" task="Task 6 onward — Owner, HR, Manager and Staff accounts" />
}

export function AuditLog() {
  return <Placeholder title="Audit log" task="Task 12 — the audit log viewer, for the Owner" />
}
