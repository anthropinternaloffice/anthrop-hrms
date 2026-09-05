/**
 * Checks for formatTime(). Run with: npm run check:format
 *
 * Same shape as phone.check.ts, and for the same reason: no test library
 * is named in the brief, Node runs TypeScript directly, so this is a
 * plain script with no dependencies.
 *
 * It exists because Task 3 makes a claim that is easy to state and easy
 * to break — that no 24-hour time appears anywhere in the interface —
 * and the thing enforcing it is one function every screen happens to
 * call. Nothing stops the next person adding a screen that formats a
 * time itself, but at least the shared helper is held to the claim.
 *
 * The three failure modes worth catching:
 *
 *   1. A 24-hour hour creeping back (13:00 rather than 1:00 PM).
 *   2. `hour: '2-digit'` returning, which gives 01:00 PM — a leading
 *      zero is a 24-hour habit and reads as a typo on a 12-hour clock.
 *   3. The timezone being dropped, which is the serious one. These are
 *      instants; formatted without a zone they render in whatever the
 *      machine running the code believes, and a phone left on the wrong
 *      timezone would show a colleague clocking in three hours early.
 *      The stored value would be right and the screen would be lying.
 *
 * Lagos is UTC+1 all year and does not observe daylight saving, so the
 * expected values below are simply the UTC hour plus one.
 */
import { formatTime, formatWallClock, NOT_STATED } from './format.ts'

const cases: Array<[iso: string, expected: string, note: string]> = [
  ['2026-09-05T12:00:00Z', '1:00 PM', "the brief's own example: 1:00 PM, not 13:00"],
  ['2026-09-05T08:30:00Z', '9:30 AM', "the brief's other example: 9:30 AM, not 09:30"],
  ['2026-09-05T07:32:00Z', '8:32 AM', 'a morning clock-in'],
  ['2026-09-05T16:45:00Z', '5:45 PM', 'an evening clock-out'],

  // The two that a 12-hour clock gets wrong if anybody rebuilds this by
  // hand with arithmetic. Hour 0 is 12 AM, not 0 AM; hour 12 is 12 PM,
  // not 0 PM.
  ['2026-09-04T23:00:00Z', '12:00 AM', 'midnight in Lagos is 12 AM, not 0 AM'],
  ['2026-09-05T11:00:00Z', '12:00 PM', 'noon in Lagos is 12 PM, not 0 PM'],
  ['2026-09-04T23:59:00Z', '12:59 AM', 'the minute before the day turns over'],

  // Lagos is UTC+1, so an instant late in the UTC day is already
  // tomorrow morning here. Formatting without the timezone would show
  // 22:15 or 10:15 PM on the wrong date.
  ['2026-09-05T23:15:00Z', '12:15 AM', 'UTC+1 pushes this into the next Lagos day'],

  // No daylight saving in Lagos, ever. A formatter that quietly used the
  // machine's zone would drift by an hour half the year in London.
  ['2026-01-15T12:00:00Z', '1:00 PM', 'January — no seasonal shift'],
  ['2026-07-15T12:00:00Z', '1:00 PM', 'July — still no seasonal shift'],

  ['', NOT_STATED, 'empty string is absent, not midnight'],
]

/** Anything that still looks like a 24-hour clock. */
const TWENTY_FOUR_HOUR = /^(0\d|1[3-9]|2[0-3]):/

let failures = 0

for (const [iso, expected, note] of cases) {
  const actual = formatTime(iso === '' ? null : iso)

  const correct = actual === expected
  const stillTwentyFour = TWENTY_FOUR_HOUR.test(actual)

  // U+202F is what recent ICU builds put before AM/PM. formatTime
  // normalises it to an ordinary space; if that ever stops happening the
  // string still looks right in a terminal and compares unequal
  // everywhere else, which is the worst kind of wrong.
  const hiddenSpace = actual.includes('\u202f')

  if (!correct || stillTwentyFour || hiddenSpace) failures += 1

  const status = correct && !stillTwentyFour && !hiddenSpace ? 'ok  ' : 'FAIL'
  const flags = [
    stillTwentyFour ? ' [24-HOUR]' : '',
    hiddenSpace ? ' [NARROW NO-BREAK SPACE]' : '',
    correct ? '' : ` [expected ${expected}]`,
  ].join('')

  console.log(`${status}  ${(iso || '(null)').padEnd(22)} -> ${actual.padEnd(10)}${flags}  ${note}`)
}

/**
 * formatWallClock() reads back what somebody typed into a
 * `datetime-local` input.
 *
 * The input's value is a wall-clock string with no timezone in it, and
 * it is already Lagos time. The trap being guarded against is somebody
 * later "simplifying" this to `new Date(value)`, which would have the
 * browser read it in the device's zone and shift every correction by
 * however many hours that device happens to be out.
 */
const wallClockCases: Array<[input: string, expected: string, note: string]> = [
  ['2026-09-05T13:00', '5 September 2026, 1:00 PM', '13:00 typed reads back as 1:00 PM'],
  ['2026-09-05T08:30', '5 September 2026, 8:30 AM', 'a morning correction'],
  ['2026-09-05T20:00', '5 September 2026, 8:00 PM', '20:00 is 8 PM, the evening mistake'],
  ['2026-09-05T00:00', '5 September 2026, 12:00 AM', 'midnight is 12 AM, not 0 AM'],
  ['2026-09-05T12:00', '5 September 2026, 12:00 PM', 'noon is 12 PM, not 0 PM'],
  ['2026-09-05T23:59', '5 September 2026, 11:59 PM', 'the last minute of the day'],
  ['2026-09-05T09:05', '5 September 2026, 9:05 AM', 'minutes keep their leading zero'],

  // No timezone conversion may happen. The date must come back as the
  // date that was typed, whatever zone the machine running this is in.
  ['2026-01-01T00:30', '1 January 2026, 12:30 AM', 'no zone shift across a year boundary'],

  ['', NOT_STATED, 'empty is absent'],
  ['not a date', NOT_STATED, 'unparseable is absent, never a guess (rule 4)'],
  ['2026-09-05T25:00', NOT_STATED, 'an impossible hour is refused, not wrapped around'],
]

console.log('')

for (const [input, expected, note] of wallClockCases) {
  const actual = formatWallClock(input === '' ? null : input)
  const correct = actual === expected

  if (!correct) failures += 1

  const status = correct ? 'ok  ' : 'FAIL'
  const flag = correct ? '' : ` [expected ${expected}]`
  console.log(
    `${status}  ${(input || '(null)').padEnd(22)} -> ${actual.padEnd(26)}${flag}  ${note}`,
  )
}

if (failures > 0) {
  // Thrown rather than process.exit(1), so Node's globals stay out of
  // the app's TypeScript scope. An uncaught throw exits non-zero too.
  throw new Error(`${failures} time formatting ${failures === 1 ? 'case' : 'cases'} failed.`)
}

console.log(
  `\n${cases.length + wallClockCases.length} cases pass. Every time reads as a 12-hour Lagos clock.`,
)
