import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { siteUrl } from '@/lib/env'
import { personName } from '@/lib/format'
import type { AppRole, ManagedDepartment, PersonOption, UserAccount } from '@/lib/types'

/**
 * User administration.
 *
 * The same division of labour as everywhere else in this application,
 * and it matters more here than anywhere else: nothing in this file
 * enforces anything.
 *
 * Who may change a role, who may be deactivated, and who must remain an
 * Owner are decided by app.guard_role_assignment() in migration 0004,
 * and by the profiles policies in 0001. What this file does is ask, and
 * turn the refusal into a sentence somebody can act on. If the screen
 * and the database ever disagree about what is allowed, the database is
 * right and the screen is a bug.
 *
 * Nothing here writes to the audit log either. Triggers do that (rule
 * 3), including for the invitation — which is why the Edge Function
 * inserts the profile row as the inviter rather than as service_role.
 */

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

interface ProfileRow {
  id: string
  person_id: string | null
  role: AppRole
  is_active: boolean
  must_change_password: boolean
  person: { first_name: string; last_name: string; preferred_name: string | null } | null
}

interface AccountRow {
  id: string
  email: string | null
  last_sign_in_at: string | null
  invited_at: string | null
  confirmed_at: string | null
}

/**
 * Every account in this organisation.
 *
 * Two round trips that cannot be one. `profiles` is an ordinary table
 * under ordinary policies; email and sign-in dates live in `auth.users`,
 * which PostgREST does not expose and which no policy can reach. The
 * function supplies the second half and applies the same visibility rule
 * in its own body, so a Staff user calling this gets exactly one row
 * from each side — their own.
 *
 * The join is left-ish on purpose: a profile whose account details did
 * not come back still appears, with the email absent. That state is
 * possible if the auth user was deleted in the dashboard, and a row that
 * quietly vanished would be worse than one that says it is incomplete.
 */
export async function listUserAccounts(): Promise<{
  data: UserAccount[] | null
  error: PostgrestError | null
}> {
  const [profiles, accounts] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, person_id, role, is_active, must_change_password, person:people(first_name, last_name, preferred_name)',
      ),
    supabase.rpc('list_user_accounts'),
  ])

  if (profiles.error) return { data: null, error: profiles.error }
  if (accounts.error) return { data: null, error: accounts.error }

  const details = new Map<string, AccountRow>(
    ((accounts.data ?? []) as AccountRow[]).map((row) => [row.id, row]),
  )

  const rows = (profiles.data as unknown as ProfileRow[]).map((row): UserAccount => {
    const detail = details.get(row.id)
    return {
      id: row.id,
      email: detail?.email ?? null,
      role: row.role,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      personId: row.person_id,
      personName: row.person
        ? personName({
            firstName: row.person.first_name,
            lastName: row.person.last_name,
            preferredName: row.person.preferred_name,
          })
        : null,
      lastSignInAt: detail?.last_sign_in_at ?? null,
      confirmedAt: detail?.confirmed_at ?? null,
      invitedAt: detail?.invited_at ?? null,
    }
  })

  // Active first, then by name, then by the email, so an account with no
  // employee record still lands somewhere predictable rather than at the
  // top or the bottom of everything.
  rows.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return (a.personName ?? a.email ?? '').localeCompare(b.personName ?? b.email ?? '')
  })

  return { data: rows, error: null }
}

/**
 * Employee records that do not already have a login.
 *
 * `profiles.person_id` carries a unique constraint, so a second account
 * pointed at the same person is rejected by the database. Offering the
 * name in the picker anyway would be offering something that cannot
 * work.
 */
export async function listPeopleWithoutAccounts(): Promise<{
  data: PersonOption[] | null
  error: PostgrestError | null
}> {
  const [people, profiles] = await Promise.all([
    supabase.from('people').select('id, first_name, last_name, preferred_name').order('last_name'),
    supabase.from('profiles').select('person_id'),
  ])

  if (people.error) return { data: null, error: people.error }
  if (profiles.error) return { data: null, error: profiles.error }

  const taken = new Set(
    (profiles.data ?? [])
      .map((row) => row.person_id as string | null)
      .filter((id): id is string => id !== null),
  )

  return {
    data: (people.data ?? [])
      .filter((row) => !taken.has(row.id as string))
      .map((row) => ({
        id: row.id as string,
        name: personName({
          firstName: row.first_name as string,
          lastName: row.last_name as string,
          preferredName: row.preferred_name as string | null,
        }),
      })),
    error: null,
  }
}

/**
 * What the Manager role would actually resolve to for this person.
 *
 * The brief calls this out as a subtlety to make visible rather than to
 * document: a Manager's reach is worked out from their own active
 * employment plus anything they head, so assigning the role to somebody
 * with neither produces an account that signs in successfully and sees
 * nothing. That looks like a broken system rather than a missing
 * department, and the moment to say so is before the role is given, not
 * after the phone call.
 *
 * An empty array is the answer that matters. It is not an error.
 */
