import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

/**
 * An address that matches nothing.
 *
 * It sends people somewhere they can actually get to, which depends on
 * whether they are signed in — offering "Go to Home" to a logged-out
 * stranger only bounces them off the route guard.
 */
export function NotFound() {
  const { session } = useAuth()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-gutter py-12">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium tracking-wide text-quiet uppercase">Page not found</p>

        <h1 className="mt-3 text-2xl font-semibold text-ink">
          That address does not exist
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-body">
          The link may be out of date, or it may have been mistyped.
        </p>

        <Button asChild className="mt-8 h-11 w-full text-base sm:w-auto sm:px-6">
          {session ? <Link to="/app">Go to Home</Link> : <Link to="/">Back to the main page</Link>}
        </Button>
      </div>
    </div>
  )
}
