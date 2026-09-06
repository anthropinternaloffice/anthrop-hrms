import { useAuth } from '@/lib/auth'
import { DISPLAY_TIME_ZONE, formatDayWithWeekday } from '@/lib/format'

/**
 * The greeting at the top of the home screen — Extension brief, Task 6.
 *
 * ---------------------------------------------------------------------
 * WHAT THIS REPLACES, AND WHY IT IS NOT THAT
 * ---------------------------------------------------------------------
 *
 * The original request was an animated character matched to the user's
 * gender. It is not built, and the brief that replaced it gives two
 * reasons worth keeping next to the code.
 *
 * Gender is not in this database and is not being added. Collecting a
 * sensitive personal attribute so that a cartoon can match it is a weak
 * purpose under Nigeria's Data Protection Act, which expects a stated
 * reason for every field held — and it leaves no answer for anybody who
 * has not stated one. The absence is deliberate; nobody should later
 * read it as an oversight and helpfully add the column.
 *
 * And it is off-brand. The character was removed from the HRConnex
 * reference on purpose, because Anthrop advises government institutions
 * and corporate boards. Putting one back undoes that decision.
 *
 * What is here instead is a name, the time of day, and the date. The
 * status and the action live directly beneath, in the clock card.
 */

/**
 * Morning until noon, afternoon until five, evening after that — read in
 * Lagos, never from the device.
 *
 * The boundaries are stated here rather than being folded into a clever
 * expression, because they are a judgement about the Lagos working day
 * and somebody may reasonably want to move them. They are not a policy
 * about anything: no part of this system treats the working day as
 * having started or ended (D4).
 */
function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The hour of the day in Lagos, whatever the device believes. */
function lagosHour(now: Date): number {
  const text = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(now)

  const hour = Number(text)
  // A locale that hands back something unexpected should not produce
  // "Good NaN". Falling back to the neutral end of the day is duller
  // than being wrong.
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 12
}

export function Greeting() {
  const { profile } = useAuth()
  const now = new Date()

  const greeting = greetingFor(lagosHour(now))

  return (
    <div>
      {/*
        A fade with a small rise, once, and then it is finished. The
        utilities and the prefers-reduced-motion guard that clamps them
        to 1ms already exist in theme.css — somebody who has told their
        operating system to stop moving things has told this application
        too, and that is handled in CSS rather than by asking here and
        rendering two different trees.
      */}
      <h1 className="animate-in fade-in-0 slide-in-from-bottom-2 text-2xl font-semibold text-ink duration-700">
        {greeting}
        {/* No name when the account has no employee record behind it.
            A greeting that says "Good morning, there" is worse than one
            that just says good morning. */}
        {profile?.greetingName ? `, ${profile.greetingName}` : ''}
      </h1>

      <p className="mt-1 text-sm text-quiet">{formatDayWithWeekday(now.toISOString())}</p>
    </div>
  )
}
