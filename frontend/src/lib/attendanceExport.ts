import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  NOT_STATED,
  formatDate,
  formatDuration,
  formatTime,
  personName,
} from '@/lib/format'

/**
 * Attendance export — Extension brief, Task 4.
 *
 * ---------------------------------------------------------------------
 * WHAT DECIDES WHAT COMES OUT
 * ---------------------------------------------------------------------
 *
 * Nothing in this file filters by role, and that is deliberate. Owner and
 * HR reach the whole tenant, a Manager reaches their own department, and
 * a member of staff reaches only themselves — all decided by the
 * policies on `attendance_records`, `employments` and `people`. This asks
 * for the date range and receives exactly what the caller is allowed to
 * have.
 *
 * The department picker is therefore a convenience, not a control. A
 * Manager who somehow asked for another department's id would get an
 * empty file, not somebody else's staff.
 *
 * ---------------------------------------------------------------------
 * THE AUDIT ENTRY IS A PRECONDITION, NOT A RECEIPT
 * ---------------------------------------------------------------------
 *
 * The order is: fetch, then log, then build the file. If the log write
 * fails, no file is produced and the person is told why.
 *
 * That is the wrong way round for convenience and the right way round for
 * personnel data. Logging afterwards means a crash, a closed tab or a
 * failed request leaves an export that happened and no record of it.
 * Logging first can at worst record an export that was then abandoned —
 * an over-recorded log, which is a far cheaper mistake than an
 * under-recorded one.
 */

/** Lagos is UTC+1 all year and has never observed daylight saving. */
const LAGOS_OFFSET = '+01:00'

export interface ExportRange {
  /** yyyy-mm-dd, inclusive, read as Lagos days. */
  from: string
  to: string
  /** Null means every department the caller can see. */
  departmentId: string | null
}

export interface ExportRow {
  employee: string
  department: string
  date: string
  clockIn: string
  clockOut: string
  duration: string
  /** Hours as a number, because Excel cannot total "8 hr 43 min". */
  hours: string
  source: string
  originalClockIn: string
  originalClockOut: string
  correctionReason: string
  correctedBy: string
  correctedAt: string
  /** Not a column. Used to decide what goes in the PDF's second table. */
  wasCorrected: boolean
}

export interface ExportMeta {
  tenantName: string
  range: ExportRange
  departmentName: string | null
  /**
   * yyyy-mm-dd, from the browser clock.
   *
   * The one place a browser time is used, and it is safe because nothing
   * reads it back: it is a label printed on a file, never stored and
   * never compared. Rule 8 is about times the system will later treat as
   * fact, and the authoritative record of when this export happened is
   * `audit_log.occurred_at`, stamped by the database in 0007. If the two
   * ever disagree, the audit log is right and the paper is wrong.
   */
  generatedOn: string
}

interface RecordRow {
  id: string
  clock_in_at: string
  clock_in_source: string
  clock_out_at: string | null
  clock_out_source: string | null
  corrected_by: string | null
  corrected_at: string | null
  correction_reason: string | null
  original_clock_in_at: string | null
  original_clock_out_at: string | null
  employment: {
    id: string
    person: { first_name: string; last_name: string; preferred_name: string | null } | null
    department: { id: string; name: string } | null
  } | null
}

const SOURCE_WORDS: Record<string, string> = {
  self_service: 'Self service',
  hr_correction: 'HR correction',
}

/**
 * How this record's timestamps came to exist.
 *
 * Two columns collapsed into one, because they almost always agree and a
 * second column of identical values earns nothing. When they disagree —
 * clocked in normally, clocked out by HR afterwards — both are named
 * rather than one being picked.
 */
function describeSource(row: RecordRow): string {
  const inWord = SOURCE_WORDS[row.clock_in_source] ?? row.clock_in_source
  if (row.clock_out_source === null) return inWord

  const outWord = SOURCE_WORDS[row.clock_out_source] ?? row.clock_out_source
  return inWord === outWord ? inWord : `${inWord} in, ${outWord} out`
}

/** Hours to two decimal places, or empty when the record is still open. */
function decimalHours(fromIso: string, toIso: string | null): string {
  if (toIso === null) return ''
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  return (ms / 3_600_000).toFixed(2)
}

