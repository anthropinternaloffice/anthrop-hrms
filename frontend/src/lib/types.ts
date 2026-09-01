/**
 * Shapes returned by the database, in the application's own terms.
 *
 * The database speaks snake_case; everything above this file speaks
 * camelCase. The mapping happens once, in the functions that do the
 * querying, so a column rename is one edit rather than a search.
 */

/** public.app_role. The four roles, in descending order of reach. */
export type AppRole = 'owner' | 'hr' | 'manager' | 'staff'

/**
 * A login, and the person it belongs to.
 *
 * `personId` is null for an account not yet linked to an employee
 * record. That is a real state — an administrator can be given a login
 * before their employee record exists — and it is why "Staff sees only
 * themselves" has to be able to resolve to nothing at all.
 */
export interface Profile {
  id: string
  tenantId: string
  personId: string | null
  role: AppRole
  isActive: boolean
}

export interface Department {
  id: string
  name: string
  /** Null when no head has been recorded. Displayed as "Not stated". */
  headPersonId: string | null
  /** Resolved from the join, null when there is no head or it is unreadable. */
  headName: string | null
  isActive: boolean
}

export interface JobTitle {
  id: string
  title: string
  /** Null when no level has been recorded. Displayed as "Not stated". */
  level: string | null
  isActive: boolean
}

/** Just enough of a person to put them in a picker. */
export interface PersonOption {
  id: string
  name: string
}
