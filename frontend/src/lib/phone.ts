/**
 * Phone numbers, normalised to E.164 on the way in.
 *
 * The brief is specific: accept 08031234567 and store +2348031234567,
 * so the same person is never two records later. That matters more than
 * it looks — a returning applicant in Module 2 is matched partly on
 * contact details, and "08031234567" and "+234 803 123 4567" are the
 * same human being written two ways.
 *
 * The database agrees and enforces it:
 *   check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
 * so anything this function returns has to satisfy that pattern, and a
 * value it cannot normalise must be refused here with something a
 * person can act on rather than sent down to fail as a constraint
 * violation.
 *
 * The one thing this must never do is guess. A number that does not
 * match a shape we recognise is handed back to the user to write in
 * full international form — inventing a country code for it would be
 * rule 4 applied to the most consequential field on the record.
 */

/** Nigeria. The only country code this infers, because it is the only one we can. */
const NG = '+234'

/**
 * A Nigerian mobile subscriber number: ten digits beginning 7, 8 or 9.
 *
 * The leading digit matters. `^[1-9][0-9]{9}$` would also swallow
 * 1234567890 and hand back +2341234567890 — a number for a person who
 * may not be in Nigeria at all. Anthrop recruits expatriates, and an
 * invented country code is a wrong number in an emergency.
 */
const NG_MOBILE = /^[789][0-9]{9}$/

const E164 = /^\+[1-9][0-9]{7,14}$/

export interface PhoneResult {
  /** E.164, or null when the field was left empty. */
  value: string | null
  /** A message for the user, or null when the value is usable. */
  error: string | null
}

export function normalisePhone(input: string): PhoneResult {
  // Spaces, dashes, dots, brackets: all decoration. Strip them before
  // looking at anything.
  const cleaned = input.replace(/[\s().-]/g, '')

  if (cleaned === '') return { value: null, error: null }

  // 00 is the international access prefix. It is only treated as one
  // when what follows is long enough to be a country code plus a real
  // subscriber number — otherwise 008031234567, which is somebody
  // pressing 0 twice before a local number, becomes +8031234567 and
  // dials another continent.
  if (cleaned.startsWith('00')) {
    const rest = cleaned.slice(2)
    if (rest.length < 11) {
      return {
        value: null,
        error: 'That number was not recognised. If it is an international number, write it starting with + and the country code.',
      }
    }
    return E164.test(`+${rest}`)
      ? { value: `+${rest}`, error: null }
      : { value: null, error: 'That international number does not look complete.' }
  }

  const international = cleaned

  if (international.startsWith('+')) {
    return E164.test(international)
      ? { value: international, error: null }
      : {
          value: null,
          error: 'That international number does not look complete. Check the digits after the country code.',
        }
  }

  if (/[^0-9]/.test(international)) {
    return {
      value: null,
      error: 'A phone number can only contain digits, and may start with +.',
    }
  }

  // 2348031234567 — the country code without its plus.
  if (international.startsWith('234')) {
    const candidate = `+${international}`
    return E164.test(candidate)
      ? { value: candidate, error: null }
      : { value: null, error: 'That number starts with 234 but is not the right length for Nigeria.' }
  }

  // 08031234567 — how the number is written and said in Nigeria.
  if (international.startsWith('0')) {
    const subscriber = international.slice(1)
    return NG_MOBILE.test(subscriber)
      ? { value: `${NG}${subscriber}`, error: null }
      : {
          value: null,
          error: 'A Nigerian mobile number should be 11 digits beginning 07, 08 or 09, like 08031234567. For any other number, write it starting with + and the country code.',
        }
  }

  // 8031234567 — the same number with the trunk 0 dropped.
  if (NG_MOBILE.test(international)) {
    return { value: `${NG}${international}`, error: null }
  }

  // Anything else is a number we cannot place. Say so and ask for the
  // country code rather than assuming this person is Nigerian: Anthrop
  // recruits expatriates, and a wrong guess here is a wrong number in
  // an emergency.
  return {
    value: null,
    error: 'That number was not recognised. Write it in full international form, starting with + and the country code.',
  }
}
