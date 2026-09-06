/**
 * Checks for planImport(). Run with: npm run check:import
 *
 * Same shape as phone.check.ts and format.check.ts, same reasoning: no
 * test library is named in the brief, Node runs TypeScript directly.
 *
 * This one exists because Task 5's finish condition is a claim about
 * this function and nothing else — "a file with three deliberate errors
 * shows all three before anything is saved". All three, not the first
 * one. A validator that stops at the first problem makes somebody upload
 * the same file four times to find four mistakes, and that is the
 * difference between a feature people use and one they abandon.
 *
 * The other thing being held down here is that an update never blanks a
 * column the spreadsheet leaves empty. A file carrying three columns
 * must not erase the twelve it omits, and that mistake would be silent,
 * irreversible, and spread across everybody in the file at once.
 */
import { planImport, buildImportTemplate, IMPORT_COLUMNS } from './employeeImportPlan.ts'
import type { ExistingEmployment, ExistingPerson, NamedRecord, RowPlan } from './employeeImportPlan.ts'

const HEADER = IMPORT_COLUMNS.map((column) => column.header).join(',')

const daniel: ExistingPerson = {
  id: 'p-daniel',
  firstName: 'Daniel',
  middleName: null,
  lastName: 'Unuagba',
  preferredName: null,
  email: 'daniel@example.com',
  phone: '+2348031234567',
  dateOfBirth: null,
  addressLine1: '27 Acme Road',
  addressLine2: null,
  city: 'Ikeja',
  state: null,
  country: null,
}

const olumide: ExistingPerson = {
  id: 'p-olumide',
  firstName: 'Olumide',
  middleName: null,
  lastName: 'Oludiran',
  preferredName: null,
  email: null,
  phone: null,
  dateOfBirth: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  country: null,
}

const employments: ExistingEmployment[] = [
  { id: 'e-daniel', personId: 'p-daniel', departmentId: 'd-it', jobTitleId: null, startDate: '2024-01-15' },
]

const departments: NamedRecord[] = [{ id: 'd-it', name: 'IT' }]
const jobTitles: NamedRecord[] = [{ id: 'j-accountant', name: 'Accountant' }]

const context = { people: [daniel, olumide], employments, departments, jobTitles }

let failures = 0

