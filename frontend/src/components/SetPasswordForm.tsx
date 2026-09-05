import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Supabase's own floor. Stated up front rather than after a failure. */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Choosing a password.
 *
 * Used from two places that are not the same screen but are exactly the
 * same form: the emailed reset link, and the forced change shown to
 * somebody whose password was set for them. Writing the validation twice
 * would have been the way the two quietly acquire different rules.
 *
 * `onSubmit` resolves to an error message, or null on success. What
 * happens next — a redirect, a re-read of the profile — belongs to the
 * caller, because the two callers do different things.
 */
export function SetPasswordForm({
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  submitLabel: string
  busyLabel: string
  onSubmit: (password: string) => Promise<string | null>
}) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (password !== confirmation) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    const failure = await onSubmit(password)

    // Only stop the spinner on failure. On success the caller is
    // replacing this screen, and re-enabling the button first produces a
    // visible flash of a form that is about to disappear.
    if (failure) {
      setSubmitting(false)
      setError(failure)
    }
  }

  return (
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
          minLength={MIN_PASSWORD_LENGTH}
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
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={submitting}
          className="h-11 text-base"
        />
      </div>

      <Button type="submit" disabled={submitting} className="h-11 w-full text-base">
        {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {submitting ? busyLabel : submitLabel}
      </Button>
    </form>
  )
}