/**
 * Fetch the rows for an export.
 *
 * The range is inclusive at both ends and is read as Lagos days, so
 * "1 September to 30 September" means midnight on the 1st to the last
 * moment of the 30th, in Lagos — not in whatever zone the exporting
 * device is set to. Getting this wrong would silently drop an hour of
 * records at each end of every export.
 */
export async function fetchAttendanceForExport(
  range: ExportRange,
): Promise<{ data: ExportRow[] | null; error: PostgrestError | null }> {
  let query = supabase
    .from('attendance_records')
    .select(
      `id, clock_in_at, clock_in_source, clock_out_at, clock_out_source,
       corrected_by, corrected_at, correction_reason,
       original_clock_in_at, original_clock_out_at,
       employment:employments(
         id,
         person:people(first_name, last_name, preferred_name),
         department:departments(id, name)
       )`,
    )
    .gte('clock_in_at', `${range.from}T00:00:00.000${LAGOS_OFFSET}`)
    .lte('clock_in_at', `${range.to}T23:59:59.999${LAGOS_OFFSET}`)
    .order('clock_in_at', { ascending: true })

  if (range.departmentId !== null) {
    query = query.eq('employment.department_id', range.departmentId)
  }

  const { data, error } = await query
  if (error) return { data: null, error }

  const rows = data as unknown as RecordRow[]

  // A department filter applied to an embedded table filters the embed,
  // not the parent: rows from other departments come back with
  // `employment` set to null rather than being dropped. Removing them
  // here is what makes the filter mean what it says.
  const wanted =
    range.departmentId === null ? rows : rows.filter((row) => row.employment !== null)

  const correctorNames = await resolveCorrectors(wanted)

  return {
    data: wanted.map((row) => {
      const corrected = row.corrected_at !== null

      return {
        employee: row.employment?.person
          ? personName({
              firstName: row.employment.person.first_name,
              lastName: row.employment.person.last_name,
              preferredName: row.employment.person.preferred_name,
            })
          : NOT_STATED,
        department: row.employment?.department?.name ?? NOT_STATED,
        date: formatDate(lagosDate(row.clock_in_at)),
        clockIn: formatTime(row.clock_in_at),
        clockOut: row.clock_out_at ? formatTime(row.clock_out_at) : 'Still clocked in',
        duration: row.clock_out_at ? formatDuration(row.clock_in_at, row.clock_out_at) : '',
        hours: decimalHours(row.clock_in_at, row.clock_out_at),
        source: describeSource(row),
        // Blank rather than "Not stated" on an uncorrected row. Nothing
        // is missing there — the question does not apply, and a column
        // of "Not stated" would read as a column of gaps.
        originalClockIn: row.original_clock_in_at ? formatTime(row.original_clock_in_at) : '',
        originalClockOut: row.original_clock_out_at ? formatTime(row.original_clock_out_at) : '',
        correctionReason: row.correction_reason ?? '',
        correctedBy: corrected ? (correctorNames.get(row.corrected_by ?? '') ?? 'Not visible to you') : '',
        correctedAt: row.corrected_at
          ? `${formatDate(lagosDate(row.corrected_at))}, ${formatTime(row.corrected_at)}`
          : '',
        wasCorrected: corrected,
      }
    }),
    error: null,
  }
}

/** The Lagos calendar day an instant falls on, as yyyy-mm-dd. */
function lagosDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}

/**
 * Names for the people who made corrections.
 *
 * `attendance_records.corrected_by` points at `auth.users`, not at
 * `profiles`, so PostgREST has no foreign key to follow and cannot embed
 * it. One extra query resolves them all at once.
 *
 * A Staff or Manager caller can only read their own profile row, so this
 * often comes back short. That is not an error and it is not "nobody
 * corrected it" — the export says "Not visible to you", which is a
 * different sentence from a blank, and blank is reserved for records
 * that were never corrected at all (D10).
 */
async function resolveCorrectors(rows: RecordRow[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((row) => row.corrected_by).filter((id): id is string => !!id))]
  if (ids.length === 0) return new Map()

  const { data } = await supabase
    .from('profiles')
    .select('id, person:people(first_name, last_name, preferred_name)')
    .in('id', ids)

  interface ProfileRow {
    id: string
    person: { first_name: string; last_name: string; preferred_name: string | null } | null
  }

  const names = new Map<string, string>()
  for (const row of (data ?? []) as unknown as ProfileRow[]) {
    if (row.person) {
      names.set(
        row.id,
        personName({
          firstName: row.person.first_name,
          lastName: row.person.last_name,
          preferredName: row.person.preferred_name,
        }),
      )
    }
  }
  return names
}

