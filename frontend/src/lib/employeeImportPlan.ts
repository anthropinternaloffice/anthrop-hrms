import { parseCsv } from './csv.ts'
import { normalisePhone } from './phone.ts'
import { personName, tidyName } from './format.ts'
import type { PersonInput } from './employeeWrite.ts'

/**
 * Working out what an import would do — Extension brief, Task 5.
 *
 * ---------------------------------------------------------------------
 * WHY THIS IS ITS OWN FILE
 * ---------------------------------------------------------------------
 *
 * "Nothing is written until the person confirms the preview."
 *
 * Nothing in this module can write anything, because nothing in it can
 * reach the database: there is no Supabase import here, and the only
 * thing it borrows from the write path is a type, which is erased at
 * compile time. The separation is enforced by the module graph rather
 * than by remembering to be careful.
 *
 * It also makes the planner testable without a database, which is what
 * `npm run check:import` relies on. The brief's finish condition — a
 * file with three deliberate errors shows all three before anything is
 * saved — is a claim about this file, so it is checked against this
 * file.
 *
 * ---------------------------------------------------------------------
 * WHAT IS NEVER DECIDED AUTOMATICALLY
 * ---------------------------------------------------------------------
 *
 * A possible duplicate is never merged. An email address that already
 * exists is a definite match and updates that person; anything softer —
 * the same name, no email — is put in front of a human alongside the
 * record it resembles, and defaults to being skipped. Merging two people
 * who turn out to be different is not something anybody can undo from
 * the interface.
 */

export const IMPORT_COLUMNS = [
  { header: 'First name', key: 'firstName', required: true },
  { header: 'Middle name', key: 'middleName', required: false },
  { header: 'Last name', key: 'lastName', required: true },
  { header: 'Preferred name', key: 'preferredName', required: false },
  { header: 'Email', key: 'email', required: false },
  { header: 'Phone', key: 'phone', required: false },
  { header: 'Date of birth', key: 'dateOfBirth', required: false },
  { header: 'Address line 1', key: 'addressLine1', required: false },
  { header: 'Address line 2', key: 'addressLine2', required: false },
  { header: 'City', key: 'city', required: false },
  { header: 'State', key: 'state', required: false },
  { header: 'Country', key: 'country', required: false },
  { header: 'Department', key: 'department', required: false },
  { header: 'Job title', key: 'jobTitle', required: false },
  { header: 'Start date', key: 'startDate', required: false },
] as const

type ColumnKey = (typeof IMPORT_COLUMNS)[number]['key']
type RowValues = Record<ColumnKey, string>

/**
 * The template.
 *
 * Headings only, with no example row. An example row in the file is a
 * row somebody forgets to delete, and it imports as a person — the
 * cheapest possible way for this feature to put a fictional employee
 * into a real HR system, which rule 4 exists to prevent. The worked
 * example belongs on the screen, where it cannot be uploaded.
 */
export function buildImportTemplate(): string {
  // BOM and CRLF for the same reasons as the attendance export: without
  // the BOM Excel reads the file as the system codepage and mangles the
  // headings, and then nothing matches on the way back in.
  return `\uFEFF${IMPORT_COLUMNS.map((column) => column.header).join(',')}\r\n`
}

/**
 * The person columns an import can set, and what to call them on screen.
 *
 * `column` is what the database calls it, `input` what PersonInput calls
 * it, `existing` what ExistingPerson calls it. Three names for one field
 * is unfortunate and is the price of a typed boundary; keeping them in
 * one table is what stops them drifting.
 */
const PERSON_FIELDS = [
  { column: 'first_name', label: 'First name', input: 'firstName', existing: 'firstName' },
  { column: 'middle_name', label: 'Middle name', input: 'middleName', existing: 'middleName' },
  { column: 'last_name', label: 'Last name', input: 'lastName', existing: 'lastName' },
  { column: 'preferred_name', label: 'Preferred name', input: 'preferredName', existing: 'preferredName' },
  { column: 'email', label: 'Email', input: 'email', existing: 'email' },
  { column: 'phone', label: 'Phone', input: 'phone', existing: 'phone' },
  { column: 'date_of_birth', label: 'Date of birth', input: 'dateOfBirth', existing: 'dateOfBirth' },
  { column: 'address_line1', label: 'Address line 1', input: 'addressLine1', existing: 'addressLine1' },
  { column: 'address_line2', label: 'Address line 2', input: 'addressLine2', existing: 'addressLine2' },
  { column: 'city', label: 'City', input: 'city', existing: 'city' },
  { column: 'state', label: 'State', input: 'state', existing: 'state' },
  { column: 'country', label: 'Country', input: 'country', existing: 'country' },
] as const

