import { supabase } from '@/lib/supabase'
import { labelKey } from '@/lib/employeeImportPlan'
import { tidyName } from '@/lib/format'
import { createEmployee } from '@/lib/employeeWrite'
import type {
  ExistingEmployment,
  ExistingPerson,
  ImportPlan,
  NamedRecord,
  PlannedEmployment,
  RowPlan,
} from '@/lib/employeeImportPlan'

export * from '@/lib/employeeImportPlan'

/**
 * The half of the import that touches the database.
 *
 * Reading what already exists, and carrying out a plan that has already
 * been shown on screen. The planning itself is in employeeImportPlan.ts
 * and cannot reach this file — see the note there.
 */

/** Everything the planner needs to compare against, fetched once. */
export async function loadImportContext(): Promise<{
  people: ExistingPerson[]
  employments: ExistingEmployment[]
  departments: NamedRecord[]
  jobTitles: NamedRecord[]
  error: string | null
}> {
  const [peopleResult, employmentResult, departmentResult, jobTitleResult] = await Promise.all([
    supabase
      .from('people')
      .select(
        'id, first_name, middle_name, last_name, preferred_name, email, phone, date_of_birth, address_line1, address_line2, city, state, country',
      ),
    // Only open employments. A person with a job that ended and a new
    // one gets the new one amended; somebody wholly departed gets a
    // fresh row rather than their old post being reopened.
    supabase
      .from('employments')
      .select('id, person_id, department_id, job_title_id, start_date')
      .eq('status', 'active'),
    supabase.from('departments').select('id, name').eq('is_active', true),
    supabase.from('job_titles').select('id, title').eq('is_active', true),
  ])

  if (
    peopleResult.error ||
    employmentResult.error ||
    departmentResult.error ||
    jobTitleResult.error
  ) {
    return {
      people: [],
      employments: [],
      departments: [],
      jobTitles: [],
      error: 'The existing records could not be read, so nothing can be compared against them.',
    }
  }

  return {
    people: (peopleResult.data ?? []).map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      middleName: (row.middle_name as string | null) ?? null,
      lastName: row.last_name as string,
      preferredName: (row.preferred_name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      dateOfBirth: (row.date_of_birth as string | null) ?? null,
      addressLine1: (row.address_line1 as string | null) ?? null,
      addressLine2: (row.address_line2 as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      state: (row.state as string | null) ?? null,
      country: (row.country as string | null) ?? null,
    })),
    employments: (employmentResult.data ?? []).map((row) => ({
      id: row.id as string,
      personId: row.person_id as string,
      departmentId: (row.department_id as string | null) ?? null,
      jobTitleId: (row.job_title_id as string | null) ?? null,
      startDate: (row.start_date as string | null) ?? null,
    })),
    departments: (departmentResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
    })),
    jobTitles: (jobTitleResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.title as string,
    })),
    error: null,
  }
}

export interface ImportOutcome {
  created: number
  updated: number
  /** Matched an existing person and needed no change. */
  unchanged: number
  skipped: number
  failures: Array<{ line: number; name: string; reason: string }>
  /** Set when the summary audit entry could not be written. */
  auditWarning: string | null
}

/**
 * Carry out a plan.
 *
 * Deliberately does no thinking. Every decision was made in planImport
 * and shown on screen; this walks the result. `duplicateDecisions` is the
 * only thing that arrives from the preview itself — one choice per
 * flagged row, defaulting to skipping.
 */
