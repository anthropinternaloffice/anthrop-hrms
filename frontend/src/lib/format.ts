import type { AppRole } from '@/lib/types'

/**
 * Rule 4: missing data is stored as null and displayed as "Not stated" —
 * never a plausible guess.
 *
 * The string lives here once so that it reads identically on every
 * screen. "Not stated" is not the same claim as "None" or "N/A": it says
 * nobody has recorded this, which is the only thing the system actually
 * knows.
 */
export const NOT_STATED = 'Not stated'

/**
 * True when a value is genuinely absent. A string of spaces counts as
 * absent — someone pressing space in a text field has not stated
 * anything, and storing that would make an empty value look like data.
 */
export function isMissing(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === ''
}

/** A value for display, or "Not stated" when there is none. */
export function orNotStated(value: string | null | undefined): string {
  return isMissing(value) ? NOT_STATED : (value as string).trim()
}

/**
 * A text field on its way into the database.
 *
 * Empty and whitespace-only become null rather than ''. Rule 4 says
 * missing data is stored as null; an empty string is a value that claims
 * to be an answer, and it would display as blank instead of
 * "Not stated".
 */
export function toNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Collapses runs of whitespace so "Field  Ops" and "Field Ops" match. */
export function tidyName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  hr: 'HR',
  manager: 'Manager',
  staff: 'Staff',
}

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role]
}

/**
 * How a person's name is written on screen.
 *
 * The preferred name wins over the first name when there is one: someone
 * who goes by Bola should be called Bola by their own HR system. The
 * legal first name still exists on the record and on their profile — it
 * is not being discarded, only not led with.
 *
 * Middle names are deliberately left out of list views. They belong on
 * the profile, not in a column that has to survive a phone.
 */
export function personName(person: {
  firstName: string
  lastName: string
  preferredName?: string | null
}): string {
  const given = isMissing(person.preferredName) ? person.firstName : (person.preferredName as string)
  return `${given} ${person.lastName}`.trim()
}
