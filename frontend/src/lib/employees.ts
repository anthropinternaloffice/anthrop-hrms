import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { personName } from '@/lib/format'
import type { EmployeeRow, EmploymentStatus } from '@/lib/types'

/**
 * The employee list.
 *
 * Queried from `people` rather than from `employments`, which matters:
 * the two are separate tables on purpose (D2), and a person can exist
 * before anyone has recorded what they do. Starting from employments
 * would make those people silently disappear from the list they were
 * just added to — which is exactly the kind of quiet omission rule 4
 * exists to prevent. They appear here with "Not stated" against the
 * columns nobody has filled in yet.
 *
 * The role rules are not applied here. A Manager seeing only their own
 * department, and Staff seeing only themselves, is decided by row-level
 * security on `people` and `employments` — proved in database/tests/ and
 * re-verified against the live database. This function asks for
 * everything and receives only what the caller is allowed to have.
 */

interface EmploymentEmbed {
  id: string
  status: EmploymentStatus
  start_date: string | null
  end_date: string | null
  job_title: { title: string } | null
  department: { id: string; name: string } | null
}

interface PersonEmbed {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  is_active: boolean
  employments: EmploymentEmbed[]
}

/**
 * Which employment speaks for this person.
 *
 * Someone can hold more than one row here — a job that ended and a
 * current one, or two spells at the company years apart. The list shows
 * what they do *now*, so an active employment always wins. Among equals,
 * the one that started most recently wins; a null start date sorts last,
 * because an undated record is the weakest claim to being current, not
 * the strongest.
 */
function primaryEmployment(employments: EmploymentEmbed[]): EmploymentEmbed | null {
  if (employments.length === 0) return null

  const ranked = [...employments].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    if (a.start_date === b.start_date) return 0
    if (a.start_date === null) return 1
    if (b.start_date === null) return -1
    return a.start_date < b.start_date ? 1 : -1
  })

  return ranked[0]
}

export async function listEmployees(): Promise<{
  data: EmployeeRow[] | null
  error: PostgrestError | null
}> {
  const { data, error } = await supabase
    .from('people')
    .select(
      `id, first_name, last_name, preferred_name, is_active,
       employments(
         id, status, start_date, end_date,
         job_title:job_titles(title),
         department:departments(id, name)
       )`,
    )
    .order('last_name', { ascending: true })

  if (error) return { data: null, error }

  const rows = (data as unknown as PersonEmbed[]).map((person) => {
    const employment = primaryEmployment(person.employments ?? [])

    return {
      personId: person.id,
      name: personName({
        firstName: person.first_name,
        lastName: person.last_name,
        preferredName: person.preferred_name,
      }),
      lastName: person.last_name,
      searchText: [person.first_name, person.preferred_name, person.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      jobTitle: employment?.job_title?.title ?? null,
      departmentId: employment?.department?.id ?? null,
      departmentName: employment?.department?.name ?? null,
      status: employment?.status ?? null,
      // Filtering is not done here. The list hides inactive people by
      // default, but it does so in the page, after the fetch, so that
      // "Show inactive" is instant and does not re-query. There are
      // hundreds of employees at most; this is not a table that needs
      // pagination yet, and pretending otherwise would add a loading
      // state to a checkbox.
      isActive: person.is_active,
    } satisfies EmployeeRow
  })

  return { data: rows, error: null }
}
