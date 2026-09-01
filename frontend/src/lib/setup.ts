import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { tidyName, toNullable } from '@/lib/format'
import type { Department, JobTitle, PersonOption } from '@/lib/types'

/**
 * Departments and job titles — the two simplest tables in the system,
 * and the place the create/read/update pattern gets proved before it is
 * used on anything that matters.
 *
 * Two things this file deliberately does NOT do.
 *
 * It does not write to the audit log. Rule 3 is satisfied by database
 * triggers (`app.audit_row()` on every table), not by application code.
 * Nothing here could be trusted to do it anyway: an audit trail the
 * client is responsible for writing is an audit trail the client can
 * skip. `audit_log` has no insert grant, so an attempt would fail.
 *
 * It does not enforce permissions. The role checks in the UI decide
 * which buttons to draw; row-level security decides what actually
 * happens. If the two ever disagree, the database wins — which is the
 * right way round.
 */

/** What "displayed as a name" means when the viewer may not read it. */
export const HEAD_NOT_VISIBLE = 'Not visible to you'

/**
 * Turns a database error into something a person can act on.
 *
 * Nothing is logged. Postgres error text can quote the offending row,
 * and that row may be personal data (rule 7).
 */
export function describeWriteError(error: PostgrestError, subject: string): string {
  switch (error.code) {
    case '23505':
      // The unique index is on (tenant_id, lower(name)), so this is a
      // case-insensitive clash: "Finance" against an existing "finance".
      return `A ${subject} with that name already exists. Names must be unique, ignoring capitals.`
    case '23503':
      return 'That referenced record no longer exists. Reload the page and try again.'
    case '23514':
      return 'That value was rejected by the database. Check it and try again.'
    case '42501':
      return 'You do not have permission to make that change.'
    default:
      // An empty result from a write is what row-level security looks
      // like through PostgREST when the policy simply matches nothing.
      return 'That change could not be saved. If it keeps happening, contact your administrator.'
  }
}

/* ------------------------------------------------------------------ */
/* Departments                                                         */
/* ------------------------------------------------------------------ */

/** Shape of the row PostgREST returns, including the embedded head. */
interface DepartmentRow {
  id: string
  name: string
  head_person_id: string | null
  is_active: boolean
  head: { first_name: string; last_name: string; preferred_name: string | null } | null
}

function toDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    name: row.name,
    headPersonId: row.head_person_id,
    // Null here means one of two quite different things, and the caller
    // has `headPersonId` to tell them apart: no head recorded at all
    // (rule 4, "Not stated"), or a head this viewer is not allowed to
    // read. A Manager and a Staff user cannot see most people, so the
    // second case is normal, not an error.
    headName: row.head
      ? [row.head.preferred_name ?? row.head.first_name, row.head.last_name].join(' ')
      : null,
    isActive: row.is_active,
  }
}

export async function listDepartments(): Promise<{
  data: Department[] | null
  error: PostgrestError | null
}> {
  const { data, error } = await supabase
    .from('departments')
    // `head:people(...)` resolves through the only foreign key from
    // departments to people. It returns null when the viewer's policies
    // do not let them read that person.
    .select('id, name, head_person_id, is_active, head:people(first_name, last_name, preferred_name)')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  if (error) return { data: null, error }
  return { data: (data as unknown as DepartmentRow[]).map(toDepartment), error: null }
}

export async function createDepartment(input: {
  tenantId: string
  name: string
  headPersonId: string | null
}): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('departments').insert({
    // tenant_id is supplied because the column is NOT NULL. It is not
    // trusted: the policy's WITH CHECK re-tests it against the caller's
    // own tenant, so a tampered value is rejected rather than accepted.
    tenant_id: input.tenantId,
    name: tidyName(input.name),
    head_person_id: input.headPersonId,
  })
  return { error }
}

export async function updateDepartment(
  id: string,
  input: { name: string; headPersonId: string | null },
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('departments')
    .update({ name: tidyName(input.name), head_person_id: input.headPersonId })
    .eq('id', id)
  return { error }
}

/**
 * Deactivate, not delete.
 *
 * A department that has ever appeared on an employment is part of the
 * record of what happened, and deleting it would rewrite history. The
 * schema agrees: the foreign keys are ON DELETE RESTRICT.
 */
export async function setDepartmentActive(
  id: string,
  isActive: boolean,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('departments').update({ is_active: isActive }).eq('id', id)
  return { error }
}

/* ------------------------------------------------------------------ */
/* Job titles                                                          */
/* ------------------------------------------------------------------ */

export async function listJobTitles(): Promise<{
  data: JobTitle[] | null
  error: PostgrestError | null
}> {
  const { data, error } = await supabase
    .from('job_titles')
    .select('id, title, level, is_active')
    .order('is_active', { ascending: false })
    .order('title', { ascending: true })

  if (error) return { data: null, error }
  return {
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      level: (row.level as string | null) ?? null,
      isActive: row.is_active as boolean,
    })),
    error: null,
  }
}

export async function createJobTitle(input: {
  tenantId: string
  title: string
  level: string
}): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('job_titles').insert({
    tenant_id: input.tenantId,
    title: tidyName(input.title),
    // Rule 4: an empty box is null, not ''. An empty string would show
    // as a blank cell, which reads as an answer rather than a gap.
    level: toNullable(input.level),
  })
  return { error }
}

export async function updateJobTitle(
  id: string,
  input: { title: string; level: string },
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('job_titles')
    .update({ title: tidyName(input.title), level: toNullable(input.level) })
    .eq('id', id)
  return { error }
}

export async function setJobTitleActive(
  id: string,
  isActive: boolean,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('job_titles').update({ is_active: isActive }).eq('id', id)
  return { error }
}

/* ------------------------------------------------------------------ */
/* People, for the department head picker                              */
/* ------------------------------------------------------------------ */

/**
 * The people who could be named as a head of department.
 *
 * Only Owner and HR can reach this usefully — they are also the only
 * roles that may edit a department, so the picker and the permission
 * line up. For anyone else the query returns just themselves or nothing,
 * which is correct rather than broken.
 */
export async function listPeopleOptions(): Promise<{
  data: PersonOption[] | null
  error: PostgrestError | null
}> {
  const { data, error } = await supabase
    .from('people')
    .select('id, first_name, last_name, preferred_name')
    .order('last_name', { ascending: true })

  if (error) return { data: null, error }
  return {
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      name: [
        (row.preferred_name as string | null) ?? (row.first_name as string),
        row.last_name as string,
      ].join(' '),
    })),
    error: null,
  }
}
