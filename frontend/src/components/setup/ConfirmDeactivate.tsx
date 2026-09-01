import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/**
 * Confirmation before switching something off.
 *
 * Deliberately a React dialog and never `window.confirm`. A browser
 * modal blocks the page thread, and on a phone it renders as a system
 * alert with no relation to anything else on screen.
 *
 * `onConfirm` resolves to an error message, or null on success, so the
 * failure is shown inside the dialog the person is already looking at
 * rather than behind it.
 */
export function ConfirmDeactivate({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => Promise<string | null>
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <AlertDialog open onOpenChange={(open) => !open && !working && onCancel()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p role="alert" className="text-sm font-medium text-negative">
            {error}
          </p>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={working} className="h-11 text-base">
            Cancel
          </AlertDialogCancel>

          {/* Not AlertDialogAction: that closes the dialog on click, which
              would take the error message with it. */}
          <Button
            onClick={async () => {
              setWorking(true)
              setError(await onConfirm())
              setWorking(false)
            }}
            disabled={working}
            className="h-11 text-base"
          >
            {working && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
