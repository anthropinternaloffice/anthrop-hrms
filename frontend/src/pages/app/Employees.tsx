import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListEmpty, ListLoading } from '@/components/setup/SetupPage'
import { useAuth } from '@/lib/auth'
import { useAsyncList } from '@/lib/useAsyncList'
import { NOT_STATED } from '@/lib/format'
import { listEmployees } from '@/lib/employees'
import type { EmployeeRow, EmploymentStatus } from '@/lib/types'

/** Radix Select cannot hold an empty string, so the two specials need names. */
const ALL_DEPARTMENTS = 'all'
const NO_DEPARTMENT = 'none'

export function Employees() {
  const { profile } = useAuth()
  const { items, error, loading } = useAsyncList<EmployeeRow>(listEmployees)

  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState(ALL_DEPARTMENTS)

  // `items ?? []` inline would build a new array on every render, which
  // would make both useMemos below recompute every time and memoise
  // nothing. The empty array has to be stable too.
  const employees = useMemo(() => items ?? [], [items])

  /**
   * The filter only offers departments that actually appear in the rows
   * this person can see. Departments are readable tenant-wide, so a
   * Manager could otherwise be offered every department in the company
   * and get an empty list from all but one of them — a filter that
   * promises results it cannot deliver.
   */
  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const employee of employees) {
      if (employee.departmentId && employee.departmentName) {
        seen.set(employee.departmentId, employee.departmentName)
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [employees])

  const someoneHasNoDepartment = employees.some((employee) => employee.departmentId === null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesName = needle === '' || employee.searchText.includes(needle)
      const matchesDepartment =
        department === ALL_DEPARTMENTS ||
        (department === NO_DEPARTMENT
          ? employee.departmentId === null
          : employee.departmentId === department)
      return matchesName && matchesDepartment
    })
  }, [employees, query, department])

  const filtering = query.trim() !== '' || department !== ALL_DEPARTMENTS

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold text-ink">Employees</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">{describeScope(profile?.role)}</p>
        </div>

        {/* Only the roles that can actually write see this. Row-level
            security is what enforces it. */}
        {(profile?.role === 'owner' || profile?.role === 'hr') && (
          <Button asChild className="h-11 w-full shrink-0 sm:w-auto">
            <Link to="/app/employees/new">
              <Plus className="size-4" aria-hidden="true" />
              Add employee
            </Link>
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-negative">
          {error}
        </p>
      )}

      {/* Search and filter. Stacked on a phone, side by side from sm. */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="employee-search" className="text-ink">
            Search by name
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-quiet"
              aria-hidden="true"
            />
            <Input
              id="employee-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 pl-9 text-base"
            />
          </div>
        </div>

        {(departmentOptions.length > 0 || someoneHasNoDepartment) && (
          <div className="space-y-2 sm:w-56">
            <Label htmlFor="employee-department" className="text-ink">
              Department
            </Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="employee-department" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                {departmentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
                {someoneHasNoDepartment && (
                  <SelectItem value={NO_DEPARTMENT}>{NOT_STATED}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="mt-6">
        {loading && items === null ? (
          <ListLoading />
        ) : employees.length === 0 ? (
          <ListEmpty message="No employee records yet." />
        ) : visible.length === 0 ? (
          <ListEmpty message="No employees match that search. Try a different name, or clear the department filter." />
        ) : (
          <>
            <p className="mb-3 text-sm text-quiet" aria-live="polite">
              {filtering
                ? `${visible.length} of ${employees.length} shown`
                : `${employees.length} ${employees.length === 1 ? 'employee' : 'employees'}`}
            </p>
            <EmployeeList employees={visible} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Says out loud whose records these are.
 *
 * A Manager who sees four people needs to know the list is scoped, not
 * that the company has four staff. Silence there invites someone to
 * conclude the data is missing.
 */
function describeScope(role: string | undefined): string {
  switch (role) {
    case 'manager':
      return 'Staff in your department. Managers see their own department only.'
    case 'staff':
      return 'Your own record.'
    default:
      return 'Everyone on record at Anthrop Management Limited.'
  }
}

/**
 * The list.
 *
 * What happens to the columns at narrow widths, decided deliberately:
 * below `sm` the table becomes one card per person and nothing is
 * dropped. Name and status stay prominent; job title and department
 * become labelled lines underneath. Hiding a column on a phone would
 * mean the person holding it cannot see the thing they came for, and
 * most of this team works from phones (rule 9). A horizontal scroll was
 * the other option and was rejected: side-scrolling tables hide their
 * own contents behind a gesture people do not think to try.
 */
function EmployeeList({ employees }: { employees: EmployeeRow[] }) {
  return (
    <>
      <ul className="space-y-3 sm:hidden">
        {employees.map((employee) => (
          <li key={employee.personId} className="rounded-card border border-line bg-surface p-gutter">
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/app/employees/${employee.personId}`}
                className="rounded-control font-medium text-brand underline underline-offset-4"
              >
                {employee.name}
              </Link>
              <StatusBadge status={employee.status} />
            </div>

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-quiet">Job title</dt>
                <dd className={employee.jobTitle ? 'text-body' : 'text-quiet'}>
                  {employee.jobTitle ?? NOT_STATED}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-quiet">Department</dt>
                <dd className={employee.departmentName ? 'text-body' : 'text-quiet'}>
                  {employee.departmentName ?? NOT_STATED}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-card border border-line bg-surface sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-ink">Name</TableHead>
              <TableHead className="text-ink">Job title</TableHead>
              <TableHead className="text-ink">Department</TableHead>
              <TableHead className="text-ink">Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.personId}>
                <TableCell className="font-medium">
                  <Link
                    to={`/app/employees/${employee.personId}`}
                    className="rounded-control text-brand underline underline-offset-4"
                  >
                    {employee.name}
                  </Link>
                </TableCell>
                <TableCell className={employee.jobTitle ? 'text-body' : 'text-quiet'}>
                  {employee.jobTitle ?? NOT_STATED}
                </TableCell>
                <TableCell className={employee.departmentName ? 'text-body' : 'text-quiet'}>
                  {employee.departmentName ?? NOT_STATED}
                </TableCell>
                <TableCell>
                  <StatusBadge status={employee.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

/**
 * Employment status, in three states rather than two.
 *
 * "No employment recorded" is not the same as "ended", and showing the
 * second when the first is true would invent a fact about someone's
 * job — rule 4. A person can exist here before anyone has said what
 * they do.
 */
function StatusBadge({ status }: { status: EmploymentStatus | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center rounded-control bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
        Active
      </span>
    )
  }

  if (status === 'ended') {
    return (
      <span className="inline-flex items-center rounded-control bg-wash-strong px-2 py-0.5 text-xs font-medium text-quiet">
        Ended
      </span>
    )
  }

  return <span className="text-sm text-quiet">{NOT_STATED}</span>
}