function check(label: string, condition: boolean, detail = '') {
  if (!condition) failures += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

function rowAt(rows: RowPlan[], line: number): RowPlan | undefined {
  return rows.find((row) => row.line === line)
}

// ---------------------------------------------------------------------
console.log('\nThe template')
// ---------------------------------------------------------------------

const template = buildImportTemplate()
check('starts with a UTF-8 BOM, or Excel mangles the headings', template.charCodeAt(0) === 0xfeff)
check('has no example row to forget to delete', template.trimEnd().split('\r\n').length === 1)
check(
  'round-trips: the template is a file this import can read',
  planImport(template, context, { createMissing: false }).fatal === null,
)

// ---------------------------------------------------------------------
console.log('\nThe finish condition: three deliberate errors, all three shown')
// ---------------------------------------------------------------------

const threeErrors = [
  HEADER,
  // 1. no last name  2. unreadable date  3. not an email address
  'Bola,,,Abiodun,bola@example.com,08031234567,1990-09-04,,,,,,IT,Accountant,2025-03-01',
  'Chidi,,Okafor,,chidi@example.com,08031234567,04/09/1990,,,,,,IT,Accountant,2025-03-01',
  'Ngozi,,Eze,,not-an-email,08031234567,1991-02-11,,,,,,IT,Accountant,2025-03-01',
].join('\r\n')

const errorPlan = planImport(threeErrors, context, { createMissing: false })
const problems = errorPlan.rows.filter((row) => row.kind === 'problem')

check('all three rows are reported, not just the first', problems.length === 3, `found ${problems.length}`)
check(
  'line 2 names the missing last name',
  rowAt(errorPlan.rows, 2)?.kind === 'problem' &&
    (rowAt(errorPlan.rows, 2) as Extract<RowPlan, { kind: 'problem' }>).reasons.some((reason) =>
      reason.includes('Last name'),
    ),
)
check(
  'line 3 refuses the ambiguous date rather than guessing at it',
  (rowAt(errorPlan.rows, 3) as Extract<RowPlan, { kind: 'problem' }>)?.reasons.some((reason) =>
    reason.includes('yyyy-mm-dd'),
  ),
)
check(
  'line 4 names the bad email address',
  (rowAt(errorPlan.rows, 4) as Extract<RowPlan, { kind: 'problem' }>)?.reasons.some((reason) =>
    reason.includes('email'),
  ),
)
check('nothing was planned as a write', errorPlan.rows.every((row) => row.kind === 'problem'))

// ---------------------------------------------------------------------
console.log('\nAn update changes only what the file states')
// ---------------------------------------------------------------------

// Daniel already exists. This row gives a new city and nothing else that
// differs; every other column is blank and must be left alone.
const updateFile = [
  HEADER,
  'Daniel,,Unuagba,,daniel@example.com,,,,,Lagos,,,,,',
].join('\r\n')

const updatePlan = planImport(updateFile, context, { createMissing: false })
const updateRow = rowAt(updatePlan.rows, 2)

check('an existing email address is an update, not a new person', updateRow?.kind === 'update')

if (updateRow?.kind === 'update') {
  const columns = updateRow.changes.map((change) => change.column).sort()
  check('exactly one field changes', columns.length === 1, columns.join(', '))
  check('and it is the city', columns[0] === 'city')
  check(
    'the blank columns are NOT queued to be blanked',
    !columns.includes('address_line1') && !columns.includes('phone'),
  )
  check('the preview says what the city is now', updateRow.changes[0]?.from === 'Ikeja')
  check('it amends the open employment rather than adding a second', updateRow.employmentId === 'e-daniel')
}

// A row identical to what is already stored is neither an update nor a
// duplicate — it is nothing to do, and saying so is more useful than
// counting it as work done.
const unchangedFile = [HEADER, 'Daniel,,Unuagba,,daniel@example.com,,,,,Ikeja,,,IT,,2024-01-15'].join('\r\n')
const unchangedPlan = planImport(unchangedFile, context, { createMissing: false })
check('a row that changes nothing is reported as already matching', rowAt(unchangedPlan.rows, 2)?.kind === 'unchanged')

// ---------------------------------------------------------------------
console.log('\nDuplicates are flagged for a person, never merged')
// ---------------------------------------------------------------------

const duplicateFile = [
  HEADER,
  // Same name as an existing record, no email to confirm it either way.
  'Olumide,,Oludiran,,,,,,,,,,,,',
  // Two rows in one file sharing an email address.
  'Ada,,Nwosu,,ada@example.com,,,,,,,,,,',
  'Ada,,Nwosu,,ada@example.com,,,,,,,,,,',
].join('\r\n')

const duplicatePlan = planImport(duplicateFile, context, { createMissing: false })
const nameMatch = rowAt(duplicatePlan.rows, 2)

check('a name match with no email is flagged, not merged', nameMatch?.kind === 'duplicate')
if (nameMatch?.kind === 'duplicate') {
  check('and it names the record it resembles', nameMatch.matches[0]?.name.includes('Oludiran') === true)
}
check(
  'a repeated email inside one file is an error on the second row',
  (rowAt(duplicatePlan.rows, 4) as Extract<RowPlan, { kind: 'problem' }>)?.reasons.some((reason) =>
    reason.includes('line 3'),
  ),
)

// ---------------------------------------------------------------------
console.log('\nUnknown departments and job titles are a decision, not a guess')
// ---------------------------------------------------------------------

const unknownFile = [HEADER, 'Kemi,,Adeyemi,,kemi@example.com,,,,,,,,Field Ops,Driver,'].join('\r\n')

const strict = planImport(unknownFile, context, { createMissing: false })
check('unknown names are listed for the person to decide on', strict.missingDepartments.includes('Field Ops'))
check('the row cannot import until they decide', rowAt(strict.rows, 2)?.kind === 'problem')

const permissive = planImport(unknownFile, context, { createMissing: true })
check('choosing to create them clears the row', rowAt(permissive.rows, 2)?.kind === 'create')
check('and the names are still reported so nothing is created silently', permissive.missingJobTitles.includes('Driver'))

// ---------------------------------------------------------------------
console.log('\nThe file itself: what a real spreadsheet does')
// ---------------------------------------------------------------------

const awkward = [
  HEADER,
  // A comma inside a quoted address, and a doubled quote standing for one.
  'Tunde,,Bakare,"Tee ""T"" Bakare",tunde@example.com,0803 123 4567,,"27 Acme Road, Agidingbi",,Lagos,,,,,',
].join('\r\n')

const awkwardPlan = planImport(awkward, context, { createMissing: false })
const awkwardRow = rowAt(awkwardPlan.rows, 2)

check('a quoted comma does not split the row', awkwardRow?.kind === 'create')
if (awkwardRow?.kind === 'create') {
  check('the address survives intact', awkwardRow.person.addressLine1 === '27 Acme Road, Agidingbi')
  check('a doubled quote becomes one', awkwardRow.person.preferredName === 'Tee "T" Bakare')
  check(
    'the phone number is normalised exactly as the form does it',
    awkwardRow.person.phone === '+2348031234567',
    String(awkwardRow.person.phone),
  )
}

const missingColumn = ['First name,Email', 'Bola,bola@example.com'].join('\r\n')
check(
  'a file without the required columns is refused whole, not row by row',
  planImport(missingColumn, context, { createMissing: false }).fatal?.includes('Last name') === true,
)

const trailingBlanks = [HEADER, 'Bola,,Adeyemi,,,,,,,,,,,,', '', ',,,,,,,,,,,,,,', ''].join('\r\n')
check(
  'blank rows left by a spreadsheet are not reported as errors',
  planImport(trailingBlanks, context, { createMissing: false }).rows.length === 1,
)

if (failures > 0) {
  throw new Error(`${failures} import ${failures === 1 ? 'check' : 'checks'} failed.`)
}

console.log('\nAll import checks pass.')
