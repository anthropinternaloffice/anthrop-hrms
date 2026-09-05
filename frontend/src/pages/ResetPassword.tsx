import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/AuthLayout'
import { MIN_PASSWORD_LENGTH, SetPasswordForm } from '@/components/SetPasswordForm'
import { useAuth } from '@/lib/auth'
import { clearPasswordChangeFlag } from '@/lib/users'

/**
 * Set a new password, reached from an emailed link.
 *
 * Two kinds of link land here and the screen deliberately does not try
 * to tell them apart: a password reset the person asked for, and the
 * invitation an administrator sent them. Both carry a session that the
 * Supabase client picks up from the URL on load, so by the time this
 * renders the person is already authenticated as themselves and needs
 * only to choose a password. The wording below is true of both.
 *
 * Guessing at which one it was would mean reading the link's `type`
 * before the client consumes it — a race with a library that is
 * deliberately doing its work on load — to win nothing but a warmer
 * greeting.
 */
export function ResetPassword() {
  const { session, initialising, updatePassword, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // An expired or already-used link leaves no session behind. Say that
  // plainly instead of letting someone fill in a form that cannot work.
  if (!initialising && !session) {
    return (
      <AuthLayout
        title="This link has expired"
        description="Sign-in links can only be used once, and they do not last long. Request a new one and it will arrive in a moment."
      >
        <Button asChild className="h-11 w-full text-base">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set your password"
      description={`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters that you do not use anywhere else.`}
      showBackLink={false}
    >
      <SetPasswordForm
        submitLabel="Save password"
        busyLabel="Saving…"
        onSubmit={async (password) => {
          const { error } = await updatePassword(password)
          if (error) return error

          // If this account was one whose password somebody else chose,
          // that is no longer true. Harmless when the flag was already
          // clear, which is the usual case.
          await clearPasswordChangeFlag()
          refreshProfile()

          navigate('/app', { replace: true })
          return null
        }}
      />
    </AuthLayout>
  )
}
