import { supabase } from '@/lib/supabase'

/**
 * Taking somebody off the active roster, and putting them back.
 *
 * Both go through public.set_person_active rather than an update from
 * here, for one reason: deactivating a person also ends their open
 * employment, and two separate requests from a browser can half-succeed.
 * A phone on Lagos mobile data is exactly where that happens. Inside the
 * function it is one transaction, so the record cannot end up saying the
 * person has left while their job is still open.
 *
 * The function is security invoker, so the same policies that govern the
 * Edit screen govern this. Nothing here is a permission check — the
 * roles below decide which buttons to draw, and the database decides
 * what actually happens.
 *
 * Nothing writes to the audit log from here either. The AFTER triggers
 * on `people` and `employments` do that, including for reactivation,
 * which the brief asks for by name.
 */

interface DeactivateInput {
  personId: string
  reason: string
  /** ISO date, `yyyy-mm-dd`, from a native date input. */
  effectiveOn: string
}

export async function deactivatePerson(input: DeactivateInput): Promise<string | null> {
  const { error } = await supabase.rpc('set_person_active', {
    p_person_id: input.personId,
    p_active: false,
    p_reason: input.reason,
    p_effective_on: input.effectiveOn,
  })

  return error ? describeDeactivationError(error.message) : null
}

export async function reactivatePerson(personId: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_person_active', {
    p_person_id: personId,
    p_active: true,
    p_reason: null,
    p_effective_on: null,
  })

  return error ? describeDeactivationError(error.message) : null
}

/**
 * The four sentences 0006 raises, and nothing else.
 *
 * Same approach as describeUserError: a Postgres error can quote the row
 * that caused it, and that row is somebody's name, phone number and
 * address. Passing the raw message to the screen would put personal data
 * in front of whoever happens to be looking, and into any error
 * reporting that picks it up later (rule 7). So the known messages are
 * matched and anything else becomes a generic sentence.
 */
const KNOWN_MESSAGES = [
  'Give a reason for deactivating this employee.',
  'Give the date this takes effect.',
  'You cannot deactivate your own employee record. Somebody else has to do it for you.',
  'That employee record is not yours to change.',
]

export function describeDeactivationError(message: string): string {
  const match = KNOWN_MESSAGES.find((known) => message.includes(known))
  if (match) return match

  return 'That change could not be saved. Check your connection and try again.'
}
