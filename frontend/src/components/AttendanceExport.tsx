import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
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
import { useAuth } from '@/lib/auth'
import { lagosDayKey } from '@/lib/format'
import { listDepartments } from '@/lib/setup'
import {
  buildCsv,
  buildPdf,
  downloadBlob,
  exportFilename,
  fetchAttendanceForExport,
  getTenantName,
  logAttendanceExport,
} from '@/lib/attendanceExport'
import type { Department } from '@/lib/types'
import type { ExportRange } from '@/lib/attendanceExport'

/**
 * Attendance export — Extension brief, Task 4.
 *
 * What comes out is decided by row-level security, not by this form.
 * Owner and HR reach the whole organisation, a Manager their own
 * department, and a member of staff their own record. The department
 * picker below is a convenience for the people who have a choice, and it
 * is only shown to them; asking for a department you cannot read
 * produces an empty file rather than somebody else's staff.
 */

const ALL_DEPARTMENTS = 'all'

/** The first of the current month in Lagos, and today. */
function defaultRange(): { from: string; to: string } {
  const today = lagosDayKey(new Date().toISOString())
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; format: 'csv' | 'pdf' }
  | { kind: 'done'; message: string }
  | { kind: 'failed'; message: string }

export function AttendanceExport() {
  const { profile } = useAuth()
  const initial = defaultRange()

  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [department, setDepartment] = useState(ALL_DEPARTMENTS)
  const [departments, setDepartments] = useState<Department[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  // Only Owner and HR are offered the choice. A Manager's scope is
  // already their department and a member of staff's is themselves, so
  // for them the control would be a dropdown with one option in it.
  const canChooseDepartment = profile?.role === 'owner' || profile?.role === 'hr'

  useEffect(() => {
    if (!canChooseDepartment) return
    void listDepartments().then(({ data }) => {
      setDepartments((data ?? []).filter((entry) => entry.isActive))
    })
  }, [canChooseDepartment])

  const working = status.kind === 'working'

  async function run(format: 'csv' | 'pdf') {
    if (working) return

    if (from === '' || to === '') {
      setStatus({ kind: 'failed', message: 'Give both a start and an end date.' })
      return
    }
    if (to < from) {
      setStatus({ kind: 'failed', message: 'The end date is before the start date.' })
      return
    }

    setStatus({ kind: 'working', format })

    const range: ExportRange = {
      from,
      to,
      departmentId: department === ALL_DEPARTMENTS ? null : department,
    }

    const [{ data: rows, error }, tenantName] = await Promise.all([
      fetchAttendanceForExport(range),
      getTenantName(),
    ])

    if (error || !rows) {
      setStatus({
        kind: 'failed',
        message: 'The attendance records could not be read. Check your connection and try again.',
      })
      return
    }

    if (rows.length === 0) {
      // Not logged. Nothing was exported, so there is nothing for the
      // audit log to record — an entry here would say a file of
      // personnel data left the system when none did.
      setStatus({
        kind: 'failed',
        message: 'No attendance was recorded in that range, so there is nothing to export.',
      })
      return
    }

    // Rule 4, in the one place where guessing would travel: the
    // organisation's name goes in the filename and at the top of the
    // document, and the file gets emailed on to people who cannot check
    // it. Better to refuse than to label somebody's staff wrongly.
    if (tenantName === null) {
      setStatus({
        kind: 'failed',
        message:
          'Your organisation’s name could not be read, and it belongs on the file. Reload and try again.',
      })
      return
    }

    // Logged before the file is built. If this fails, nothing is
    // produced — see the note at the top of lib/attendanceExport.ts.
    const logFailure = await logAttendanceExport(format, range, rows.length)
    if (logFailure) {
      setStatus({ kind: 'failed', message: logFailure })
      return
    }

    const meta = {
      tenantName,
      range,
      departmentName:
        department === ALL_DEPARTMENTS
          ? null
          : (departments.find((entry) => entry.id === department)?.name ?? null),
      generatedOn: lagosDayKey(new Date().toISOString()),
    }

    const filename = exportFilename(meta, format)

    try {
      if (format === 'csv') {
        downloadBlob(new Blob([buildCsv(rows, meta)], { type: 'text/csv;charset=utf-8' }), filename)
      } else {
        downloadBlob(await buildPdf(rows, meta), filename)
      }
    } catch {
      setStatus({
        kind: 'failed',
        message:
          'The file could not be produced. The export has already been recorded in the audit log; try again.',
      })
      return
    }

    setStatus({
      kind: 'done',
      message: `${rows.length} ${rows.length === 1 ? 'record' : 'records'} downloaded as ${filename}`,
    })
  }

  return (
    <div className="rounded-card border border-line bg-surface p-gutter sm:p-card">
      <p className="text-sm leading-relaxed text-body">
        {describeScope(profile?.role)} Every export is written to the audit log — who took
        what, for which period, and when.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="export-from" className="text-ink">
            From
          </Label>
          <Input
            id="export-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            disabled={working}
            className="h-11 text-base"
          />
        </div>

        <div className="flex-1 space-y-2">
          <Label htmlFor="export-to" className="text-ink">
            To
          </Label>
          <Input
            id="export-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            disabled={working}
            className="h-11 text-base"
          />
        </div>

        {canChooseDepartment && departments.length > 0 && (
          <div className="space-y-2 sm:w-56">
            <Label htmlFor="export-department" className="text-ink">
              Department
            </Label>
            <Select value={department} onValueChange={setDepartment} disabled={working}>
              <SelectTrigger id="export-department" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                {departments.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => void run('csv')} disabled={working} className="h-11">
          {status.kind === 'working' && status.format === 'csv' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          Spreadsheet (CSV)
        </Button>

        <Button
          variant="outline"
          onClick={() => void run('pdf')}
          disabled={working}
          className="h-11"
        >
          {status.kind === 'working' && status.format === 'pdf' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          PDF
        </Button>
      </div>

      {/* One live region for both outcomes, so a screen reader announces
          the result of a download it cannot otherwise observe. */}
      <p
        className={`mt-4 text-sm ${status.kind === 'failed' ? 'font-medium text-negative' : 'text-quiet'}`}
        role={status.kind === 'failed' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {status.kind === 'working' && 'Preparing the file…'}
        {status.kind === 'done' && status.message}
        {status.kind === 'failed' && status.message}
        {status.kind === 'idle' &&
          'The spreadsheet is for working with — filtering, sorting, totalling hours. The PDF is for filing and sending.'}
      </p>
    </div>
  )
}

function describeScope(role: string | undefined): string {
  switch (role) {
    case 'manager':
      return 'Attendance for your own department, over any period you choose.'
    case 'staff':
      return 'Your own attendance, over any period you choose.'
    default:
      return 'Attendance for the whole organisation, or one department, over any period you choose.'
  }
}
