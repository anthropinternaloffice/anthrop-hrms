/**
 * Checks for the audit log's wording. Run with: npm run check:audit
 *
 * Same shape as format.check.ts and for the same reason: no test library
 * is named in the brief, Node runs TypeScript directly, so this is a
 * plain script with no dependencies.
 *
 * It exists because of the complaint that produced it. An Owner looking
 * at the log saw "Created attendance record" where somebody had clocked
 * in, and "Changed attendance record" where they had clocked out — the
 * SQL, not the day. The rule that fixes it cannot be seen by reading a
 * screen, because the difference between a clock-out and a correction is
 * two fields inside a jsonb snapshot. So it is stated here as cases.
 *
 * The one that matters most is the last pair: a correction that fills in
 * a missing clock-out. It looks exactly like a clock-out — null becomes
 * a time — and calling it one would credit an employee with an action
 * that HR took on their record. The correction test therefore runs
 * first, and that ordering is what these cases hold in place.
 */
import { describeImport, describeSubject, headlineFor, tableLabel } from './auditNarrative.ts'
import type { AuditAction } from './types.ts'

type Snapshot = Record<string, unknown> | null

let failures = 0

function check(
  name: string,
  actual: string | null,
  expected: string | null,
): void {
  const correct = actual === expected
  if (!correct) failures += 1
  const status = correct ? 'ok  ' : 'FAIL'
  const flag = correct ? '' : ` [expected ${expected ?? '(null)'}]`
  console.log(`${status}  ${name.padEnd(46)} -> ${(actual ?? '(null)')}${flag}`)
}

/* ------------------------------------------------------------------ */
/* Attendance — the four human events inside one table                 */
/* ------------------------------------------------------------------ */

const clockedIn = {
  id: 'r1',
  clock_in_at: '2026-09-17T07:32:00Z',
  clock_out_at: null,
  clock_out_source: null,
  corrected_at: null,
  correction_reason: null,
}
const clockedOut = {
  ...clockedIn,
  clock_out_at: '2026-09-17T16:02:00Z',
  clock_out_source: 'self_service',
}
const corrected = {
  ...clockedOut,
  clock_in_at: '2026-09-17T07:00:00Z',
  corrected_at: '2026-09-18T09:00:00Z',
  correction_reason: 'Arrived before the office network was up.',
}

const attendance: Array<[string, AuditAction, Snapshot, Snapshot, string]> = [
  ['clock in', 'insert', null, clockedIn, 'Clocked in'],
  ['clock out', 'update', clockedIn, clockedOut, 'Clocked out'],
  ['HR corrects a finished record', 'update', clockedOut, corrected, 'Corrected attendance record'],

  // A correction is the only path that may store a time this server did
  // not generate, and it can be the thing that supplies a missing
  // clock-out. Ordinary-looking, and not the employee's action.
  [
    'correction that fills a missing clock-out',
    'update',
    clockedIn,
    {
      ...clockedIn,
      clock_out_at: '2026-09-17T16:02:00Z',
      clock_out_source: 'hr_correction',
      corrected_at: '2026-09-18T09:00:00Z',
      correction_reason: 'Forgot to clock out.',
    },
    'Corrected attendance record',
  ],

  // A second correction. corrected_at moves again; the reason may not.
  [
    'a second correction, same reason',
    'update',
    corrected,
    { ...corrected, corrected_at: '2026-09-19T11:00:00Z' },
    'Corrected attendance record',
  ],

  ['an update that is neither', 'update', clockedOut, { ...clockedOut }, 'Changed attendance record'],
  ['deletion', 'delete', clockedOut, null, 'Deleted attendance record'],

  // Named no single record, so "attendance record" would be wrong.
  ['an export', 'export', null, { scope: 'Everyone', format: 'csv' }, 'Exported attendance'],
]

console.log('\nAttendance — one table, four events\n')

for (const [note, action, before, after, expected] of attendance) {
  check(note, headlineFor(action, 'attendance_records', before, after), expected)
}

/* ------------------------------------------------------------------ */
/* Every other table keeps the verb-plus-table wording                 */
/* ------------------------------------------------------------------ */

const others: Array<[string, AuditAction, string, string]> = [
  ['a new employee', 'insert', 'people', 'Created employee'],
  ['an edited department', 'update', 'departments', 'Changed department'],
  ['a deleted job title', 'delete', 'job_titles', 'Deleted job title'],
  ['a document download', 'download', 'documents', 'Downloaded document'],
  ['a bulk import', 'import', 'people', 'Imported employees'],
  ['a resent sign-in link', 'resend', 'profiles', 'Sent a sign-in link'],
]

console.log('\nEverything else\n')

for (const [note, action, table, expected] of others) {
  check(note, headlineFor(action, table, null, {}), expected)
}

// An action the database has and this code has not yet heard of. It must
// read as something, never as "undefined" — which is exactly what an
// import entry rendered as between migration 0008 and today.
check(
  'an action added to the database but not here',
  headlineFor('something_new' as AuditAction, 'people', null, {}),
  'Recorded employee',
)
check('an unknown table keeps its own name', tableLabel('leave_requests'), 'leave_requests')

/* ------------------------------------------------------------------ */
/* Detail lines                                                        */
/* ------------------------------------------------------------------ */

console.log('\nImport summaries\n')

check(
  'counts and filename',
  describeImport({ created: 12, updated: 3, skipped: 1, failed: 0, filename: 'staff.csv' }),
  '12 created · 3 updated · 1 skipped · 0 failed · staff.csv',
)
check(
  'no filename recorded',
  describeImport({ created: 1, updated: 0, skipped: 0, failed: 0, filename: '' }),
  '1 created · 0 updated · 0 skipped · 0 failed',
)
check('nothing recorded at all', describeImport(null), null)

console.log('\nSubjects\n')

check('a person is named', describeSubject('people', { first_name: 'Bola', last_name: 'Adeyemi' }), 'Bola Adeyemi')
check(
  'a resent link names its recipient',
  describeSubject('profiles', { recipient_name: 'Bola Adeyemi', role: 'staff' }),
  'Bola Adeyemi',
)
// Rule 4: a profiles row carries no name, and none is invented for it.
check('an ordinary profiles row has no name', describeSubject('profiles', { role: 'staff' }), null)
check('an attendance record has no name', describeSubject('attendance_records', clockedIn), null)

if (failures > 0) {
  // Thrown rather than process.exit(1), so Node's globals stay out of
  // the app's TypeScript scope. An uncaught throw exits non-zero too.
  throw new Error(`${failures} audit wording ${failures === 1 ? 'case' : 'cases'} failed.`)
}

console.log('\nEvery case passes. The log says what happened, not what the database did.\n')
