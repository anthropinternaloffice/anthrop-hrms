import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { formatDayLong, formatTime, roleLabel } from '@/lib/format'
import { listActors, listAuditLog, tableLabel } from '@/lib/auditLog'
import type { AppRole, AuditActor, AuditEntry } from '@/lib/types'

/** Radix Select cannot hold an empty string. */
const EVERYONE = 'everyone'

/**
 * The audit log. Owner only.
 *
 * `audit_log_select_owner` is the only select policy on the table, so an
 * HR user asking for this page receives nothing at all. Rather than
 * showing them an empty list that looks like a working screen with no
 * activity, this says plainly that the log is not theirs to read.
 *
 * Nothing here can be edited, and nothing can be deleted. There is no
 * insert grant for anyone and no delete path anywhere in the
 * application: the log is append-only, written by triggers, and that is
 * the whole point of it.
 */
export function AuditLog() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [actors, setActors] = useState<AuditActor[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [actorId, setActorId] = useState(EVERYONE)
  const [fromDay, setFromDay] = useState('')
  const [toDay, setToDay] = useState('')

  const filters = useMemo(
    () => ({ actorId: actorId === EVERYONE ? null : actorId, fromDay, toDay }),
    [actorId, fromDay, toDay],
  )

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      const { data, hasMore: more, error: failed } = await listAuditLog(filters, pageToLoad)

      if (failed) {
        setError('The audit log could not be loaded.')
        return
      }

      setError(null)
      setHasMore(more)
      setEntries((current) => (append && current ? [...current, ...(data ?? [])] : (data ?? [])))
    },
    [filters],
  )

  useEffect(() => {
    if (!isOwner) return
    setPage(0)
    void load(0, false)
  }, [isOwner, load])

  useEffect(() => {
    if (!isOwner) return
    void listActors().then(({ data }) => setActors(data ?? []))
  }, [isOwner])

  if (!isOwner) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-ink">Audit log</h1>
        <div className="mt-6 rounded-card border border-line bg-surface p-gutter sm:p-card">
          <p className="text-sm leading-relaxed text-body">
            The audit log is readable by the Owner only. That is enforced by the database, not
            by this screen — even HR cannot read it.
          </p>
        </div>
      </div>
    )
  }

  const filtering = actorId !== EVERYONE || fromDay !== '' || toDay !== ''

  return (
    <div>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink">Audit log</h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Every create, change, deletion and document download, written by the database itself.
          Nothing here can be edited or removed, including by you. Times are Lagos time.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="audit-actor" className="text-ink">
            Who
          </Label>
          <Select value={actorId} onValueChange={setActorId}>
            <SelectTrigger id="audit-actor" className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EVERYONE}>Everyone</SelectItem>
              {actors.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name ?? `Unlinked account (${roleLabel(actor.role as AppRole)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-from" className="text-ink">
            From
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={fromDay}
            onChange={(event) => setFromDay(event.target.value)}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-to" className="text-ink">
            To
          </Label>
          <Input
            id="audit-to"
            type="date"
            value={toDay}
            onChange={(event) => setToDay(event.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      {filtering && (
        <Button
          variant="ghost"
          onClick={() => {
            setActorId(EVERYONE)
            setFromDay('')
            setToDay('')
          }}
          className="mt-3 h-10 px-3 text-sm"
        >
          Clear filters
        </Button>
      )}

      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-negative">
          {error}
        </p>
      )}

      <div className="mt-6">
        {entries === null ? (
          <p className="text-sm text-quiet" role="status">
            Loading…
          </p>
        ) : entries.length === 0 ? (
          <Empty>
            {filtering
              ? 'Nothing matches those filters.'
              : 'Nothing has been recorded yet.'}
          </Empty>
        ) : (
          <>
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-card border border-line bg-surface p-gutter sm:p-card"
                >
                  <Entry entry={entry} actors={actors} />
                </li>
              ))}
            </ul>

            {hasMore && (
              <Button
                variant="outline"
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  void load(next, true)
                }}
                className="mt-4 h-11 w-full sm:w-auto"
              >
                Show older entries
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const ACTION_WORDS: Record<AuditEntry['action'], string> = {
  insert: 'Created',
  update: 'Changed',
  delete: 'Deleted',
  download: 'Downloaded',
}

function Entry({ entry, actors }: { entry: AuditEntry; actors: AuditActor[] }) {
  const actor = actors.find((candidate) => candidate.id === entry.actorUserId)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-ink">
          {ACTION_WORDS[entry.action]} {tableLabel(entry.tableName).toLowerCase()}
          {entry.subject && <span className="text-ink">: {entry.subject}</span>}
        </p>
        <p className="tabular text-sm text-quiet">
          {formatDayLong(entry.occurredAt)} at {formatTime(entry.occurredAt)}
        </p>
      </div>

      <p className="mt-1 text-sm text-body">
        {/* A null actor is the database acting with nobody signed in —
            the bootstrap script, for instance. Saying so is more honest
            than attributing it to a person. */}
        {entry.actorUserId === null
          ? 'By the database, with nobody signed in'
          : `By ${actor?.name ?? 'an account with no employee record'}`}
      </p>

      {entry.changed.length > 0 && (
        <p className="mt-2 text-sm text-quiet">
          Fields changed: {entry.changed.map(humaniseField).join(', ')}
        </p>
      )}

      {entry.correctionReason && (
        <p className="mt-2 rounded-control bg-wash px-3 py-2 text-sm leading-relaxed text-body">
          <span className="font-medium text-ink">Reason given:</span> {entry.correctionReason}
        </p>
      )}
    </>
  )
}

/** `clock_in_at` reads badly in a sentence; "clock in at" reads fine. */
function humaniseField(field: string): string {
  return field.replace(/_/g, ' ')
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
      <p className="text-sm leading-relaxed text-body">{children}</p>
    </div>
  )
}
