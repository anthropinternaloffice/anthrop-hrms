import { useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2, UserMinus, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, lagosDayKey, personName } from '@/lib/format'
import { deactivatePerson, reactivatePerson } from '@/lib/deactivation'
import type { PersonDetail } from '@/lib/types'

/**
 * Taking an employee off the active roster, and putting them back.
 *
 * ---------------------------------------------------------------------
 * WHY THERE IS NO DELETE BUTTON, WRITTEN WHERE PEOPLE LOOK FOR ONE
 * ---------------------------------------------------------------------
 *
 * The complaint this answers was not that deletion was missing. It was
 * that somebody looking for a way to remove a leaver found nothing at
 * all, and concluded the system was half-built. An absent control
 * teaches nobody anything.
 *
 * So the control exists, it is called Deactivate, and the dialog says in
 * one sentence why it is not called Delete. Genuine erasure — a data
 * subject exercising their rights under the NDPA — is a separate flow
 * with its own approval and its own audit trail, and it is a Module 12
 * item. It is deliberately not sitting next to Edit, where a busy
 * administrator would find it on the way to something else.
 */

/** The banner at the top of an inactive employee's profile. */
export function InactiveBanner({ person }: { person: PersonDetail }) {
  if (person.isActive) return null

  return (
    <div
      className="mt-6 rounded-card border border-line bg-wash-strong p-gutter sm:p-card"
      role="status"
    >
      <p className="font-medium text-ink">This employee is inactive</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-quiet">Reason</dt>
          {/* Never "Not stated": the database refuses a deactivation
              without one, so a blank here would mean something is wrong
              rather than something is missing. */}
          <dd className="text-body">{person.deactivationReason}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-quiet">Effective from</dt>
          <dd className="text-body">{formatDate(person.deactivatedEffectiveOn)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-quiet">Recorded</dt>
          <dd className="text-body">{formatDate(person.deactivatedAt)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-body">
        Their record is kept in full. It is hidden from the employee list unless "Show
        inactive employees" is ticked, and everything already recorded against them —
        attendance, documents, the audit log — is untouched.
      </p>
    </div>
  )
}

/**
 * The button. Owner and HR only; the write policies are what enforce
 * that, this decides what to draw.
 */
export function RosterButton({
  person,
  onChanged,
}: {
  person: PersonDetail
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        className="h-11 w-full shrink-0 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        {person.isActive ? (
          <>
            <UserMinus className="size-4" aria-hidden="true" />
            Deactivate
          </>
        ) : (
          <>
            <UserPlus className="size-4" aria-hidden="true" />
            Reactivate
          </>
        )}
      </Button>

      {open &&
        (person.isActive ? (
          <DeactivateDialog
            person={person}
            onClose={(changed) => {
              setOpen(false)
              if (changed) onChanged()
            }}
          />
        ) : (
          <ReactivateDialog
            person={person}
            onClose={(changed) => {
              setOpen(false)
              if (changed) onChanged()
            }}
          />
        ))}
    </>
  )
}

function DeactivateDialog({
  person,
  onClose,
}: {
  person: PersonDetail
  onClose: (changed: boolean) => void
}) {
  const [reason, setReason] = useState('')
  // Today in Lagos, not today on the device. Somebody in another
  // timezone filling this in should get the office's date.
  const [effectiveOn, setEffectiveOn] = useState(() => lagosDayKey(new Date().toISOString()))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = personName(person)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    // Checked here so the person finds out before they lose their
    // typing, and again in the database, which is what actually holds
    // the rule.
    if (reason.trim() === '') {
      setError('Give a reason. It becomes part of the record.')
      return
    }
    if (effectiveOn === '') {
      setError('Give the date this takes effect.')
      return
    }

    setSubmitting(true)
    setError(null)

    const failed = await deactivatePerson({
      personId: person.id,
      reason: reason.trim(),
      effectiveOn,
    })

    setSubmitting(false)

    if (failed) {
      setError(failed)
      return
    }

    onClose(true)
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose(false)}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Deactivate {name}</DialogTitle>
            <DialogDescription>
              They come off the active employee list and any open employment is closed. The
              record itself is kept — employee records are never deleted, because the audit
              log refers to them and deleting a person would delete the history of what was
              done to them. You can reactivate them at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="deactivate-reason" className="text-ink">
                Reason
              </Label>
              <Input
                id="deactivate-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Resigned, contract ended, retired…"
                className="h-11 text-base"
                autoFocus
              />
              <p className="text-sm text-quiet">
                Stored against both the person and the employment being closed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deactivate-date" className="text-ink">
                Effective date
              </Label>
              <Input
                id="deactivate-date"
                type="date"
                value={effectiveOn}
                onChange={(event) => setEffectiveOn(event.target.value)}
                className="h-11 text-base"
              />
              {/* Said plainly, because the alternative is somebody
                  setting a future date and expecting the system to act
                  on it by itself. Nothing in Module 1 runs on a timer. */}
              <p className="text-sm text-quiet">
                Their last day. They are removed from the active list straight away, whatever
                date you put here.
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="pb-2 text-sm font-medium text-negative">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Deactivate employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReactivateDialog({
  person,
  onClose,
}: {
  person: PersonDetail
  onClose: (changed: boolean) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = personName(person)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    const failed = await reactivatePerson(person.id)

    setSubmitting(false)

    if (failed) {
      setError(failed)
      return
    }

    onClose(true)
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose(false)}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reactivate {name}</DialogTitle>
            <DialogDescription>
              They go back on the active employee list, and the reason they were deactivated
              is cleared from their record. This is written to the audit log like any other
              change.
            </DialogDescription>
          </DialogHeader>

          {/* The one thing that is not undone, said before they click
              rather than discovered afterwards on an empty profile. */}
          <div className="py-4">
            <p className="rounded-card border border-line bg-wash-strong p-gutter text-sm leading-relaxed text-body">
              Their old employment stays closed. Somebody returning holds a new post from a
              new date, so add their current job under Employment history — the system will
              not guess at dates nobody has stated.
            </p>
          </div>

          {error && (
            <p role="alert" className="pb-2 text-sm font-medium text-negative">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Reactivate employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
