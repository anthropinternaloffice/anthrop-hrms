import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { siteUrl } from '@/lib/env'
import type { Profile } from '@/lib/types'

/**
 * Session state for the whole application.
 *
 * Two rules shape everything below.
 *
 * Rule 7 — personal data is never written to the console. No email, no
 * name, no user id is logged here, on success or on failure. When
 * something goes wrong the user is told; the console is not.
 *
 * Account enumeration — every sign-in failure returns one message, and
 * every password reset returns one confirmation, whether or not the
 * address exists. Anthrop's staff list is not a thing a stranger gets to
 * confirm one address at a time.
 */

/** The only message a failed sign-in ever produces. */
const SIGN_IN_FAILED =
  'Those details were not recognised. Check the email address and password, then try again.'

interface AuthContextValue {
  session: Session | null
  /**
   * The signed-in person's tenant and role, once loaded.
   *
   * Null while loading, and null afterwards for an auth user with no
   * profile row — an account that exists but has not been set up. That
   * second case is real and is handled explicitly by the route guard,
   * because without a profile every query returns nothing and the
   * application would otherwise just look empty.
   */
  profile: Profile | null
  /** True until the first session check finishes. Guards must wait for it. */
  initialising: boolean
  /** True while the profile for the current session is being fetched. */
  profileLoading: boolean
  /**
   * Re-reads the profile for the signed-in user.
   *
   * Needed because one thing on that row changes during a session
   * without the session itself changing: must_change_password, cleared
   * the moment the person sets their own password. Without this the
   * forced-change screen would still be on display over an account that
   * had already complied.
   */
  refreshProfile: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initialising, setInitialising] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setInitialising(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setInitialising(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  // The profile is fetched per signed-in user, and cleared the moment
  // there is no user. Keying the effect on the id rather than the whole
  // session object stops a token refresh from re-fetching it every hour.
  const userId = session?.user.id ?? null

  // Bumped by refreshProfile() to re-run the effect below. A counter
  // rather than a second copy of the fetch, so there is one code path
  // that reads a profile and one shape it can leave the state in.
  const [profileVersion, setProfileVersion] = useState(0)
  const refreshProfile = useCallback(() => setProfileVersion((n) => n + 1), [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let active = true
    setProfileLoading(true)
    // Clear first. If one person signs out and another signs in, the
    // previous profile must not survive even for the length of a fetch —
    // it carries a tenant id, and this is a multi-tenant system.
    setProfile(null)

    supabase
      .from('profiles')
      .select('id, tenant_id, person_id, role, is_active, must_change_password')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProfile(
          data
            ? {
                id: data.id as string,
                tenantId: data.tenant_id as string,
                personId: (data.person_id as string | null) ?? null,
                role: data.role as Profile['role'],
                isActive: data.is_active as boolean,
                mustChangePassword: data.must_change_password as boolean,
              }
            : null,
        )
        setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId, profileVersion])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    // Deliberately discards what actually went wrong. Supabase can tell
    // an unknown address from a wrong password; the sign-in screen must
    // not, or it becomes a free tool for checking who works at Anthrop.
    return { error: error ? SIGN_IN_FAILED : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Read fresh at the moment the reset is requested, not frozen at
      // build time. This deployment moves from .pages.dev to
      // hr.anthropmanagement.com before Module 2, and that move must not
      // require anyone to remember to rebuild.
      redirectTo: `${siteUrl()}/reset-password`,
    })
    // The caller shows the same confirmation either way. Only a genuine
    // transport failure is worth surfacing, and even that says nothing
    // about whether the address is on file.
    if (error && error.status && error.status >= 500) {
      return { error: 'The reset email could not be sent just now. Try again in a moment.' }
    }
    return { error: null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return {
      error: error
        ? 'That password could not be set. It may be too short, or the link may have expired.'
        : null,
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      initialising,
      profileLoading,
      refreshProfile,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [
      session,
      profile,
      initialising,
      profileLoading,
      refreshProfile,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return context
}
