import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/AuthLayout'
import { useAuth } from '@/lib/auth'

/** Supabase's own floor. Stated up front rather than after a failure. */
const MIN_LENGTH = 8

/**
 * Set a new password, reached from the emailed link.
 *
 * The link carries a recovery session, which the Supabase client picks up
 * from the URL on load. So by the time this screen renders, the person is
 * already authenticated as themselves and needs only to choose the new
 * password. If they arrive without a valid session — an expired or reused
 * link — the update fails and lib/auth.tsx says so.
 */
export function ResetPassword() {
  const { session, initialising, updatePassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }

    if (password !== confirmation) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: updateError } = await updatePassword(password)

    setSubmitting(false)

    if (updateError) {
      setError(updateError)
      return
    }

    navigate('/app', { replace: true })
  }

  // An expired or already-used link leaves no session behind. Say that
  // plainly instead of letting someone fill in a form that cannot work.
  if (!initialising && !session) {
    return (
      <AuthLayout
        title="This link has expired"
        description="Reset links can only be used once, and they do not last long. Request a new one and it will arrive in a moment."
      >
        <Button asChild className="h-11 w-full text-base">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set a new password"
      description={`Choose a password of at least ${MIN_LENGTH} characters that you do not use anywhere else.`}
      showBackLink={false}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && (
          <Alert
            variant="destructive"
            role="alert"
            className="border-negative/30 bg-negative/5 text-negative"
          >
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription className="text-negative">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="password" className="text-ink">
            New password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmation" className="text-ink">
            Confirm new password
          </Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={submitting}
            className="h-11 text-base"
          />
        </div>

        <Button type="submit" disabled={submitting} className="h-11 w-full text-base">
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
