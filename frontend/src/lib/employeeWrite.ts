import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { tidyName, toNullable } from '@/lib/format'
import type { EmploymentStatus } from '@/lib/types'

/**
 * Creating and editing an employee.
 *
 * Two things this file deliberately does not do.
 *
 * It does not write `name_tokens`. That column is GENERATED ALWAYS from
 * app.name_tokens(), so the case-folded, punctuation-stripped, sorted
 * tokens the brief asks for are produced by the database on every write,
 * whatever performs it. Computing them here would be a second
 * implementation free to drift from the first, and the insert would be
 * rejected anyway.
 *
 * It does not write the audit log. Rule 3 is satisfied by triggers.
 */

export interface PersonInput {
  firstName: string
  middleName: string
  lastName: string
  preferredName: string
  email: string
  /** Already normalised to E.164 by the form. */
  phone: string | null
  dateOfBirth: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
}

export interface EmploymentInput {
  jobTitleId: string | null
  departmentId: string | null
  startDate: string
  endDate: string
  status: EmploymentStatus
}

export interface EmergencyContactInput {
  name: string
  relationship: string
  /** Already normalised to E.164 by the form. */
  phone: string | null
}

function personColumns(person: PersonInput) {
  return {
    first_name: tidyName(person.firstName),
    middle_name: toNullable(person.middleName),
    last_name: tidyName(person.lastName),
    preferred_name: toNullable(person.preferredName),
    email: toNullable(person.email)?.toLowerCase() ?? null,
    phone: person.phone,
    date_of_birth: toNullable(person.dateOfBirth),
    address_line1: toNullable(person.addressLine1),
    address_line2: toNullable(person.addressLine2),
    city: toNullable(person.city),
    state: toNullable(person.state),
    country: toNullable(person.country),
  }
}

/** True when the employment section was left entirely blank. */
function employmentIsEmpty(employment: EmploymentInput): boolean {
  return (
    employment.jobTitleId === null &&
    employment.departmentId === null &&
    employment.startDate.trim() === '' &&
    employment.endDate.trim() === ''
  )
}

/**
 * Turns a write failure into something a person can act on.
 *
 * Nothing is logged. Postgres error text quotes the offending row, and
 * that row is somebody's personal data (rule 7).
 */
export function describeEmployeeError(error: PostgrestError): string {
  switch (error.code) {
    case '23505':
      return 'Someone already has that email address on record. Check whether this person has been added before.'
    case '23514':
      // The two CHECKs a form can realistically trip.
      if (error.message.includes('phone')) {
        return 'That phone number was rejected by the database. It must be in international form.'
      }
      if (error.message.includes('dob')) {
        return 'A date of birth has to be in the past.'
      }
      if (error.message.includes('dates_ordered')) {
        return 'The end date cannot be before the start date.'
      }
      return 'One of those values was rejected by the database. Check the dates and the phone numbers.'
    case '42501':
      return 'You do not have permission to change employee records.'
    default:
      return 'Those details could not be saved. If it keeps happening, contact your administrator.'
  }
}

export interface SaveResult {
  personId: string | null
  error: string | null
  /**
   * Set when the person was saved but something after it was not.
   *
   * The three tables are written in three statements because the client
   * talks to PostgREST, which has no transaction spanning them. Rather
   * than pretend that did not happen, a partial save says exactly what
   * landed — the person record is valid on its own (D2), so the honest
   * answer is "this much saved, go back and finish the rest".
   */
  partial: boolean
}

export async function createEmployee(input: {
  tenantId: string
  person: PersonInput
  employment: EmploymentInput
  emergencyContact: EmergencyContactInput
}): Promise<SaveResult> {
  const { data, error } = await supabase
    .from('people')
    .insert({ tenant_id: input.tenantId, ...personColumns(input.person) })
    .select('id')
    .single()

  if (error || !data) {
    return { personId: null, error: describeEmployeeError(error!), partial: false }
  }

  const personId = data.id as string

  if (!employmentIsEmpty(input.employment)) {
    const { error: employmentError } = await supabase.from('employments').insert({
      tenant_id: input.tenantId,
      person_id: personId,
      job_title_id: input.employment.jobTitleId,
      department_id: input.employment.departmentId,
      start_date: toNullable(input.employment.startDate),
      end_date: toNullable(input.employment.endDate),
      status: input.employment.status,
    })

    if (employmentError) {
      return {
        personId,
        error: `${input.person.firstName} was added, but their job details were not saved. ${describeEmployeeError(employmentError)}`,
        partial: true,
      }
    }
  }

  if (input.emergencyContact.name.trim() !== '') {
    const { error: contactError } = await supabase.from('emergency_contacts').insert({
      tenant_id: input.tenantId,
      person_id: personId,
      name: tidyName(input.emergencyContact.name),
      relationship: toNullable(input.emergencyContact.relationship),
      phone: input.emergencyContact.phone,
    })

    if (contactError) {
      return {
        personId,
        error: `${input.person.firstName} was added, but the emergency contact was not saved. ${describeEmployeeError(contactError)}`,
        partial: true,
      }
    }
  }

  return { personId, error: null, partial: false }
}

export async function updateEmployee(input: {
  tenantId: string
  personId: string
  person: PersonInput
  employment: EmploymentInput
  /** The employment being edited, or null to create one. */
  employmentId: string | null
  emergencyContact: EmergencyContactInput
  /** The contact being edited, or null to create one. */
  emergencyContactId: string | null
}): Promise<SaveResult> {
  const { error } = await supabase
    .from('people')
    .update(personColumns(input.person))
    .eq('id', input.personId)

  if (error) return { personId: input.personId, error: describeEmployeeError(error), partial: false }

  if (!employmentIsEmpty(input.employment)) {
    const columns = {
      job_title_id: input.employment.jobTitleId,
      department_id: input.employment.departmentId,
      start_date: toNullable(input.employment.startDate),
      end_date: toNullable(input.employment.endDate),
      status: input.employment.status,
    }

    const { error: employmentError } = input.employmentId
      ? await supabase.from('employments').update(columns).eq('id', input.employmentId)
      : await supabase
          .from('employments')
          .insert({ tenant_id: input.tenantId, person_id: input.personId, ...columns })

    if (employmentError) {
      return {
        personId: input.personId,
        error: `The personal details were saved, but the job details were not. ${describeEmployeeError(employmentError)}`,
        partial: true,
      }
    }
  }

  const contactName = input.emergencyContact.name.trim()

  if (contactName !== '') {
    const columns = {
      name: tidyName(input.emergencyContact.name),
      relationship: toNullable(input.emergencyContact.relationship),
      phone: input.emergencyContact.phone,
    }

    const { error: contactError } = input.emergencyContactId
      ? await supabase.from('emergency_contacts').update(columns).eq('id', input.emergencyContactId)
      : await supabase
          .from('emergency_contacts')
          .insert({ tenant_id: input.tenantId, person_id: input.personId, ...columns })

    if (contactError) {
      return {
        personId: input.personId,
        error: `The personal details were saved, but the emergency contact was not. ${describeEmployeeError(contactError)}`,
        partial: true,
      }
    }
  }

  return { personId: input.personId, error: null, partial: false }
}
