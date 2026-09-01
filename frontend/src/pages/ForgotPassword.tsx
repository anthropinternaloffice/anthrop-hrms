import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/AuthLayout'
import { useAuth } from '@/lib/auth'

/**
 * Request a password reset email.
 *
 * The confirmation is the same whether or not the address belongs to
 * anyone. Telling a stranger "no account found" would hand them the
 * staff list one guess at a time, and this screen needs no sign-in to
 * reach.
 */
export function ForgotPassword() {
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    const { error: resetError } = await requestPasswordReset(email)

    setSubmitting(false)

    if (resetError) {
      setError(resetError)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        description="If that address belongs to an Anthrop staff account, a reset link is on its way. The link expires, so use it soon."
      >
        <div className="space-y-6">
          <div
            className="flex items-start gap-3 rounded-card border border-line bg-wash p-4"
            role="status"
          >
            <MailCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-body">
              Nothing after a few minutes? Check the spam folder, then ask your HR contact to
              confirm which address your account uses.
            </p>
          </div>

          <Button asChild variant="outline" className="h-11 w-full text-base">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your work email and we will send you a link to set a new password."
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
            className="h-11 text-base"
          />
        </div>

        <Button type="submit" disabled={submitting} className="h-11 w-full text-base">
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>

        <Button asChild variant="ghost" className="h-11 w-full text-base">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </form>
    </AuthLayout>
  )
}
