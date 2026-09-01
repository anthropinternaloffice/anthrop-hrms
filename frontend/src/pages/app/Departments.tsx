import { useCallback, useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListEmpty, ListLoading, SetupPage, StatusBadge } from '@/components/setup/SetupPage'
import { ConfirmDeactivate } from '@/components/setup/ConfirmDeactivate'
import { useAuth } from '@/lib/auth'
import { useAsyncList } from '@/lib/useAsyncList'
import { NOT_STATED } from '@/lib/format'
import {
  HEAD_NOT_VISIBLE,
  createDepartment,
  describeWriteError,
  listDepartments,
  listPeopleOptions,
  setDepartmentActive,
  updateDepartment,
} from '@/lib/setup'
import type { Department, PersonOption } from '@/lib/types'

/** Radix Select cannot hold an empty string, so absence needs a name. */
const NO_HEAD = 'none'

/**
 * How a department's head reads.
 *
 * Three outcomes, and collapsing any two of them would be a lie. No head
 * recorded is "Not stated" (rule 4). A head that exists but cannot be
 * read is said so plainly — a Manager and a Staff user can see every
 * department but almost no people, so this is the normal case for them,
 * not a fault.
 */
function headLabel(department: Department): { text: string; muted: boolean } {
  if (department.headPersonId === null) return { text: NOT_STATED, muted: true }
  if (department.headName === null) return { text: HEAD_NOT_VISIBLE, muted: true }
  return { text: department.headName, muted: false }
}

export function Departments() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'owner' || profile?.role === 'hr'

  const { items, error, loading, reload } = useAsyncList<Department>(listDepartments)

  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  const [deactivating, setDeactivating] = useState<Department | null>(null)
  const [people, setPeople] = useState<PersonOption[]>([])

  // The head picker is only ever opened by Owner and HR, who are also
  // the only roles that can read the whole people list. Fetching it once
  // when the page loads keeps the dialog instant.
  useEffect(() => {
    if (!canManage) return
    let active = true
    void listPeopleOptions().then(({ data }) => {
      if (active && data) setPeople(data)
    })
    return () => {
      active = false
    }
  }, [canManage])

  const closeDialog = useCallback(
    (changed: boolean) => {
      setEditing(null)
      if (changed) void reload()
    },
    [reload],
  )

  return (
    <SetupPage
      title="Departments"
      description="The teams staff belong to. Departments are switched off rather than deleted, so past employment records keep their meaning."
      addLabel="Add department"
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
              ? 'No departments yet. Add the first one to get started.'
              : 'No departments have been added yet.'
          }
        />
      ) : (
        <DepartmentList
          departments={items ?? []}
          canManage={canManage}
          onEdit={setEditing}
          onDeactivate={setDeactivating}
          onReactivate={async (department) => {
            await setDepartmentActive(department.id, true)
            void reload()
          }}
        />
      )}

      {editing && (
        <DepartmentDialog
          department={editing === 'new' ? null : editing}
          people={people}
          tenantId={profile?.tenantId ?? ''}
          onClose={closeDialog}
        />
      )}

      {deactivating && (
        <ConfirmDeactivate
          title="Switch off this department?"
          body={`"${deactivating.name}" will stop appearing when someone is assigned a department. Existing employment records keep it, and you can switch it back on at any time.`}
          confirmLabel="Switch off"
          onCancel={() => setDeactivating(null)}
          onConfirm={async () => {
            const { error: writeError } = await setDepartmentActive(deactivating.id, false)
            setDeactivating(null)
            if (!writeError) void reload()
            return writeError ? describeWriteError(writeError, 'department') : null
          }}
        />
      )}
    </SetupPage>
  )
}

/**
 * The list.
 *
 * A table from `sm` up, and stacked cards below it. Rule 9 is mobile
 * first, and a four-column table on a 390px screen is either a
 * horizontal scroll nobody finds or a squeeze nobody can read.
 */
function DepartmentList({
  departments,
  canManage,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  departments: Department[]
  canManage: boolean
  onEdit: (department: Department) => void
  onDeactivate: (department: Department) => void
  onReactivate: (department: Department) => void
}) {
  return (
    <>
      {/* Phone: one card per department. */}
      <ul className="space-y-3 sm:hidden">
        {departments.map((department) => {
          const head = headLabel(department)
          return (
            <li
              key={department.id}
              className="rounded-card border border-line bg-surface p-gutter"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-ink">{department.name}</p>
                <StatusBadge isActive={department.isActive} />
              </div>

              <p className="mt-2 text-sm text-body">
                Head:{' '}
                <span className={head.muted ? 'text-quiet' : 'text-ink'}>{head.text}</span>
              </p>

              {canManage && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <RowActions
                    isActive={department.isActive}
                    onEdit={() => onEdit(department)}
                    onDeactivate={() => onDeactivate(department)}
                    onReactivate={() => onReactivate(department)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Tablet and up: the table. */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-ink">Name</TableHead>
              <TableHead className="text-ink">Head of department</TableHead>
              <TableHead className="text-ink">Status</TableHead>
              {canManage && <TableHead className="sr-only">Actions</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {departments.map((department) => {
              const head = headLabel(department)
              return (
                <TableRow key={department.id}>
                  <TableCell className="font-medium text-ink">{department.name}</TableCell>
                  <TableCell className={head.muted ? 'text-quiet' : 'text-body'}>
                    {head.text}
                  </TableCell>
                  <TableCell>
                    <StatusBadge isActive={department.isActive} />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <RowActions
                          isActive={department.isActive}
                          onEdit={() => onEdit(department)}
                          onDeactivate={() => onDeactivate(department)}
                          onReactivate={() => onReactivate(department)}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
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

/** Add and edit are the same form; only the title and the write differ. */
function DepartmentDialog({
  department,
  people,
  tenantId,
  onClose,
}: {
  department: Department | null
  people: PersonOption[]
  tenantId: string
  onClose: (changed: boolean) => void
}) {
  const [name, setName] = useState(department?.name ?? '')
  const [headId, setHeadId] = useState(department?.headPersonId ?? NO_HEAD)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (name.trim() === '') {
      setError('Give the department a name.')
      return
    }

    setSubmitting(true)
    setError(null)

    const headPersonId = headId === NO_HEAD ? null : headId

    const { error: writeError } = department
      ? await updateDepartment(department.id, { name, headPersonId })
      : await createDepartment({ tenantId, name, headPersonId })

    setSubmitting(false)

    if (writeError) {
      setError(describeWriteError(writeError, 'department'))
      return
    }

    onClose(true)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{department ? 'Edit department' : 'Add department'}</DialogTitle>
          <DialogDescription>
            Every change here is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <p role="alert" className="text-sm font-medium text-negative">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="department-name" className="text-ink">
              Name
            </Label>
            <Input
              id="department-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              autoFocus
              required
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department-head" className="text-ink">
              Head of department{' '}
              <span className="font-normal text-quiet">(optional)</span>
            </Label>

            <Select
              value={headId}
              onValueChange={setHeadId}
              disabled={submitting || people.length === 0}
            >
              <SelectTrigger id="department-head" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Rule 4: leaving this unset stores null, which reads
                    as "Not stated" — not as a guess at who is in charge. */}
                <SelectItem value={NO_HEAD}>{NOT_STATED}</SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {people.length === 0 && (
              <p className="text-sm text-quiet">
                No employee records exist yet, so there is nobody to name. You can add the
                head later.
              </p>
            )}
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
              {department ? 'Save changes' : 'Add department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