/** One field an update would change, with what it holds now. */
export interface FieldChange {
  column: string
  label: string
  from: string | null
  to: string
}

export interface PlannedEmployment {
  departmentName: string | null
  jobTitleName: string | null
  startDate: string | null
}

export interface DuplicateMatch {
  personId: string
  name: string
  why: string
}

interface RowBase {
  /** The line number in the spreadsheet, counting the heading as line 1. */
  line: number
  name: string
}

export type RowPlan =
  | (RowBase & { kind: 'create'; person: PersonInput; employment: PlannedEmployment })
  | (RowBase & {
      kind: 'update'
      personId: string
      person: PersonInput
      employment: PlannedEmployment
      /** Exactly what would change, and what it holds now. Never empty. */
      changes: FieldChange[]
      /** The employment row to amend, or null to add their first. */
      employmentId: string | null
    })
  /**
   * Matched an existing person and would change nothing.
   *
   * Its own outcome rather than an update with an empty list, because
   * "12 rows already match" is a useful thing for somebody re-uploading
   * a corrected file to be told, and counting them as updates would
   * overstate what the import did.
   */
  | (RowBase & { kind: 'unchanged'; personId: string })
  | (RowBase & {
      kind: 'duplicate'
      person: PersonInput
      employment: PlannedEmployment
      matches: DuplicateMatch[]
    })
  | (RowBase & { kind: 'problem'; reasons: string[] })

export interface ImportPlan {
  rows: RowPlan[]
  /** Named in the file but not in the database, spelled as the file spells them. */
  missingDepartments: string[]
  missingJobTitles: string[]
  /** Column headings in the file that this import does not use. */
  ignoredColumns: string[]
  /** Set when the file cannot be read at all. Nothing else is populated. */
  fatal: string | null
}

/**
 * An existing record, in full.
 *
 * Every field is fetched, not just the ones matching needs, because the
 * preview has to say what an update would actually change. "Will update
 * Daniel Unuagba" is not the promise the brief asks for; "will set the
 * phone number and the city, and leave the rest alone" is.
 */
export interface ExistingPerson {
  id: string
  firstName: string
  middleName: string | null
  lastName: string
  preferredName: string | null
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
}

export interface NamedRecord {
  id: string
  name: string
}

/** The open employment an import would amend rather than duplicate. */
export interface ExistingEmployment {
  id: string
  personId: string
  departmentId: string | null
  jobTitleId: string | null
  startDate: string | null
}

