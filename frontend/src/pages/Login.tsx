import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/AuthLayout'
import { useAuth } from '@/lib/auth'

interface FromState {
  from?: { pathname?: string }
}

/**
 * Sign in.
 *
 * Three things the brief is explicit about, all of them security rather
 * than style:
 *
 * - One error message. Whether the address is unknown or the password is
 *   wrong, the reply is identical. The distinction is drawn in
 *   lib/auth.tsx and never reaches this screen. Anything else is a free
 *   tool for checking who works at Anthrop.
 * - No sign-up link. Staff accounts are created by an admin and the
 *   person is invited.
 * - No Google sign-in.
 */
export function Login() {
  const { session, initialising, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Where the guard was trying to send them before it asked them to sign in.
  const destination = (location.state as FromState | null)?.from?.pathname ?? '/app'

  if (!initialising && session) {
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    const { error: signInError } = await signIn(email, password)

    if (signInError) {
      setError(signInError)
      setPassword('')
      setSubmitting(false)
      return
    }

    navigate(destination, { replace: true })
  }

  return (
    <AuthLayout
      title="Sign in to Anthrop HR"
      description="Staff accounts are created by your administrator. If you do not have one, ask your HR contact."
      footer={
        <p>
          Trouble signing in? Contact{' '}
          <a
            href="mailto:info@anthropmanagement.com"
            className="font-medium text-brand underline underline-offset-4"
          >
            info@anthropmanagement.com
          </a>
          .
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && (
          <Alert
            variant="destructive"
            // Announced the moment it appears, for anyone not watching
            // the screen.
            role="alert"
            className="border-negative/30 bg-negative/5 text-negative"
          >
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription className="text-negative">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-ink">
            Work email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            // 44px: this is filled in with a thumb far more often than
            // with a mouse.
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password" className="text-ink">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="rounded-control text-sm font-medium text-brand underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            className="h-11 text-base"
          />
        </div>

        <Button type="submit" disabled={submitting} className="h-11 w-full text-base">
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
