import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListEmpty, ListLoading, SetupPage, StatusBadge } from '@/components/setup/SetupPage'
import { ConfirmDeactivate } from '@/components/setup/ConfirmDeactivate'
import { useAuth } from '@/lib/auth'
import { useAsyncList } from '@/lib/useAsyncList'
import { NOT_STATED, isMissing } from '@/lib/format'
import {
  createJobTitle,
  describeWriteError,
  listJobTitles,
  setJobTitleActive,
  updateJobTitle,
} from '@/lib/setup'
import type { JobTitle } from '@/lib/types'

export function JobTitles() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'owner' || profile?.role === 'hr'

  const { items, error, loading, reload } = useAsyncList<JobTitle>(listJobTitles)

  const [editing, setEditing] = useState<JobTitle | 'new' | null>(null)
  const [deactivating, setDeactivating] = useState<JobTitle | null>(null)

  const closeDialog = useCallback(
    (changed: boolean) => {
      setEditing(null)
      if (changed) void reload()
    },
    [reload],
  )

  return (
    <SetupPage
      title="Job titles"
      description="The roles staff can hold. Like departments, a job title is switched off rather than deleted so that past employment records keep their meaning."
      addLabel="Add job title"
      canManage={canManage}
      onAdd={() => setEditing('new')}
      error={error}
    >
      {loading && items === null ? (
        <ListLoading />
      ) : items && items.length === 0 ? (
        <ListEmpty
          message={
            canManage
              ? 'No job titles yet. Add the first one to get started.'
              : 'No job titles have been added yet.'
          }
        />
      ) : (
        <JobTitleList
          jobTitles={items ?? []}
          canManage={canManage}
          onEdit={setEditing}
          onDeactivate={setDeactivating}
          onReactivate={async (jobTitle) => {
            await setJobTitleActive(jobTitle.id, true)
            void reload()
          }}
        />
      )}

      {editing && (
        <JobTitleDialog
          jobTitle={editing === 'new' ? null : editing}
          tenantId={profile?.tenantId ?? ''}
          onClose={closeDialog}
        />
      )}

      {deactivating && (
        <ConfirmDeactivate
          title="Switch off this job title?"
          body={`"${deactivating.title}" will stop appearing when someone is given a job title. Existing employment records keep it, and you can switch it back on at any time.`}
          confirmLabel="Switch off"
          onCancel={() => setDeactivating(null)}
          onConfirm={async () => {
            const { error: writeError } = await setJobTitleActive(deactivating.id, false)
            setDeactivating(null)
            if (!writeError) void reload()
            return writeError ? describeWriteError(writeError, 'job title') : null
          }}
        />
      )}
    </SetupPage>
  )
}

function JobTitleList({
  jobTitles,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  jobTitles: JobTitle[]
  canManage: boolean
  onEdit: (jobTitle: JobTitle) => void
  onDeactivate: (jobTitle: JobTitle) => void
  onReactivate: (jobTitle: JobTitle) => void
}) {
  return (
    <>
      {/* Phone: one card per title. */}
      <ul className="space-y-3 sm:hidden">
        {jobTitles.map((jobTitle) => (
          <li key={jobTitle.id} className="rounded-card border border-line bg-surface p-gutter">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-ink">{jobTitle.title}</p>
              <StatusBadge isActive={jobTitle.isActive} />
            </div>

            <p className="mt-2 text-sm text-body">
              Level:{' '}
              <span className={isMissing(jobTitle.level) ? 'text-quiet' : 'text-ink'}>
                {jobTitle.level ?? NOT_STATED}
              </span>
            </p>

            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2">
                <RowActions
                  isActive={jobTitle.isActive}
                  onEdit={() => onEdit(jobTitle)}
                  onDeactivate={() => onDeactivate(jobTitle)}
                  onReactivate={() => onReactivate(jobTitle)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Tablet and up: the table. */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-ink">Title</TableHead>
              <TableHead className="text-ink">Level</TableHead>
              <TableHead className="text-ink">Status</TableHead>
              {canManage && <TableHead className="sr-only">Actions</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {jobTitles.map((jobTitle) => (
              <TableRow key={jobTitle.id}>
                <TableCell className="font-medium text-ink">{jobTitle.title}</TableCell>
                <TableCell className={isMissing(jobTitle.level) ? 'text-quiet' : 'text-body'}>
                  {jobTitle.level ?? NOT_STATED}
                </TableCell>
                <TableCell>
                  <StatusBadge isActive={jobTitle.isActive} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <RowActions
                        isActive={jobTitle.isActive}
                        onEdit={() => onEdit(jobTitle)}
                        onDeactivate={() => onDeactivate(jobTitle)}
                        onReactivate={() => onReactivate(jobTitle)}
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function RowActions({
  isActive,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  isActive: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onEdit} className="h-10">
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Button>
      {isActive ? (
        <Button variant="outline" size="sm" onClick={onDeactivate} className="h-10">
          Switch off
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onReactivate} className="h-10">
          Switch on
        </Button>
      )}
    </>
  )
}

function JobTitleDialog({
  jobTitle,
  tenantId,
  onClose,
}: {
  jobTitle: JobTitle | null
  tenantId: string
  onClose: (changed: boolean) => void
}) {
  const [title, setTitle] = useState(jobTitle?.title ?? '')
  const [level, setLevel] = useState(jobTitle?.level ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (title.trim() === '') {
      setError('Give the job title a name.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: writeError } = jobTitle
      ? await updateJobTitle(jobTitle.id, { title, level })
      : await createJobTitle({ tenantId, title, level })

    setSubmitting(false)

    if (writeError) {
      setError(describeWriteError(writeError, 'job title'))
      return
    }

    onClose(true)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jobTitle ? 'Edit job title' : 'Add job title'}</DialogTitle>
          <DialogDescription>Every change here is recorded in the audit log.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <p role="alert" className="text-sm font-medium text-negative">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="job-title" className="text-ink">
              Title
            </Label>
            <Input
              id="job-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={submitting}
              autoFocus
              required
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-level" className="text-ink">
              Level <span className="font-normal text-quiet">(optional)</span>
            </Label>
            <Input
              id="job-level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              disabled={submitting}
              className="h-11 text-base"
            />
            {/* Anthrop has not defined a grading scheme, so this is free
                text rather than a list of levels nobody agreed. Left
                empty it is stored as null and reads as "Not stated". */}
            <p className="text-sm text-quiet">
              For example: Junior, Senior, Manager. Leave it empty if there is no level.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
              className="h-11 text-base"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-11 text-base">
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {jobTitle ? 'Save changes' : 'Add job title'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