/** Case, spacing and punctuation removed, for comparing two names. */
function nameKey(first: string, last: string): string {
  return `${first} ${last}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Case and spacing removed, for matching a department or job title. */
export function labelKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A date from a spreadsheet cell.
 *
 * Only `yyyy-mm-dd` is accepted, and anything else is refused with a
 * reason rather than guessed at. `04/09/1990` is the fourth of September
 * to the person who typed it in Lagos and the ninth of April to the
 * library that parses it, and a date of birth silently wrong by five
 * months is exactly the kind of quiet corruption rule 4 is about. Better
 * to make somebody reformat a column than to be confidently wrong about
 * when they were born.
 */
function readDate(value: string, field: string): { value: string | null; error: string | null } {
  const text = value.trim()
  if (text === '') return { value: null, error: null }

  if (!ISO_DATE.test(text)) {
    return {
      value: null,
      error: `${field} must be written as yyyy-mm-dd, for example 1990-09-04. Found "${text}".`,
    }
  }

  // Rejects 2026-02-31 and similar, which match the pattern and are not
  // days. Parsed as UTC deliberately: this is a calendar date with no
  // zone, and letting the device's zone into it can shift it by one.
  const parsed = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(text)) {
    return { value: null, error: `${field} is not a real date. Found "${text}".` }
  }

  return { value: text, error: null }
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * What an update would change on the person record.
 *
 * An empty cell means "the spreadsheet does not say", never "make this
 * blank". That distinction is the whole safety of a bulk update: a file
 * carrying three columns must not erase the nine it leaves out, and
 * somebody importing a phone list should not silently strip everybody's
 * address. Clearing a field stays a deliberate act on the edit form.
 */
function diffPerson(incoming: PersonInput, existing: ExistingPerson): FieldChange[] {
  const changes: FieldChange[] = []

  for (const field of PERSON_FIELDS) {
    const raw = incoming[field.input]
    const next = typeof raw === 'string' ? raw.trim() : (raw ?? '')
    if (next === '') continue

    const current = existing[field.existing] ?? null
    if (current === next) continue

    changes.push({ column: field.column, label: field.label, from: current, to: next })
  }

  return changes
}

/** The same, for the department, job title and start date. */
function diffEmployment(
  planned: PlannedEmployment,
  existing: ExistingEmployment | null,
  departmentsByKey: Map<string, NamedRecord>,
  jobTitlesByKey: Map<string, NamedRecord>,
): FieldChange[] {
  const changes: FieldChange[] = []

  const compare = (
    column: string,
    label: string,
    incomingName: string | null,
    currentId: string | null,
    lookup: Map<string, NamedRecord>,
  ) => {
    if (incomingName === null) return
    const incomingId = lookup.get(labelKey(incomingName))?.id ?? null
    // A name with no id yet is one of the missing departments or job
    // titles the person is being asked about. It counts as a change: if
    // they choose to create it, this row will point at it.
    if (incomingId !== null && incomingId === currentId) return

    const currentName =
      currentId === null
        ? null
        : ([...lookup.values()].find((entry) => entry.id === currentId)?.name ?? null)

    changes.push({ column, label, from: currentName, to: incomingName })
  }

  compare('department_id', 'Department', planned.departmentName, existing?.departmentId ?? null, departmentsByKey)
  compare('job_title_id', 'Job title', planned.jobTitleName, existing?.jobTitleId ?? null, jobTitlesByKey)

  if (planned.startDate !== null && planned.startDate !== (existing?.startDate ?? null)) {
    changes.push({
      column: 'start_date',
      label: 'Start date',
      from: existing?.startDate ?? null,
      to: planned.startDate,
    })
  }

  return changes
}

/**
 * Read a file and work out what importing it would do.
 *
 * Nothing here touches the database. It is given what already exists and
 * returns a description; showing that description and then carrying it
 * out are two separate steps, which is what makes "nothing is written
 * until you confirm" a structural fact rather than a promise.
 */
export function planImport(
  text: string,
  context: {
    people: ExistingPerson[]
    employments: ExistingEmployment[]
    departments: NamedRecord[]
    jobTitles: NamedRecord[]
  },
  options: { createMissing: boolean },
): ImportPlan {
  const empty: ImportPlan = {
    rows: [],
    missingDepartments: [],
    missingJobTitles: [],
    ignoredColumns: [],
    fatal: null,
  }

  const grid = parseCsv(text)
  if (grid.length === 0) return { ...empty, fatal: 'That file is empty.' }

  const headings = grid[0].map((heading) => labelKey(heading))
  const positions = new Map<ColumnKey, number>()

  for (const column of IMPORT_COLUMNS) {
    const at = headings.indexOf(labelKey(column.header))
    if (at !== -1) positions.set(column.key, at)
  }

  const missingRequired = IMPORT_COLUMNS.filter(
    (column) => column.required && !positions.has(column.key),
  )
  if (missingRequired.length > 0) {
    return {
      ...empty,
      fatal: `That file is missing ${missingRequired.length === 1 ? 'a column' : 'columns'} this import needs: ${missingRequired
        .map((column) => column.header)
        .join(', ')}. Download the template and use its headings.`,
    }
  }

  const known = new Set(IMPORT_COLUMNS.map((column) => labelKey(column.header)))
  const ignoredColumns = grid[0].filter(
    (heading) => heading.trim() !== '' && !known.has(labelKey(heading)),
  )

  const departmentsByKey = new Map(context.departments.map((entry) => [labelKey(entry.name), entry]))
  const jobTitlesByKey = new Map(context.jobTitles.map((entry) => [labelKey(entry.name), entry]))
  const peopleByEmail = new Map(
    context.people
      .filter((person) => person.email)
      .map((person) => [person.email!.toLowerCase(), person]),
  )

  const peopleByName = new Map<string, ExistingPerson[]>()
  for (const person of context.people) {
    const key = nameKey(person.firstName, person.lastName)
    peopleByName.set(key, [...(peopleByName.get(key) ?? []), person])
  }

  // Within-file duplicates, remembered as the rows are walked so the
  // second occurrence can point at the first by line number.
  const seenEmails = new Map<string, number>()
  const seenNames = new Map<string, number>()

  const missingDepartments = new Set<string>()
  const missingJobTitles = new Set<string>()
  const rows: RowPlan[] = []

  for (let index = 1; index < grid.length; index += 1) {
    const line = index + 1
    const cells = grid[index]
    const read = (key: ColumnKey): string => {
      const at = positions.get(key)
      return at === undefined ? '' : (cells[at] ?? '').trim()
    }

    const values = Object.fromEntries(
      IMPORT_COLUMNS.map((column) => [column.key, read(column.key)]),
    ) as RowValues

    const reasons: string[] = []

    const firstName = tidyName(values.firstName)
    const lastName = tidyName(values.lastName)
    if (firstName === '') reasons.push('First name is empty.')
    if (lastName === '') reasons.push('Last name is empty.')

    const displayName =
      firstName || lastName ? personName({ firstName, lastName, preferredName: values.preferredName }) : `Line ${line}`

    const email = values.email.toLowerCase()
    if (email !== '' && !EMAIL_SHAPE.test(email)) {
      reasons.push(`"${values.email}" does not look like an email address.`)
    }

    // Normalised exactly as the add-employee form does, by the same
    // function. The database CHECK on people.phone accepts nothing else.
    const phone = normalisePhone(values.phone)
    if (phone.error) reasons.push(`Phone: ${phone.error}`)

    const dateOfBirth = readDate(values.dateOfBirth, 'Date of birth')
    if (dateOfBirth.error) reasons.push(dateOfBirth.error)
    if (dateOfBirth.value && dateOfBirth.value >= new Date().toISOString().slice(0, 10)) {
      reasons.push('Date of birth is today or in the future.')
    }

    const startDate = readDate(values.startDate, 'Start date')
    if (startDate.error) reasons.push(startDate.error)

    // Departments and job titles are matched by name, ignoring case and
    // spacing. Anything unmatched is collected rather than invented — the
    // person importing decides whether it is a new department or a typo,
    // which is a question only they can answer.
    let departmentName: string | null = null
    if (values.department !== '') {
      const match = departmentsByKey.get(labelKey(values.department))
      departmentName = match ? match.name : values.department
      if (!match) {
        missingDepartments.add(values.department)
        if (!options.createMissing) {
          reasons.push(`There is no department called "${values.department}".`)
        }
      }
    }

    let jobTitleName: string | null = null
    if (values.jobTitle !== '') {
      const match = jobTitlesByKey.get(labelKey(values.jobTitle))
      jobTitleName = match ? match.name : values.jobTitle
      if (!match) {
        missingJobTitles.add(values.jobTitle)
        if (!options.createMissing) {
          reasons.push(`There is no job title called "${values.jobTitle}".`)
        }
      }
    }

    // A repeated email inside one file is a mistake, not a decision to
    // put to somebody: the same address cannot belong to two people, and
    // importing both would create the duplicate this feature exists to
    // avoid.
    if (email !== '') {
      const earlier = seenEmails.get(email)
      if (earlier !== undefined) {
        reasons.push(`The same email address is already on line ${earlier} of this file.`)
      } else {
        seenEmails.set(email, line)
      }
    }

    if (reasons.length > 0) {
      rows.push({ line, name: displayName, kind: 'problem', reasons })
      continue
    }

    const person: PersonInput = {
      firstName,
      middleName: values.middleName,
      lastName,
      preferredName: values.preferredName,
      email,
      phone: phone.value,
      dateOfBirth: dateOfBirth.value ?? '',
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: values.city,
      state: values.state,
      country: values.country,
    }

    const employment: PlannedEmployment = {
      departmentName,
      jobTitleName,
      startDate: startDate.value,
    }

    // An email that already exists is a definite match, and the row
    // updates that person rather than making a second one.
    const existing = email === '' ? undefined : peopleByEmail.get(email)
    if (existing) {
      const openEmployment =
        context.employments.find((entry) => entry.personId === existing.id) ?? null

      const changes = diffPerson(person, existing).concat(
        diffEmployment(employment, openEmployment, departmentsByKey, jobTitlesByKey),
      )

      if (changes.length === 0) {
        rows.push({ line, name: displayName, kind: 'unchanged', personId: existing.id })
        continue
      }

      rows.push({
        line,
        name: displayName,
        kind: 'update',
        personId: existing.id,
        person,
        employment,
        changes,
        employmentId: openEmployment?.id ?? null,
      })
      continue
    }

    // Anything softer than a matching email is put to a human. Two people
    // can share a name; nothing here is confident enough to decide that
    // they do not.
    const matches: DuplicateMatch[] = []
    const key = nameKey(firstName, lastName)

    for (const candidate of peopleByName.get(key) ?? []) {
      matches.push({
        personId: candidate.id,
        name: personName(candidate),
        why: candidate.email
          ? 'Same name, different email address'
          : 'Same name, and no email recorded on either',
      })
    }

    const earlierLine = seenNames.get(key)
    if (earlierLine !== undefined) {
      matches.push({
        personId: '',
        name: `Line ${earlierLine} of this file`,
        why: 'The same name appears earlier in this file',
      })
    }
    seenNames.set(key, line)

    if (matches.length > 0) {
      rows.push({ line, name: displayName, kind: 'duplicate', person, employment, matches })
      continue
    }

    rows.push({ line, name: displayName, kind: 'create', person, employment })
  }

  return {
    rows,
    missingDepartments: [...missingDepartments],
    missingJobTitles: [...missingJobTitles],
    ignoredColumns,
    fatal: null,
  }
}

