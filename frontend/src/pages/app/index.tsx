import { EmployeeForm } from '@/pages/app/EmployeeForm'
import { ClockCard } from '@/components/ClockCard'

/**
 * The Module 1 screens.
 *
 * The original fourteen tasks: departments and job titles (6), the
 * employee list (7), the profile (8), the add/edit forms (9), documents
 * (10), clocking (11) and the audit log viewer (12). Users and roles is
 * Task 1 of the extension brief and the last placeholder to go.
 */

export { Departments } from '@/pages/app/Departments'
export { UsersAndRoles } from '@/pages/app/UsersAndRoles'
export { JobTitles } from '@/pages/app/JobTitles'
export { Employees } from '@/pages/app/Employees'
export { Attendance } from '@/pages/app/Attendance'
export { AuditLog } from '@/pages/app/AuditLog'
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


