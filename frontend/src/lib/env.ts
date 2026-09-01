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
  /** No trailing slash, so `${siteUrl}/reset-password` is always well formed. */
  siteUrl: required('VITE_SITE_URL').replace(/\/+$/, ''),
} as const
