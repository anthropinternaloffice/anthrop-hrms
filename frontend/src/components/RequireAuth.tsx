import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

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
  const { session, profile, initialising, profileLoading, signOut } = useAuth()
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

  return <Outlet />
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
