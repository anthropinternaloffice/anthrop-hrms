import { Placeholder } from '@/pages/app/Placeholder'

/**
 * The Module 1 screens.
 *
 * Departments, Job titles (Task 6) and Employees (Task 7) are built. The
 * rest are still empty pages naming the task from the build brief that
 * fills them in, so the ordering stays visible and nothing gets built
 * out of turn.
 */

export { Departments } from '@/pages/app/Departments'
export { JobTitles } from '@/pages/app/JobTitles'
export { Employees } from '@/pages/app/Employees'

export function Home() {
  return <Placeholder title="Home" task="Task 11 — clocking, and the status cards above it" />
}

export function Attendance() {
  return <Placeholder title="Attendance" task="Task 11 — my attendance, and who is in today" />
}

export function UsersAndRoles() {
  return (
    <Placeholder
      title="Users and roles"
      task="a later task — Owner, HR, Manager and Staff accounts"
    />
  )
}

export function AuditLog() {
  return <Placeholder title="Audit log" task="Task 12 — the audit log viewer, for the Owner" />
}
