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

/**
 * A date, written the way it is written in Lagos: 4 February 2024.
 *
 * These are `date` columns, not timestamps — a start date has no time
 * and no zone, and parsing one as a timestamp is how a date silently
 * shifts by a day for anyone west of the server. So the string is split
 * on its own rather than handed to `new Date()`.
 */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function formatDate(value: string | null | undefined): string {
  if (isMissing(value)) return NOT_STATED

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value as string).trim())
  if (!match) return NOT_STATED

  const [, year, month, day] = match
  const monthName = MONTHS[Number(month) - 1]
  if (!monthName) return NOT_STATED

  return `${Number(day)} ${monthName} ${year}`
}

/**
 * Every time in this system is shown in Lagos time, whatever the device
 * thinks.
 *
 * Rule 8 exists because a device clock can be changed in seconds, and
 * the same reasoning applies to reading times as to writing them. A
 * phone left on the wrong timezone would otherwise show a colleague
 * clocking in at 05:30 when they arrived at 08:30 — the stored instant
 * is right and the screen is lying. Anthrop is in Lagos; the office day
 * is a Lagos day.
 */
export const DISPLAY_TIME_ZONE = 'Africa/Lagos'

/** 08:32 */
export function formatTime(iso: string | null | undefined): string {
  if (isMissing(iso)) return NOT_STATED
  return new Date(iso as string).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DISPLAY_TIME_ZONE,
  })
}

/** 2 September 2026 */
export function formatDayLong(iso: string | null | undefined): string {
  if (isMissing(iso)) return NOT_STATED
  return new Date(iso as string).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  })
}

/** Wednesday 2 September */
export function formatDayWithWeekday(iso: string | null | undefined): string {
  if (isMissing(iso)) return NOT_STATED
  return new Date(iso as string).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: DISPLAY_TIME_ZONE,
  })
}

/** The YYYY-MM-DD a given instant falls on in Lagos. */
export function lagosDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: DISPLAY_TIME_ZONE })
}

/**
 * How long between two instants, in plain words.
 *
 * Deliberately not a decision about anything. It says how long someone
 * was present; it does not say whether that was enough, or late, or
 * overtime. Those are policy questions Anthrop has not answered (D4).
 */
export function formatDuration(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} hr`
  return `${hours} hr ${rest} min`
}
