// =====================================================================
// invite-user
// Anthrop HRMS — Extension brief, Task 1.
//
// Creating a login for somebody else needs Supabase's admin API, and
// that needs the service_role key. Rule 6 says that key never appears in
// frontend code, and it does not: it exists only inside this function,
// which runs on Supabase's own infrastructure and is never downloaded by
// a browser.
//
// This is not the "separate backend server" Module 1 rules out. There is
// no server to provision, patch or pay for — it is part of the Supabase
// project in the same way Storage is. See D13 in docs/decisions.md.
//
// ---------------------------------------------------------------------
// THE TWO CLIENTS, AND WHY THERE ARE TWO
// ---------------------------------------------------------------------
//
// `admin` holds the service_role key and is used for exactly one thing:
// creating the auth user and sending them a link. That is the only step
// no policy can express, because the person does not exist yet.
//
// `caller` holds the anon key and the inviter's own access token, so
// every query it makes is the inviter making it. The profiles row is
// written with THIS client, deliberately:
//
//   - row-level security still applies (profiles_write_owner_hr);
//   - app.guard_role_assignment() still applies, so the database — not
//     the code below — is what actually stops an HR user handing out an
//     Owner role;
//   - auth.uid() is the inviter, so app.audit_row() records who did it.
//
// Writing that row with the admin client would have produced an audit
// entry with a null actor: "the database did this". The brief requires
// every invite to be in the audit log, and an entry that cannot say who
// is not much of one.
//
// The role checks below therefore decide which error message to show.
// They are not the security boundary. The database is.
// =====================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/** The four roles, from public.app_role. */
const ROLES = ['owner', 'hr', 'manager', 'staff'] as const
type Role = (typeof ROLES)[number]

/**
 * Allow-Origin is `*` on purpose.
 *
 * The alternative is a list of addresses, and this deployment has four
 * that change: localhost, every Cloudflare preview build, the current
 * .pages.dev address, and hr.anthropmanagement.com once that is decided.
 * A list would be one more thing to update at exactly the moment nobody
 * remembers it exists, and it would fail silently.
 *
 * Nothing is protected by withholding it. This function authenticates by
 * bearer token, not by cookie, so a page on another origin gains nothing
 * from being allowed to make the request — it still has to have somebody
 * signed in and their access token. There is no ambient authority here
 * for a wildcard to leak.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** One shape for every failure, so the frontend has one thing to read. */
function fail(message: string, status: number): Response {
  return reply({ error: message }, status)
}

interface InviteRequest {
  email: string
  role: Role
  personId: string | null
  redirectTo: string
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Reads the request body, or says what is wrong with it. */
function parseRequest(raw: unknown): InviteRequest | string {
  if (typeof raw !== 'object' || raw === null) return 'The request was not understood.'
  const body = raw as Record<string, unknown>

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_SHAPE.test(email)) return 'That does not look like an email address.'

  const role = body.role
  if (typeof role !== 'string' || !ROLES.includes(role as Role)) {
    return 'That is not one of the four roles.'
  }

  const personId = body.personId
  if (personId !== null && personId !== undefined && typeof personId !== 'string') {
    return 'The employee record reference was not understood.'
  }
  if (typeof personId === 'string' && !UUID_SHAPE.test(personId)) {
    return 'The employee record reference was not understood.'
  }

  // Where the emailed link lands. Supplied by the browser rather than
  // built in, for the reasons in D11 — and safe for the same reason:
  // Supabase refuses to redirect anywhere that is not on its own
  // allowlist, so this value only has to be honest about where the
  // person currently is. The allowlist is the control.
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo.trim() : ''
  if (!redirectTo.startsWith('http')) return 'The return address was not understood.'

  return { email, role: role as Role, personId: (personId as string | null) ?? null, redirectTo }
}

/**
 * Does this failure mean the address already has a login?
 *
 * GoTrue does not use one error code for it across every endpoint, so
 * both the code and the wording are checked. Getting this wrong is not
 * dangerous — it only decides whether we try the fallback below — but
 * getting it right is the difference between a useful message and
 * "something went wrong".
 */
function meansAlreadyRegistered(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return true
  const text = (error.message ?? '').toLowerCase()
  return text.includes('already been registered') || text.includes('already exists')
}

interface InviteOutcome {
  userId: string
  /** False when Supabase could not send the email and we have a link instead. */
  emailSent: boolean
  /** Only set when emailSent is false. The link that should have been emailed. */
  actionLink: string | null
  /** True when this call created the login, and may therefore undo it. */
  createdNow: boolean
}

