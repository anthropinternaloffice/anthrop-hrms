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

/**
 * 8:32 AM. The only place a time is turned into words.
 *
 * Twelve-hour, because that is how Anthrop's staff read a clock: 1pm,
 * not 13:00. Display only — nothing stored, compared, sorted or
 * exported goes through here. Attendance records hold instants, and the
 * database is still the only thing that decides what o'clock it is
 * (rule 8).
 *
 * `hour: 'numeric'` rather than `'2-digit'`: 1:00 PM, not 01:00 PM. The
 * leading zero is a 24-hour habit and reads as a typo on a 12-hour
 * clock.
 *
 * The locale is 'en-US' for one reason only — it is the one that renders
 * the suffix as "AM"/"PM" rather than "am"/"pm". Nothing else about US
 * conventions is wanted here, and nothing else leaks in: only the hour
 * and minute are asked for, and the timezone stays Lagos. Dates are
 * formatted separately and stay British-long (4 September 2026), because
 * 04/09/26 means two different days depending on who is reading it.
 */
export function formatTime(iso: string | null | undefined): string {
  if (isMissing(iso)) return NOT_STATED

  const formatted = new Date(iso as string).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DISPLAY_TIME_ZONE,
  })

  // Recent versions of ICU put a narrow no-break space (U+202F) before
  // AM/PM, older ones use an ordinary space. Both are invisible to a
  // reader and different to everything else — a string comparison in a
  // test, a CSV cell, a search. Normalise so the output does not depend
  // on which browser build somebody happens to be running.
  return formatted.replace(/\u202f/g, ' ')
}

/**
 * A wall-clock string — `YYYY-MM-DDTHH:mm`, what a `datetime-local`
 * input holds — read back in words: "2 September 2026, 1:00 PM".
 *
 * This exists for one stubborn corner of Task 3. A `datetime-local`
 * input's *value* is fixed by the HTML specification as 24-hour, and its
 * *widget* is drawn by the browser in the device's own locale. Neither
 * is ours to change, so on a phone set to en-GB the correction screen
 * will still show a 24-hour picker no matter what this codebase does.
 *
 * What can be done is make sure the 24-hour picker is never the only
 * reading available: the screen echoes back, in words, the time the
 * person has actually entered. That also catches the mistake this dialog
 * is most likely to produce — 08:00 typed when 20:00 was meant.
 *
 * The string is parsed by hand rather than through `new Date()`. It has
 * no timezone in it and already *is* Lagos time; handing it to the Date
 * constructor would have the browser interpret it in the device's zone
 * and shift it by hours.
 */
export function formatWallClock(value: string | null | undefined): string {
  if (isMissing(value)) return NOT_STATED

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec((value as string).trim())
  if (!match) return NOT_STATED

  const [, day, hourText, minute] = match
  const date = formatDate(day)
  if (date === NOT_STATED) return NOT_STATED

  const hour = Number(hourText)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return NOT_STATED

  // Midnight is 12 AM and noon is 12 PM. `hour % 12` alone gives zero
  // for both, which is the classic way a hand-rolled 12-hour clock goes
  // wrong.
  const suffix = hour < 12 ? 'AM' : 'PM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12

  return `${date}, ${twelve}:${minute} ${suffix}`
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
