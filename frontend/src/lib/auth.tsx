import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'

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
const SIGN_IN_FAILED = 'Those details were not recognised. Check the email address and password, then try again.'

interface AuthContextValue {
  session: Session | null
  /** True until the first session check finishes. Guards must wait for it. */
  initialising: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initialising, setInitialising] = useState(true)

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
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // The address is a variable, never a constant: this deployment moves
      // from .pages.dev to hr.anthropmanagement.com before Module 2.
      redirectTo: `${env.siteUrl}/reset-password`,
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
      error: error ? 'That password could not be set. It may be too short, or the link may have expired.' : null,
    }
  }, [])

  const value = useMemo(
    () => ({ session, initialising, signIn, signOut, requestPasswordReset, updatePassword }),
    [session, initialising, signIn, signOut, requestPasswordReset, updatePassword],
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