/**
 * Write the audit entry. Called before the file is built, and a failure
 * here stops the export.
 *
 * Only the range, the format and the count are sent. The scope and the
 * department name are derived inside the function from the caller's own
 * role and tenant — a log whose subject line came from the browser is a
 * log that can be made to say anything. See 0007.
 */
export async function logAttendanceExport(
  format: 'csv' | 'pdf',
  range: ExportRange,
  rowCount: number,
): Promise<string | null> {
  const { error } = await supabase.rpc('log_attendance_export', {
    p_format: format,
    p_from: range.from,
    p_to: range.to,
    p_department_id: range.departmentId,
    p_row_count: rowCount,
  })

  if (!error) return null

  // Whitelisted, like every other error surfaced from the database. A
  // Postgres message can quote the offending row, and that row is
  // somebody's personal data (rule 7).
  const known = [
    'That export is not available.',
    'That department is not available.',
    'That date range is not valid.',
    'Unknown export format.',
  ].find((message) => error.message.includes(message))

  return known ?? 'The export could not be recorded, so it has not been produced. Try again.'
}

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------

const CSV_COLUMNS: Array<[header: string, key: keyof ExportRow]> = [
  ['Employee', 'employee'],
  ['Department', 'department'],
  ['Date', 'date'],
  ['Clock in', 'clockIn'],
  ['Clock out', 'clockOut'],
  ['Duration', 'duration'],
  ['Hours', 'hours'],
  ['Source', 'source'],
  ['Original clock in', 'originalClockIn'],
  ['Original clock out', 'originalClockOut'],
  ['Correction reason', 'correctionReason'],
  ['Corrected by', 'correctedBy'],
  ['Corrected at', 'correctedAt'],
]

/**
 * One CSV field.
 *
 * Two separate jobs in here.
 *
 * The first is ordinary quoting: anything containing a comma, a quote or
 * a line break is wrapped, and inner quotes are doubled.
 *
 * The second is formula injection, which is the one worth explaining. A
 * spreadsheet treats a cell beginning `=`, `+`, `-` or `@` as a formula
 * and will offer to execute it on open. Correction reasons are free text
 * typed by an HR user, and names come from whatever was entered on an
 * employee record, so this file contains strings this codebase did not
 * choose. Prefixing with an apostrophe makes the cell literal text;
 * Excel and LibreOffice both hide the apostrophe on display.
 */
function csvField(value: string): string {
  const dangerous = /^[=+\-@\t\r]/.test(value)
  const text = dangerous ? `'${value}` : value

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsv(rows: ExportRow[], meta: ExportMeta): string {
  const lines: string[] = []

  // A short header before the table. Somebody opening this file in six
  // months should not have to work out what it is from the filename
  // alone, and a filename is the first thing lost when a file is
  // forwarded.
  lines.push(csvField(meta.tenantName))
  lines.push(csvField('Attendance export'))
  lines.push(csvField(`${formatDate(meta.range.from)} to ${formatDate(meta.range.to)}`))
  lines.push(csvField(meta.departmentName ?? 'All departments visible to you'))
  lines.push(csvField(`Generated ${formatDate(meta.generatedOn)}`))
  lines.push('')

  lines.push(CSV_COLUMNS.map(([header]) => csvField(header)).join(','))

  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(([, key]) => csvField(String(row[key] ?? ''))).join(','))
  }

  // CRLF is what the CSV specification says and what Excel on Windows
  // expects. The BOM is not decoration: without it Excel reads the file
  // as the system codepage, and every name with a diacritic in it comes
  // out mangled.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

// ---------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------

/** The columns that fit on a page and answer the ordinary question. */
const PDF_COLUMNS: Array<[header: string, key: keyof ExportRow]> = [
  ['Employee', 'employee'],
  ['Department', 'department'],
  ['Date', 'date'],
  ['Clock in', 'clockIn'],
  ['Clock out', 'clockOut'],
  ['Duration', 'duration'],
  ['Hours', 'hours'],
  ['Source', 'source'],
]

