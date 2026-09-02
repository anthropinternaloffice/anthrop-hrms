import { Placeholder } from '@/pages/app/Placeholder'
import { EmployeeForm } from '@/pages/app/EmployeeForm'
import { ClockCard } from '@/components/ClockCard'

/**
 * The Module 1 screens.
 *
 * Built: departments and job titles (6), the employee list (7), the
 * profile (8), the add/edit forms (9), documents (10) and clocking (11).
 * What is left is still an empty page naming the task that fills it in,
 * so the ordering stays visible and nothing gets built out of turn.
 */

export { Departments } from '@/pages/app/Departments'
export { JobTitles } from '@/pages/app/JobTitles'
export { Employees } from '@/pages/app/Employees'
export { Attendance } from '@/pages/app/Attendance'
export { EmployeeProfile } from '@/pages/app/EmployeeProfile'

export function EmployeeNew() {
  return <EmployeeForm mode="create" />
}

export function EmployeeEdit() {
  return <EmployeeForm mode="edit" />
}

/**
 * The home screen.
 *
 * One card, because one card is what the brief asks for. The layout
 * reference also shows a row of statistics, but Task 11 says "build only
 * this" and does not list them — and a number here would be a claim
 * about performance that Anthrop has set no policy for (D4).
 */
export function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Home</h1>
      <ClockCard />
    </div>
  )
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
