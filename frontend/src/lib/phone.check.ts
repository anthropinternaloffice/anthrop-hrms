/**
 * Checks for normalisePhone(). Run with: npm run check:phone
 *
 * Not a test suite and not a test framework — the brief names no test
 * library and adding one is a decision for the human. Node runs
 * TypeScript directly, so this is a plain script with no dependencies.
 *
 * It exists because this is the function in Module 1 most able to
 * corrupt data quietly. A wrong phone number does not throw; it sits in
 * the record looking perfectly reasonable until somebody needs it in an
 * emergency, or until Module 2 fails to recognise a returning applicant
 * because their number was stored two different ways.
 *
 * Both of the cases marked REGRESSION were real bugs, found by running
 * this the first time.
 */
import { normalisePhone } from './phone.ts'

/** The exact constraint on public.people.phone. Nothing may violate it. */
const DB_CHECK = /^\+[1-9][0-9]{7,14}$/

const cases: Array<[input: string, expected: string | null, note: string]> = [
  ['08031234567', '+2348031234567', "the brief's own example"],
  ['0803 123 4567', '+2348031234567', 'spaces'],
  ['0803-123-4567', '+2348031234567', 'dashes'],
  ['(0803) 123 4567', '+2348031234567', 'brackets'],
  ['+2348031234567', '+2348031234567', 'already E.164'],
  ['+234 803 371 3519', '+2348033713519', "Anthrop's own published number"],
  ['2348031234567', '+2348031234567', 'country code without the plus'],
  ['00234803123456', '+234803123456', '00 international prefix'],
  ['8031234567', '+2348031234567', 'trunk 0 dropped'],
  ['07012345678', '+2347012345678', '070 mobile prefix'],
  ['09012345678', '+2349012345678', '090 mobile prefix'],
  ['+44 20 7946 0958', '+442079460958', 'a UK number keeps its own country code'],
  ['', null, 'empty stays null (rule 4)'],
  ['   ', null, 'whitespace only stays null'],
  ['0803123456', null, 'too short for Nigeria'],
  ['080312345678', null, 'too long for Nigeria'],
  ['01234567', null, 'Lagos landline in local form: refused, not guessed'],
  ['0123456789', null, 'leading 0 but not a mobile prefix'],
  ['abcd', null, 'letters refused'],
  ['+1', null, 'too short to be anything'],

  // REGRESSION: returned +8031234567, dialling another continent because
  // somebody pressed 0 twice before a local number.
  ['008031234567', null, 'REGRESSION: 00 then a local number is refused, not re-routed'],

  // REGRESSION: returned +2341234567890. An unplaceable number was being
  // given a Nigerian country code — inventing the most consequential
  // field on the record.
  ['1234567890', null, 'REGRESSION: unplaceable number is never guessed as Nigerian'],
]

let failures = 0

for (const [input, expected, note] of cases) {
  const { value, error } = normalisePhone(input)

  const correct = value === expected
  const legal = value === null || DB_CHECK.test(value)
  if (!correct || !legal) failures += 1

  const status = correct && legal ? 'ok  ' : 'FAIL'
  const violation = legal ? '' : ' [VIOLATES DB CHECK]'
  const reason = error ? `  (${error.slice(0, 44)}…)` : ''
  console.log(`${status}  ${JSON.stringify(input).padEnd(20)} -> ${String(value).padEnd(16)}${violation}${reason}  ${note}`)
}

if (failures > 0) {
  // Thrown rather than process.exit(1). Using `process` would mean
  // pulling Node's globals into the app's TypeScript scope, and then
  // nothing would stop browser code reaching for them by accident. An
  // uncaught throw exits non-zero just as well.
  throw new Error(`${failures} phone normalisation ${failures === 1 ? 'case' : 'cases'} failed.`)
}

console.log(`\n${cases.length} cases pass. Every non-null result satisfies the database CHECK.`)