/**
 * The PDF.
 *
 * jsPDF is loaded with a dynamic import so it is fetched the first time
 * somebody exports and never for anybody who does not. It is around
 * 350 kB, and most of this team is on a phone paying for its own data
 * (rule 9).
 *
 * Corrections are a second table rather than nine more columns. A
 * fourteen-column table on A4 is unreadable at any font size that fits,
 * and a corrected record is the exception rather than the rule — so the
 * main table stays legible and says which rows were corrected, and the
 * detail follows underneath. Nothing the brief asks for is dropped; it
 * is arranged so it can be read.
 */
export async function buildPdf(rows: ExportRow[], meta: ExportMeta): Promise<Blob> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const corrected = rows.filter((row) => row.wasCorrected)

  doc.setFontSize(14)
  doc.text(meta.tenantName, 14, 16)

  doc.setFontSize(10)
  doc.text('Attendance export', 14, 22)
  doc.text(`${formatDate(meta.range.from)} to ${formatDate(meta.range.to)}`, 14, 27)
  doc.text(meta.departmentName ?? 'All departments visible to you', 14, 32)
  doc.text(`Generated ${formatDate(meta.generatedOn)}`, 14, 37)

  autoTable(doc, {
    startY: 43,
    head: [PDF_COLUMNS.map(([header]) => header)],
    body: rows.map((row) =>
      PDF_COLUMNS.map(([, key]) => {
        const value = String(row[key] ?? '')
        // The main table says which rows have a correction behind them,
        // so nobody reads a time here and takes it for what was
        // originally recorded.
        return key === 'source' && row.wasCorrected ? `${value} (corrected)` : value
      }),
    ),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [31, 41, 55], textColor: 255 },
    // Repeated on every page, so page four is still readable on its own.
    showHead: 'everyPage',
    theme: 'grid',
  })

  if (corrected.length > 0) {
    const previous = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    const startY = (previous?.finalY ?? 43) + 12

    doc.setFontSize(11)
    doc.text('Corrections in this period', 14, startY - 4)

    autoTable(doc, {
      startY,
      head: [
        [
          'Employee',
          'Date',
          'Original clock in',
          'Original clock out',
          'Reason',
          'Corrected by',
          'Corrected at',
        ],
      ],
      body: corrected.map((row) => [
        row.employee,
        row.date,
        row.originalClockIn,
        row.originalClockOut,
        row.correctionReason,
        row.correctedBy,
        row.correctedAt,
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [31, 41, 55], textColor: 255 },
      showHead: 'everyPage',
      theme: 'grid',
    })
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.text(
      `${meta.tenantName} — attendance ${meta.range.from} to ${meta.range.to} — page ${page} of ${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    )
  }

  return doc.output('blob')
}

// ---------------------------------------------------------------------
// Naming and saving
// ---------------------------------------------------------------------

/** Anything that is awkward in a filename on Windows, macOS or Linux. */
function slug(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'export'
  )
}

/**
 * The tenant, the range and the date generated, as the brief requires.
 *
 * All three matter once the file has been emailed on and has left the
 * system that knows what it is. A file called `attendance.csv` in
 * somebody's downloads folder is an unlabelled list of who was at work.
 */
export function exportFilename(meta: ExportMeta, extension: 'csv' | 'pdf'): string {
  const parts = [
    slug(meta.tenantName),
    'attendance',
    meta.departmentName ? slug(meta.departmentName) : null,
    `${meta.range.from}_to_${meta.range.to}`,
    `generated-${meta.generatedOn}`,
  ].filter((part): part is string => part !== null)

  return `${parts.join('_')}.${extension}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next tick rather than immediately: Safari has not
  // finished reading the blob when click() returns, and revoking it
  // there produces a download that silently saves nothing.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The organisation's name, for the header and the filename.
 *
 * Null when it cannot be read, and the caller refuses to export rather
 * than substituting a plausible one. Rule 4 is usually about a blank
 * field on a screen; here it would be a filename and a document header
 * asserting which organisation's staff these are. That is the worst
 * place in the system to guess, because the guess travels — the file
 * gets emailed on, and nothing downstream can tell that the name on it
 * was never read from the database.
 */
export async function getTenantName(): Promise<string | null> {
  const { data } = await supabase.from('tenants').select('name').maybeSingle()
  const name = data?.name as string | undefined
  return name && name.trim() !== '' ? name : null
}
