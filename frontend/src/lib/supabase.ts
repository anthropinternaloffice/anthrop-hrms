import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * The one Supabase client for the application.
 *
 * Everything this client can see or change is decided by the row-level
 * security policies on the database, not by anything written here. The
 * frontend is not the security boundary and must never be treated as one.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The password reset link arrives as a URL fragment. Let the client
    // consume it on load so /reset-password opens already authenticated.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
