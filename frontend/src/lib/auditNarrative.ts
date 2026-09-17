import { formatDate } from './format.ts'
import type { AuditAction } from '@/lib/types'

/**
 * Turning an audit row into a sentence.
 *
 * Separated from auditLog.ts, which talks to Supabase, for the reason
 * given in D18: a module that only reasons about data can be run and
 * checked on its own, and this one carries the part an Owner actually
 * reads. `npm run check:audit` exercises it without a database, a
 * browser or a signed-in user.
 *
 * Everything here works from the row's own `before`/`after` snapshot
 * rather than from a fresh lookup. That is deliberate: it shows what a
 * thing was called *at the time it happened*, it still works for records
 * that have since been deleted, and it cannot quietly rewrite history
 * when something is renamed.
 */

/** Fields that are noise in a summary of what changed. */
const UNINTERESTING = new Set(['updated_at', 'created_at', 'name_tokens'])

export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return []
  return Object.keys(after)
    .filter((key) => !UNINTERESTING.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}

/**
 * What the affected record was called.
 *
 * Every table gets its own answer because there is no common "name"
 * column, and a bare UUID tells a reader nothing. Where a table has no
 * natural label — an employment, an attendance record — it says so
 * rather than inventing one.
 */
export function describeSubject(
  table: string,
  snapshot: Record<string, unknown> | null,
): string | null {
  if (!snapshot) return null
  const text = (key: string) => {
    const value = snapshot[key]
    return typeof value === 'string' && value.trim() !== '' ? value : null
  }

  switch (table) {
    case 'people':
      return [text('first_name'), text('last_name')].filter(Boolean).join(' ') || null
    case 'departments':
    case 'tenants':
    case 'emergency_contacts':
      return text('name')
    case 'job_titles':
      return text('title')
    case 'documents':
      return text('original_filename')
    // A profiles row holds a tenant, a role and two flags — no name at
    // all. The one entry that can say who it was about is a resent
    // sign-in link, where migration 0009 records the recipient's name as
    // it stood at the time.
    case 'profiles':
      return text('recipient_name')
    default:
      return null
  }
}

const TABLE_LABELS: Record<string, string> = {
  people: 'Employee',
  departments: 'Department',
  job_titles: 'Job title',
  employments: 'Employment',
  documents: 'Document',
  emergency_contacts: 'Emergency contact',
  attendance_records: 'Attendance record',
  profiles: 'User account',
  tenants: 'Organisation',
}

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table
}

/** What the database did, for the tables where that is also what happened. */
const ACTION_WORDS: Record<AuditAction, string> = {
  insert: 'Created',
  update: 'Changed',
  delete: 'Deleted',
  download: 'Downloaded',
  export: 'Exported',
  import: 'Imported',
  resend: 'Sent',
}

/** Did this update carry a correction rather than an ordinary change? */
function isCorrection(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  if (!after) return false
  return (
    (after.corrected_at ?? null) !== (before?.corrected_at ?? null) ||
    (after.correction_reason ?? null) !== (before?.correction_reason ?? null)
  )
}

/**
 * What happened, in the words the person would use for it.
 *
 * Every entry used to read as the SQL that produced it — "Created
 * attendance record" for somebody arriving at work. That is accurate
 * about the database and confusing about the day: attendance is one
 * table carrying four different human events, and an Owner scanning the
 * log for who clocked out early cannot see any of them.
 *
 * So attendance is read from its own snapshot rather than from the verb:
 *
 *   insert                      somebody clocked in
 *   clock_out_at null -> set    they clocked out
 *   a correction field moved    HR corrected the record
 *
 * The distinctions come from the row itself, so this is true of entries
 * written before it existed — nothing is backfilled and no old entry is
 * rewritten. The correction test is made first because a correction can
 * also be the thing that fills in a missing clock-out, and calling that
 * "Clocked out" would credit the employee with an action HR took.
 *
 * Everything else keeps the verb-plus-table wording, which for an
 * ordinary table is already the sentence somebody would say.
 */
export function headlineFor(
  action: AuditAction,
  table: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  if (table === 'attendance_records') {
    switch (action) {
      case 'insert':
        return 'Clocked in'
      case 'update':
        if (isCorrection(before, after)) return 'Corrected attendance record'
        if ((before?.clock_out_at ?? null) === null && (after?.clock_out_at ?? null) !== null) {
          return 'Clocked out'
        }
        return 'Changed attendance record'
      case 'delete':
        return 'Deleted attendance record'
      case 'export':
        // Names no single record, so "attendance record" would be wrong
        // in the one place a reader most needs it to be right.
        return 'Exported attendance'
      default:
        break
    }
  }

  if (action === 'import') return 'Imported employees'
  if (action === 'resend') return 'Sent a sign-in link'

  return `${ACTION_WORDS[action] ?? 'Recorded'} ${tableLabel(table).toLowerCase()}`
}


/**
 * What an export entry says it took, as a sentence.
 *
 * The scope and the date range were written by 0007, which derived them
 * from the caller's own role and tenant rather than accepting them from
 * the browser. So this is quoting the database, not the person who
 * pressed the button.
 *
 * `rows_reported` is the exception and is worded as one. The count came
 * from the browser and nothing could check it, so it says "reported"
 * rather than stating a number as fact.
 */
export function describeExport(after: Record<string, unknown> | null): string | null {
  if (!after) return null

  const scope = typeof after.scope === 'string' ? after.scope : null
  const from = typeof after.from === 'string' ? after.from : null
  const to = typeof after.to === 'string' ? after.to : null
  const format = typeof after.format === 'string' ? after.format.toUpperCase() : null
  const rows = typeof after.rows_reported === 'number' ? after.rows_reported : null

  const parts: string[] = []
  if (scope) parts.push(scope)
  if (from && to) parts.push(`${formatDate(from)} to ${formatDate(to)}`)
  if (format) parts.push(`as ${format}`)
  if (rows !== null) parts.push(`${rows} ${rows === 1 ? 'record' : 'records'} reported`)

  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * What an import entry did, as a sentence.
 *
 * The four counts and the filename have been written by
 * log_employee_import() since migration 0008. Nothing read them: the
 * summary entry rendered with no detail at all, next to a heading that
 * came out as "undefined" because 'import' had reached the database
 * without reaching the union in types.ts. Both halves are fixed here.
 *
 * The counts came from the browser and the database could not check
 * them. They are shown because the per-record entries underneath are the
 * authoritative account, and this is its cover note.
 */
export function describeImport(after: Record<string, unknown> | null): string | null {
  if (!after) return null

  const count = (key: string) => (typeof after[key] === 'number' ? (after[key] as number) : null)
  const filename = typeof after.filename === 'string' ? after.filename.trim() : ''

  const parts: string[] = []
  for (const [key, word] of [
    ['created', 'created'],
    ['updated', 'updated'],
    ['skipped', 'skipped'],
    ['failed', 'failed'],
  ] as const) {
    const value = count(key)
    if (value !== null) parts.push(`${value} ${word}`)
  }

  const summary = parts.join(' · ')
  if (filename !== '') return summary === '' ? filename : `${summary} · ${filename}`
  return summary === '' ? null : summary
}
