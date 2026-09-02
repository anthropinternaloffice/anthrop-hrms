import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { personName } from '@/lib/format'
import type {
  EmergencyContact,
  EmploymentDetail,
  EmploymentStatus,
  EmployeeProfile,
  PersonDetail,
} from '@/lib/types'

/**
 * One employee's record.
 *
 * Three separate queries rather than one nested read. They are governed
 * by three different policies — a Manager may read a person in their
 * department but not that person's emergency contacts — and separating
 * them means a section this viewer is not allowed to see comes back
 * empty on its own instead of failing the whole page.
 *
 * Nothing here filters by role. What comes back is what row-level
 * security allows, and the screen describes the difference between
 * "nobody recorded this" and "you may not see this" (D10).
 */

interface EmploymentRow {
  id: string
  status: EmploymentStatus
  start_date: string | null
  end_date: string | null
  manager_employment_id: string | null
  job_title: { title: string } | null
  department: { name: string } | null
  manager: { person: { first_name: string; last_name: string; preferred_name: string | null } | null } | null
}

/** Most recent first: active before ended, then by start date. */
function byRecency(a: EmploymentRow, b: EmploymentRow): number {
  if (a.status !== b.status) return a.status === 'active' ? -1 : 1
  if (a.start_date === b.start_date) return 0
  if (a.start_date === null) return 1
  if (b.start_date === null) return -1
  return a.start_date < b.start_date ? 1 : -1
}

export async function getEmployeeProfile(
  personId: string,
): Promise<{ data: EmployeeProfile | null; error: PostgrestError | null; notFound: boolean }> {
  const { data: personRow, error: personError } = await supabase
    .from('people')
    .select(
      'id, first_name, middle_name, last_name, preferred_name, email, phone, date_of_birth, address_line1, address_line2, city, state, country',
    )
    .eq('id', personId)
    .maybeSingle()

  if (personError) return { data: null, error: personError, notFound: false }

  // No row is indistinguishable from no permission, and deliberately so.
  // Telling someone "this person exists but is not yours to see" would
  // leak the existence of staff outside their department.
  if (!personRow) return { data: null, error: null, notFound: true }

  const person: PersonDetail = {
    id: personRow.id as string,
    firstName: personRow.first_name as string,
    middleName: (personRow.middle_name as string | null) ?? null,
    lastName: personRow.last_name as string,
    preferredName: (personRow.preferred_name as string | null) ?? null,
    email: (personRow.email as string | null) ?? null,
    phone: (personRow.phone as string | null) ?? null,
    dateOfBirth: (personRow.date_of_birth as string | null) ?? null,
    addressLine1: (personRow.address_line1 as string | null) ?? null,
    addressLine2: (personRow.address_line2 as string | null) ?? null,
    city: (personRow.city as string | null) ?? null,
    state: (personRow.state as string | null) ?? null,
    country: (personRow.country as string | null) ?? null,
  }

  const { data: employmentRows, error: employmentError } = await supabase
    .from('employments')
    .select(
      `id, status, start_date, end_date, manager_employment_id,
       job_title:job_titles(title),
       department:departments(name),
       manager:employments!manager_employment_id(
         person:people(first_name, last_name, preferred_name)
       )`,
    )
    .eq('person_id', personId)

  if (employmentError) return { data: null, error: employmentError, notFound: false }

  const employments: EmploymentDetail[] = (employmentRows as unknown as EmploymentRow[])
    .slice()
    .sort(byRecency)
    .map((row) => ({
      id: row.id,
      jobTitle: row.job_title?.title ?? null,
      departmentName: row.department?.name ?? null,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      managerEmploymentId: row.manager_employment_id,
      managerName: row.manager?.person
        ? personName({
            firstName: row.manager.person.first_name,
            lastName: row.manager.person.last_name,
            preferredName: row.manager.person.preferred_name,
          })
        : null,
    }))

  const { data: contactRows, error: contactError } = await supabase
    .from('emergency_contacts')
    .select('id, name, relationship, phone')
    .eq('person_id', personId)
    .order('name', { ascending: true })

  // A Manager has no policy granting them emergency contacts, so this
  // returns an empty list rather than an error. The screen says which
  // it is; it does not pretend none were recorded.
  if (contactError) return { data: null, error: contactError, notFound: false }

  const emergencyContacts: EmergencyContact[] = (contactRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    relationship: (row.relationship as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
  }))

  return { data: { person, employments, emergencyContacts }, error: null, notFound: false }
}
