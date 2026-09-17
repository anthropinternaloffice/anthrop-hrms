import { useEffect, useState } from 'react'
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
 * Ask for a sign-in link.
 *
 * Two kinds of person arrive here and the screen serves both without
 * asking which they are: somebody who has forgotten a password, and
 * somebody whose invitation link expired or was spent before they read
 * the email. The link they get is the same link, and it lands on the
 * same screen. Calling this "reset your password" made it look like it
 * was no use to the second person, who has no password to reset.
 *
 * The confirmation is the same whether or not the address belongs to
 * anyone. Telling a stranger "no account found" would hand them the
 * staff list one guess at a time, and this screen needs no sign-in to
 * reach.
 *
 * Nothing here is written to the audit log, for the same reason: there
 * is no signed-in caller, so an entry could only record what an
 * anonymous visitor typed. Links an administrator sends on somebody's
 * behalf are logged — that is the Users and roles screen.
 */

/**
 * Supabase refuses a second link for the same address too soon after the
 * first, and the wait is roughly a minute. The button counts it down
 * rather than being tapped into an error, and the number is a guess at
 * somebody else's setting, so it is worded as one.
 */
const RESEND_WAIT_SECONDS = 60

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(0)

  // One interval for the whole countdown, cleared when it reaches zero
  // or the screen goes away. Keyed on whether it is running rather than
  // on the number, or it would tear down and rebuild the timer every
  // second and the last second would never quite arrive.
  const counting = waiting > 0
  useEffect(() => {
    if (!counting) return
    const timer = setInterval(() => setWaiting((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [counting])

  async function send(): Promise<void> {
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
    setWaiting(RESEND_WAIT_SECONDS)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await send()
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        description="If that address belongs to an Anthrop staff account, a link is on its way. It can be used once, and it expires — so open it when you have a minute to choose a password."
      >
        <div className="space-y-6">
          <div
            className="flex items-start gap-3 rounded-card border border-line bg-wash p-4"
            role="status"
          >
            <MailCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-body">
              Nothing after a few minutes? Check the spam folder. A link that has expired, or
              that was opened once already, cannot be used again — send yourself another one
              below.
            </p>
          </div>

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

          <Button
            onClick={() => void send()}
            disabled={submitting || waiting > 0}
            className="h-11 w-full text-base"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting
              ? 'Sending…'
              : waiting > 0
                ? `Send another link in ${waiting}s`
                : 'Send another link'}
          </Button>

          <Button asChild variant="outline" className="h-11 w-full text-base">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Send me a sign-in link"
      description="Enter your work email and we will send you a link to set a password — whether you have forgotten yours or your invitation link has expired."
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
          {submitting ? 'Sending…' : 'Send link'}
        </Button>

        <Button asChild variant="ghost" className="h-11 w-full text-base">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </form>
    </AuthLayout>
  )
}
