import type { ReactNode } from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * The frame shared by Departments and Job titles.
 *
 * Both screens are the same shape: a heading, one "Add" button that only
 * Owner and HR ever see, and a list that is either loading, empty,
 * broken, or full. Writing that shape twice would guarantee the two
 * drift apart.
 */
export function SetupPage({
  title,
  description,
  addLabel,
  canManage,
  onAdd,
  error,
  children,
}: {
  title: string
  description: string
  addLabel: string
  canManage: boolean
  onAdd: () => void
  error: string | null
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">{description}</p>
        </div>

        {/* Drawn only for the roles that can actually write. Row-level
            security is what enforces that; this just avoids offering
            someone a button that would fail. */}
        {canManage && (
          <Button onClick={onAdd} className="h-11 w-full shrink-0 sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            {addLabel}
          </Button>
        )}
      </div>

      {error && (
        <Alert
          variant="destructive"
          role="alert"
          className="mt-6 border-negative/30 bg-negative/5 text-negative"
        >
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription className="text-negative">{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6">{children}</div>
    </div>
  )
}

/** Shown while the first load is in flight. Never shown instead of an empty list. */
export function ListLoading() {
  return (
    <div className="rounded-card border border-line bg-surface p-gutter sm:p-card">
      <p className="text-sm text-quiet" role="status">
        Loading…
      </p>
    </div>
  )
}

/** Shown when the list really is empty, which is not the same as loading. */
export function ListEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
      <p className="text-sm leading-relaxed text-body">{message}</p>
    </div>
  )
}

/**
 * Active or inactive.
 *
 * `positive` is one of the two state colours D3 approved, and this is
 * exactly what they are for. Inactive is grey rather than red: a closed
 * department is not an error.
 */
export function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center rounded-control bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-control bg-wash-strong px-2 py-0.5 text-xs font-medium text-quiet">
      Inactive
    </span>
  )
}
