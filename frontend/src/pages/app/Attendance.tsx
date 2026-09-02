import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import {
  NOT_STATED,
  formatDayLong,
  formatDuration,
  formatTime,
  lagosDayKey,
} from '@/lib/format'
import {
  getMyEmployment,
  listMyAttendance,
  listWhoIsInToday,
} from '@/lib/attendance'
import { CorrectionDialog } from '@/components/CorrectionDialog'
import type { AttendanceRecord, WhoIsInRow } from '@/lib/types'

/**
 * Attendance: my own history, and who is in today.
 *
 * Nothing on this page judges anything. There is no late, no short, no
 * target — only what happened and when. Anthrop has not set an
 * attendance policy (D4), and a screen that shaded a row red would be
 * announcing a rule nobody agreed.
 */
export function Attendance() {
  const { profile } = useAuth()

  const [mine, setMine] = useState<AttendanceRecord[] | null>(null)
  const [today, setToday] = useState<WhoIsInRow[] | null>(null)
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null)

  const canSeeOthers = profile?.role !== 'staff'
  const canCorrect = profile?.role === 'owner' || profile?.role === 'hr'

  const load = useCallback(async () => {
    const { data: employment } = await getMyEmployment(profile?.personId ?? null)

    if (employment) {
      const { data } = await listMyAttendance(employment.employmentId)
      setMine(data ?? [])
    } else {
      setMine([])
    }

    if (canSeeOthers) {
      const { data } = await listWhoIsInToday(startOfTodayInLagos())
      setToday(data ?? [])
    }
  }, [profile?.personId, canSeeOthers])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-10">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-ink">Attendance</h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Every time here was recorded by the database server and is shown in Lagos time. No
          time is ever taken from a phone or a laptop.
        </p>
      </div>

      {canSeeOthers && (
        <Section
          title="Who is in today"
          description={
            profile?.role === 'manager'
              ? 'Your department only.'
              : 'Everyone who has clocked in today.'
          }
        >
          {today === null ? (
            <Loading />
          ) : today.length === 0 ? (
            <Empty>Nobody has clocked in today yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {today.map((row) => (
                <li
                  key={row.record.id}
                  className="rounded-card border border-line bg-surface p-gutter sm:p-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">
                        {/* Null means the viewer may not read that person,
                            which is a different thing from no name (D10). */}
                        {row.personName ?? 'Not visible to you'}
                      </p>
                      <p className="mt-1 text-sm text-quiet">
                        {row.departmentName ?? NOT_STATED}
                      </p>
                    </div>
                    <PresenceBadge record={row.record} />
                  </div>

                  <TimeLine record={row.record} />

                  {canCorrect && (
                    <Button
                      variant="outline"
                      onClick={() => setCorrecting(row.record)}
                      className="mt-4 h-11"
                    >
                      Correct this record
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="My attendance" description="Most recent first.">
        {mine === null ? (
          <Loading />
        ) : mine.length === 0 ? (
          <Empty>
            You have no attendance records yet. Clock in from the home screen and it will
            appear here.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {mine.map((record) => (
              <li
                key={record.id}
                className="rounded-card border border-line bg-surface p-gutter sm:p-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium text-ink">{formatDayLong(record.clockInAt)}</p>
                  <PresenceBadge record={record} />
                </div>
                <TimeLine record={record} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {correcting && (
        <CorrectionDialog
          record={correcting}
          onClose={(changed) => {
            setCorrecting(null)
            if (changed) void load()
          }}
        />
      )}
    </div>
  )
}

/** Midnight in Lagos, today, as an instant the database can compare against. */
function startOfTodayInLagos(): string {
  const dayKey = lagosDayKey(new Date().toISOString())
  // Lagos is UTC+1 all year: Nigeria has never observed daylight saving.
  return new Date(`${dayKey}T00:00:00+01:00`).toISOString()
}

function PresenceBadge({ record }: { record: AttendanceRecord }) {
  return record.clockOutAt === null ? (
    <span className="inline-flex items-center rounded-control bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
      Still in
    </span>
  ) : (
    <span className="inline-flex items-center rounded-control bg-wash-strong px-2 py-0.5 text-xs font-medium text-quiet">
      Clocked out
    </span>
  )
}

/**
 * The times on one record, and — when it has been corrected — what it
 * said before.
 *
 * The brief requires the original to stay visible beside the
 * correction. It is struck through rather than removed, so a reader can
 * see both the change and the fact that a change happened, along with
 * the reason someone gave for it.
 */
function TimeLine({ record }: { record: AttendanceRecord }) {
  const corrected = record.correctedAt !== null

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span>
          <span className="text-quiet">In </span>
          <span className="tabular font-medium text-ink">{formatTime(record.clockInAt)}</span>
          {record.originalClockInAt && record.originalClockInAt !== record.clockInAt && (
            <span className="ml-2 tabular text-quiet line-through">
              {formatTime(record.originalClockInAt)}
            </span>
          )}
        </span>

        <span>
          <span className="text-quiet">Out </span>
          <span className="tabular font-medium text-ink">
            {record.clockOutAt ? formatTime(record.clockOutAt) : NOT_STATED}
          </span>
          {record.originalClockOutAt && record.originalClockOutAt !== record.clockOutAt && (
            <span className="ml-2 tabular text-quiet line-through">
              {formatTime(record.originalClockOutAt)}
            </span>
          )}
        </span>

        {record.clockOutAt && (
          <span className="text-body">
            {formatDuration(record.clockInAt, record.clockOutAt)}
          </span>
        )}
      </div>

      {corrected && (
        <p className="rounded-control bg-wash px-3 py-2 text-sm leading-relaxed text-body">
          <span className="font-medium text-ink">Corrected.</span> {record.correctionReason}
        </p>
      )}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-body">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Loading() {
  return (
    <p className="text-sm text-quiet" role="status">
      Loading…
    </p>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
      <p className="text-sm leading-relaxed text-body">{children}</p>
    </div>
  )
}