export async function listManagedDepartments(
  personId: string,
): Promise<{ data: ManagedDepartment[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc('departments_managed_by', {
    p_person_id: personId,
  })

  if (error) return { data: null, error }
  return {
    data: ((data ?? []) as { id: string; name: string }[]).map((row) => ({
      id: row.id,
      name: row.name,
    })),
    error: null,
  }
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export interface InviteResult {
  /** False when Supabase could not send the email. `actionLink` is then set. */
  emailSent: boolean
  /** The link that should have been emailed, when it could not be. */
  actionLink: string | null
  error: string | null
}

/**
 * Invite somebody.
 *
 * The only write in this application that does not go straight to
 * PostgREST. Creating a login for another person needs Supabase's admin
 * API, which needs the service_role key, which rule 6 keeps out of the
 * browser — so the call goes to the `invite-user` Edge Function, where
 * that key lives. See D13.
 *
 * The return address is read from the browser rather than built in
 * (D11), and is safe for the reason given there: Supabase refuses to
 * redirect anywhere that is not on its own allowlist.
 */
export async function inviteUser(input: {
  email: string
  role: AppRole
  personId: string | null
}): Promise<InviteResult> {
  const { data, error } = await supabase.functions.invoke<{
    emailSent?: boolean
    actionLink?: string | null
    error?: string
  }>('invite-user', {
    body: {
      email: input.email,
      role: input.role,
      personId: input.personId,
      redirectTo: `${siteUrl()}/reset-password`,
    },
  })

  // A non-2xx reply arrives as an error with the body attached, so the
  // function's own sentence has to be dug out of it. Falling back to a
  // generic line rather than the transport error keeps a stack-shaped
  // message off the screen.
  if (error) {
    let message = 'The invitation could not be sent. Try again in a moment.'
    const response = (error as { context?: Response }).context
    if (response && typeof response.json === 'function') {
      try {
        const body = (await response.json()) as { error?: string }
        if (typeof body.error === 'string' && body.error.trim() !== '') message = body.error
      } catch {
        // Keep the generic message. Nothing is logged: rule 7.
      }
    }
    return { emailSent: false, actionLink: null, error: message }
  }

  if (data?.error) return { emailSent: false, actionLink: null, error: data.error }

  return {
    emailSent: data?.emailSent ?? false,
    actionLink: data?.actionLink ?? null,
    error: null,
  }
}

/** Owner only, enforced by app.guard_role_assignment(). */
export async function changeUserRole(
  id: string,
  role: AppRole,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  return { error }
}

/**
 * Switch an account off, or back on.
 *
 * Never a delete. `profiles.id` is referenced by every audit entry that
 * names this person as the actor, and a system that can erase a user
 * erases the record of what they did.
 *
 * Switching off takes effect at once rather than at the next sign-in:
 * app.current_tenant_id() requires is_active, so from the moment this
 * write lands, every policy in the database evaluates to false for that
 * account. Their session token stays valid until it expires, and buys
 * them nothing — every query returns empty, and the route guard shows
 * them the reason as soon as the page is next loaded.
 */
export async function setUserActive(
  id: string,
  isActive: boolean,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  return { error }
}

/**
 * Clears the "you did not choose this password" flag.
 *
 * A function rather than an update, because the alternative was giving
 * every user an UPDATE policy on their own profile row — which would
 * have handed them their own role, tenant and active flag to edit, to
 * solve a one-column problem.
 */
export async function clearPasswordChangeFlag(): Promise<void> {
  await supabase.rpc('clear_password_change_flag')
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * The sentences migration 0004 raises, and nothing else.
 *
 * A Postgres error message can quote the row that caused it, and that
 * row is somebody's personal data (rule 7) — so error text is not passed
 * through to the screen on trust. These four are ours: written in the
 * trigger, addressed to the person reading them, and containing no data.
 * Anything else gets a generic line.
 */
const OUR_GUARDS = [
  'Only an Owner may change a role.',
  'Only an Owner may create an account with a role above Staff.',
  'You cannot remove your own Owner role. Another Owner has to do it for you.',
  'This is the last active Owner. Give somebody else the Owner role first, or the organisation locks itself out.',
]

export function describeUserError(error: PostgrestError): string {
  const message = error.message ?? ''
  const ours = OUR_GUARDS.find((guard) => message.includes(guard))
  if (ours) return ours

  switch (error.code) {
    case '23505':
      return 'That employee record already has an account.'
    case '23503':
      return 'That record no longer exists. Reload the page and try again.'
    case '42501':
      return 'You do not have permission to make that change.'
    default:
      return 'That change could not be saved. If it keeps happening, contact your administrator.'
  }
}
