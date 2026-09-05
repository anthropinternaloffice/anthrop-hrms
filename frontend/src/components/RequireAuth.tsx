import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MIN_PASSWORD_LENGTH, SetPasswordForm } from '@/components/SetPasswordForm'
import { useAuth } from '@/lib/auth'
import { clearPasswordChangeFlag } from '@/lib/users'

/**
 * The route guard. Anything nested under it is closed to the logged out.
 *
 * The `initialising` wait matters: on a page refresh Supabase reads the
 * stored session asynchronously, so for a moment a signed-in person looks
 * signed out. Redirecting during that moment would throw staff back to
 * the login screen every time they reload — so the guard holds instead.
 *
 * This guard is a convenience, not a security control. It hides screens;
 * it does not protect data. What protects data is row-level security in
 * the database, proved in database/tests/.
 */
export function RequireAuth() {
  const { session, profile, initialising, profileLoading, signOut, updatePassword, refreshProfile } =
    useAuth()
  const location = useLocation()

  if (initialising || (session && profileLoading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page px-gutter">
        <p className="text-sm text-quiet" role="status">
          Checking your sign-in…
        </p>
      </div>
    )
  }

  if (!session) {
    // `from` lets the login screen return the person to the page they
    // actually asked for, instead of dumping everyone on the home screen.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // A sign-in that works but has no profile row behind it. The account
  // exists in Supabase auth and was never linked to an organisation, so
  // app.current_tenant_id() returns null and every policy in the database
  // evaluates to false. Say that, rather than showing a working-looking
  // application in which nothing is ever found.
  if (!profile) {
    return <AccountNotSetUp onSignOut={() => void signOut()} />
  }

  // A profile that has been switched off. Their policies already return
  // nothing — current_tenant_id() requires is_active — so this only
  // replaces a confusing empty screen with the reason for it.
  if (!profile.isActive) {
    return (
      <AccountNotSetUp
        onSignOut={() => void signOut()}
        title="This account has been deactivated"
        body="Your access to Anthrop HR has been switched off. If you think that is a mistake, contact your HR administrator."
      />
    )
  }

  // Somebody else chose this password, and until that stops being true
  // there is no honest way to attribute anything this account does. It
  // blocks every screen rather than nagging from a banner: an audit log
  // is worth what its "who" column is worth, and a password two people
  // know is not a who.
  //
  // Rendered here rather than redirected to, so there is no window in
  // which the guard and the route disagree about where this person
  // should be.
  if (profile.mustChangePassword) {
    return (
      <ChangePasswordFirst
        onSubmit={async (password) => {
          const { error } = await updatePassword(password)
          if (error) return error
          await clearPasswordChangeFlag()
          // The profile is what this guard reads. Once it comes back
          // with the flag cleared, this screen is replaced by the
          // application — no navigation required.
          refreshProfile()
          return null
        }}
      />
    )
  }

  return <Outlet />
}

/**
 * The forced change.
 *
 * Deliberately offers no way past it except changing the password.
 * There is no "later", and no sign-out button either — signing out and
 * back in would land on exactly this screen again, so a control that
 * looks like an escape and is not would only waste somebody's time.
 */
function ChangePasswordFirst({
  onSubmit,
}: {
  onSubmit: (password: string) => Promise<string | null>
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-gutter py-12">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-gutter sm:p-card">
        <h1 className="text-xl font-semibold text-ink">Choose your own password</h1>
        <p className="mt-3 text-sm leading-relaxed text-body">
          This account&rsquo;s password was set up for you by an administrator, so somebody
          else knows it. Choose one only you know before going any further — everything you
          do in Anthrop HR is recorded against this account.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-quiet">
          At least {MIN_PASSWORD_LENGTH} characters, and not one you use anywhere else.
        </p>

        <div className="mt-6">
          <SetPasswordForm
            submitLabel="Save password and continue"
            busyLabel="Saving…"
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  )
}

function AccountNotSetUp({
  onSignOut,
  title = 'This account is not set up yet',
  body = 'Your sign-in works, but it has not been linked to an organisation, so there is nothing here to show you. Ask your HR administrator to finish setting up your account.',
}: {
  onSignOut: () => void
  title?: string
  body?: string
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-gutter py-12">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-gutter sm:p-card">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-body">{body}</p>
        <Button variant="outline" onClick={onSignOut} className="mt-6 h-11 w-full text-base">
          Sign out
        </Button>
      </div>
    </div>
  )
}
