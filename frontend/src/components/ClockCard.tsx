import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { formatDuration, formatTime, formatDayWithWeekday } from '@/lib/format'
import { clockIn, clockOut, getMyEmployment, getOpenRecord } from '@/lib/attendance'
import type { ClockableEmployment } from '@/lib/attendance'
import type { AttendanceRecord } from '@/lib/types'

/**
 * The clock-in / clock-out control.
 *
 * This is the screen the team uses most, every morning, and the brief
 * says it must work with one thumb. So it is one large button, the
 * current state is readable without interpretation, and nothing else
 * competes with it.
 *
 * It shows no total for the week, no lateness, no target. Every one of
 * those is a policy Anthrop has not set (D4), and a number on this card
 * would look like a judgement the system is not entitled to make.
 */
export function ClockCard() {
  const { profile } = useAuth()

  const [employment, setEmployment] = useState<ClockableEmployment | null>(null)
  const [open, setOpen] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Ticks so an open session's elapsed time stays honest without a reload. */
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: found } = await getMyEmployment(profile?.personId ?? null)
    setEmployment(found)

    if (found) {
      const { data: record } = await getOpenRecord(found.employmentId)
      setOpen(record)
    } else {
      setOpen(null)
    }

    setLoading(false)
  }, [profile?.personId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [open])

  async function handleClockIn() {
    if (!employment || working) return
    setWorking(true)
    setError(null)
    const { error: failed } = await clockIn(employment)
    setWorking(false)
    if (failed) {
      setError(failed)
      return
    }
    void load()
  }

  async function handleClockOut() {
    if (!open || working) return
    setWorking(true)
    setError(null)
    const { error: failed } = await clockOut(open.id)
    setWorking(false)
    if (failed) {
      setError(failed)
      return
    }
    void load()
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-quiet" role="status">
          Loading…
        </p>
      </Card>
    )
  }

  // A login with no employee record behind it. Real, and not an error:
  // an administrator can hold an account before anyone has created their
  // person row. Saying so beats a button that always fails.
  if (!employment) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink">Clocking is not set up for you yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Your sign-in is not linked to an employee record with an active job, so there is
          nothing to clock against. Ask HR to add your employee record and link it to this
          account.
        </p>
      </Card>
    )
  }

  const clockedIn = open !== null

  return (
    <Card>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-quiet">{formatDayWithWeekday(new Date().toISOString())}</p>

          <h2 className="mt-1 text-lg font-semibold text-ink">
            {clockedIn ? 'You are clocked in' : 'You are not clocked in'}
          </h2>

          {clockedIn && open && (
            <p className="mt-2 text-sm text-body">
              Since{' '}
              <span className="tabular font-medium text-ink">{formatTime(open.clockInAt)}</span>
              {' — '}
              {formatDuration(open.clockInAt, new Date().toISOString())} so far
            </p>
          )}

          {!clockedIn && (
            <p className="mt-2 text-sm text-body">Clock in when you start work.</p>
          )}
        </div>

        {/* One target, large enough for a thumb, and the only thing on
            the card that can be pressed. */}
        <Button
          onClick={clockedIn ? handleClockOut : handleClockIn}
          disabled={working}
          className={
            clockedIn
              ? 'h-14 w-full shrink-0 bg-negative px-8 text-base hover:bg-negative/90 sm:w-auto'
              : 'h-14 w-full shrink-0 px-8 text-base sm:w-auto'
          }
        >
          {clockedIn ? (
            <LogOut className="size-5" aria-hidden="true" />
          ) : (
            <LogIn className="size-5" aria-hidden="true" />
          )}
          {working ? 'Saving…' : clockedIn ? 'Clock out' : 'Clock in'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-negative">
          {error}
        </p>
      )}

      <p className="mt-6 border-t border-line pt-4 text-sm text-quiet">
        Times are recorded by the server in Lagos time, not by your phone.{' '}
        <Link to="/app/attendance" className="text-brand underline underline-offset-4">
          See my attendance
        </Link>
      </p>
    </Card>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-gutter sm:p-card">{children}</div>
  )
}
