import { Navigate, Outlet, useLocation } from 'react-router-dom'
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
  const { session, initialising } = useAuth()
  const location = useLocation()

  if (initialising) {
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

  return <Outlet />
}
