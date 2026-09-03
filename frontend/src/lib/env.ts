/**
 * Environment configuration.
 *
 * Read once, checked once, at module load. A missing key becomes a loud
 * failure on the first screen rather than a silent 401 somewhere inside
 * the employee list three weeks later.
 *
 * Rule 6: the service_role key never appears in frontend code. Only the
 * anon key belongs here — it has no privileges of its own and is
 * governed entirely by the row-level security policies in
 * database/migrations/0001_module1_core_schema.sql.
 */

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing ${name}. Copy frontend/.env.example to frontend/.env.local and fill in the three values.`,
    )
  }
  return value.trim()
}

/** Guards against the single worst configuration mistake available here. */
function refuseServiceRoleKey(key: string): string {
  try {
    const payload = JSON.parse(atob(key.split('.')[1] ?? '')) as { role?: string }
    if (payload.role === 'service_role') {
      throw new Error(
        'VITE_SUPABASE_ANON_KEY holds a service_role key. That key bypasses every ' +
          'row-level security policy and must never reach a browser. Rotate it in ' +
          'Supabase now, then put the anon/public key here instead.',
      )
    }
  } catch (error) {
    // A key we cannot decode is not evidence of a problem — newer Supabase
    // publishable keys are not JWTs at all. Only rethrow our own refusal.
    if (error instanceof Error && error.message.startsWith('VITE_SUPABASE_ANON_KEY')) {
      throw error
    }
  }
  return key
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL'),
  supabaseAnonKey: refuseServiceRoleKey(required('VITE_SUPABASE_ANON_KEY')),
} as const

/**
 * Where this deployment lives — read from the browser, fresh, every time
 * it is asked for.
 *
 * This used to be `VITE_SITE_URL`, and that was a mistake. Vite replaces
 * `import.meta.env.*` with a string literal during `npm run build`, so
 * the address was frozen at the moment the site was built: the bundle
 * literally contained `VITE_SITE_URL:"http://localhost:5173"`. Anyone
 * who changed the domain and did not also rebuild would carry on sending
 * password-reset emails pointing at the old address — and would have no
 * reason to suspect it, because every other part of the site would work.
 *
 * `window.location.origin` is the address the person is actually on. It
 * cannot go stale, it is right on a preview deployment and on localhost
 * without anyone configuring anything, and it survives the move to
 * hr.anthropmanagement.com with no rebuild at all.
 *
 * This is not a hole. Supabase only redirects to addresses on its own
 * allowlist (Authentication → URL Configuration), so a tampered origin
 * is refused there rather than honoured. The allowlist is the control;
 * this value only has to be honest about where we are.
 *
 * `VITE_SITE_URL` survives as an optional override for the one case the
 * browser cannot see: serving from behind a proxy on a different public
 * address. Leave it unset unless that is true.
 */
export function siteUrl(): string {
  const override = import.meta.env.VITE_SITE_URL
  const value =
    typeof override === 'string' && override.trim() !== ''
      ? override.trim()
      : window.location.origin

  // No trailing slash, so `${siteUrl()}/reset-password` is well formed.
  return value.replace(/\/+$/, '')
}