/**
 * Create the login and get a set-password link to them.
 *
 * The happy path is one call. The rest of this function exists because
 * of one operational fact: a Supabase project on the free plan sends a
 * handful of emails an hour through a shared service that is explicitly
 * not meant for production. Until Anthrop configures their own SMTP,
 * invitation emails will sometimes simply not arrive.
 *
 * The honest response to that is not to fail — the account is wanted
 * either way — but to hand the link back to the Owner who asked for it,
 * saying plainly that it was not sent. They can pass it on themselves.
 * It is the same single-use, expiring link the email would have carried.
 */
async function createInvitation(
  admin: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<InviteOutcome | string> {
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (!invited.error && invited.data?.user) {
    return { userId: invited.data.user.id, emailSent: true, actionLink: null, createdNow: true }
  }

  // The address already has a login. Not necessarily in this
  // organisation — but this call is not the place to find that out. If
  // they already belong here, the profiles insert below fails on the
  // primary key and says so; if they belong somewhere else, it fails on
  // policy. Either way the answer comes from the database rather than
  // from us guessing.
  const alreadyRegistered = meansAlreadyRegistered(invited.error)

  const link = await admin.auth.admin.generateLink({
    // An existing login cannot be invited again, but it can be sent a
    // link to set a password, which is the same thing from the
    // recipient's side.
    type: alreadyRegistered ? 'recovery' : 'invite',
    email,
    options: { redirectTo },
  })

  if (link.error || !link.data?.user || !link.data.properties?.action_link) {
    return alreadyRegistered
      ? 'That email address already has an account.'
      : 'The invitation could not be created. Check the email address and try again.'
  }

  return {
    userId: link.data.user.id,
    emailSent: false,
    actionLink: link.data.properties.action_link,
    createdNow: !alreadyRegistered,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail('Use POST.', 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return fail('Sign in and try again.', 401)

  let parsed: InviteRequest | string
  try {
    parsed = parseRequest(await req.json())
  } catch {
    return fail('The request was not understood.', 400)
  }
  if (typeof parsed === 'string') return fail(parsed, 400)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  // All three are injected by Supabase itself. If one is missing the
  // function is misdeployed, and saying so beats a null dereference.
  if (!url || !anonKey || !serviceKey) {
    return fail('This function is not configured correctly. Contact your administrator.', 500)
  }

  // The inviter, acting as themselves.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData?.user) return fail('Sign in and try again.', 401)

  // profiles_select_self returns exactly this person's own row.
  const { data: me } = await caller
    .from('profiles')
    .select('tenant_id, role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!me || !me.is_active) {
    return fail('This account cannot invite anybody.', 403)
  }

  // Mirrors the database, to produce a sentence instead of a constraint
  // violation. app.guard_role_assignment() is what enforces it.
  if (me.role !== 'owner' && me.role !== 'hr') {
    return fail('Only an Owner or HR can invite somebody.', 403)
  }
  if (parsed.role !== 'staff' && me.role !== 'owner') {
    return fail('Only an Owner can invite somebody with a role above Staff.', 403)
  }

  // The service_role key. Used for the next call and nothing else.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const outcome = await createInvitation(admin, parsed.email, parsed.redirectTo)
  if (typeof outcome === 'string') return fail(outcome, 400)

  // Back to the inviter's own client: policy, role guard and audit log
  // all apply, and the log records their name rather than nobody's.
  const { error: profileError } = await caller.from('profiles').insert({
    id: outcome.userId,
    // Not trusted from the request — read from the inviter's own profile
    // a moment ago, and re-tested by the policy's WITH CHECK.
    tenant_id: me.tenant_id,
    person_id: parsed.personId,
    role: parsed.role,
    is_active: true,
  })

  if (profileError) {
    // A login with no profile is worse than no login: it can sign in,
    // sees "this account is not set up yet", and quietly occupies the
    // address so the next attempt fails too. Undo it — but only if this
    // call is what made it.
    if (outcome.createdNow) {
      await admin.auth.admin.deleteUser(outcome.userId)
    }

    if (profileError.code === '23505') {
      return fail('That person already has an account here.', 409)
    }
    if (profileError.code === '42501' || profileError.message?.includes('Only an Owner')) {
      return fail('Only an Owner can give somebody that role.', 403)
    }
    // Nothing is logged. A Postgres error can quote the offending row,
    // and that row is somebody's personal data (rule 7).
    return fail('The account could not be created. Try again, or contact your administrator.', 400)
  }

  return reply(
    { userId: outcome.userId, emailSent: outcome.emailSent, actionLink: outcome.actionLink },
    200,
  )
})