export async function commitImport(input: {
  tenantId: string
  plan: ImportPlan
  duplicateDecisions: Map<number, 'create' | 'skip'>
  createMissing: boolean
  filename: string
  departments: NamedRecord[]
  jobTitles: NamedRecord[]
}): Promise<ImportOutcome> {
  const outcome: ImportOutcome = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failures: [],
    auditWarning: null,
  }

  const departmentIds = new Map(input.departments.map((entry) => [labelKey(entry.name), entry.id]))
  const jobTitleIds = new Map(input.jobTitles.map((entry) => [labelKey(entry.name), entry.id]))

  // The departments and job titles the file named and the database did
  // not have. Created first, so the employment rows below have something
  // to point at. Each one writes its own audit entry through the ordinary
  // trigger.
  if (input.createMissing) {
    for (const name of input.plan.missingDepartments) {
      const { data } = await supabase
        .from('departments')
        .insert({ tenant_id: input.tenantId, name: tidyName(name) })
        .select('id')
        .single()
      if (data) departmentIds.set(labelKey(name), data.id as string)
    }

    for (const title of input.plan.missingJobTitles) {
      const { data } = await supabase
        .from('job_titles')
        .insert({ tenant_id: input.tenantId, title: tidyName(title) })
        .select('id')
        .single()
      if (data) jobTitleIds.set(labelKey(title), data.id as string)
    }
  }

  const employmentFor = (planned: PlannedEmployment) => ({
    departmentId: planned.departmentName ? (departmentIds.get(labelKey(planned.departmentName)) ?? null) : null,
    jobTitleId: planned.jobTitleName ? (jobTitleIds.get(labelKey(planned.jobTitleName)) ?? null) : null,
    startDate: planned.startDate ?? '',
    endDate: '',
    status: 'active' as const,
  })

  const blankContact = { name: '', relationship: '', phone: null }

  for (const row of input.plan.rows) {
    if (row.kind === 'problem') {
      outcome.skipped += 1
      continue
    }


    if (row.kind === 'duplicate' && input.duplicateDecisions.get(row.line) !== 'create') {
      outcome.skipped += 1
      continue
    }

    if (row.kind === 'unchanged') {
      outcome.unchanged += 1
      continue
    }

    if (row.kind === 'update') {
      const failure = await applyUpdate(row, input.tenantId, employmentFor(row.employment))
      if (failure) {
        outcome.failures.push({ line: row.line, name: row.name, reason: failure })
      } else {
        outcome.updated += 1
      }
      continue
    }

    const result = await createEmployee({
      tenantId: input.tenantId,
      person: row.person,
      employment: employmentFor(row.employment),
      emergencyContact: blankContact,
    })

    if (result.error) {
      outcome.failures.push({ line: row.line, name: row.name, reason: result.error })
    } else {
      outcome.created += 1
    }
  }

  // The summary, written last. Unlike an export (D17), every row above
  // has already written its own audit entry through the triggers on
  // people and employments — so an import that dies halfway is still
  // recorded in full, person by person, and the summary is a cover note
  // that can only honestly be written once the work is done.
  const { error } = await supabase.rpc('log_employee_import', {
    p_created: outcome.created,
    p_updated: outcome.updated,
    p_skipped: outcome.skipped,
    p_failed: outcome.failures.length,
    p_filename: input.filename,
  })

  if (error) {
    outcome.auditWarning =
      'The employees were imported, but the summary line could not be written to the audit log. Each individual record was still logged.'
  }

  return outcome
}

/**
 * Apply one update row.
 *
 * Only the columns the preview listed are written. `updateEmployee` in
 * employeeWrite.ts is deliberately not reused here: it writes every
 * column, which is right for a form where every field was on screen and
 * wrong for a spreadsheet that may carry three columns out of fifteen.
 * Reusing it would have an import of phone numbers erase everybody's
 * address.
 *
 * The employment is amended in place when there is an open one. Passing
 * a null employment id to updateEmployee would have inserted a second
 * row, so re-importing the same file twice would give everybody two
 * jobs.
 */
async function applyUpdate(
  row: Extract<RowPlan, { kind: 'update' }>,
  tenantId: string,
  employment: {
    departmentId: string | null
    jobTitleId: string | null
    startDate: string
    endDate: string
    status: 'active'
  },
): Promise<string | null> {
  const personPatch: Record<string, string> = {}
  const employmentPatch: Record<string, string | null> = {}

  for (const change of row.changes) {
    if (change.column === 'department_id') {
      employmentPatch.department_id = employment.departmentId
    } else if (change.column === 'job_title_id') {
      employmentPatch.job_title_id = employment.jobTitleId
    } else if (change.column === 'start_date') {
      employmentPatch.start_date = employment.startDate === '' ? null : employment.startDate
    } else {
      personPatch[change.column] = change.to
    }
  }

  if (Object.keys(personPatch).length > 0) {
    const { error } = await supabase.from('people').update(personPatch).eq('id', row.personId)
    if (error) return 'The personal details could not be saved.'
  }

  if (Object.keys(employmentPatch).length === 0) return null

  const { error } = row.employmentId
    ? await supabase.from('employments').update(employmentPatch).eq('id', row.employmentId)
    : await supabase.from('employments').insert({
        tenant_id: tenantId,
        person_id: row.personId,
        status: 'active',
        ...employmentPatch,
      })

  return error
    ? 'The personal details were saved, but the job details were not.'
    : null
}
