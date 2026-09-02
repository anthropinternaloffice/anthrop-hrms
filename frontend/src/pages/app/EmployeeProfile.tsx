import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { NOT_STATED, formatDate, isMissing, personName } from '@/lib/format'
import { getEmployeeProfile } from '@/lib/employeeProfile'
import { EmployeeDocuments } from '@/components/EmployeeDocuments'
import type { EmployeeProfile, EmploymentDetail } from '@/lib/types'

/**
 * One employee's record. Reading only; the Edit button hands off to
 * EmployeeForm, which does all the writing.
 *
 * Everything absent reads "Not stated" (rule 4). Where a value is
 * absent because this viewer is not allowed to see it, the screen says
 * that instead: those are different sentences and collapsing them would
 * tell a Manager that a colleague has no emergency contact when in fact
 * they have one the Manager may not read (D10).
 */
export function EmployeeProfile() {
  const { personId } = useParams<{ personId: string }>()
  const { profile: viewer } = useAuth()

  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')

  const load = useCallback(async () => {
    if (!personId) return
    setState('loading')

    const { data, error, notFound } = await getEmployeeProfile(personId)

    if (notFound) {
      setState('missing')
      return
    }
    if (error || !data) {
      setState('failed')
      return
    }

    setProfile(data)
    setState('ready')
  }, [personId])

  useEffect(() => {
    void load()
  }, [load])

  if (state === 'loading') {
    return (
      <Frame>
        <p className="text-sm text-quiet" role="status">
          Loading…
        </p>
      </Frame>
    )
  }

  if (state === 'missing') {
    return (
      <Frame>
        <div className="rounded-card border border-line bg-surface p-gutter sm:p-card">
          <h1 className="text-xl font-semibold text-ink">That record is not available</h1>
          {/* Deliberately one message for "does not exist" and "not
              yours to see". Distinguishing them would confirm the
              existence of staff outside the viewer's department. */}
          <p className="mt-3 text-sm leading-relaxed text-body">
            It may have been removed, or it may belong to someone outside the records you can
            see.
          </p>
          <Button asChild variant="outline" className="mt-6 h-11">
            <Link to="/app/employees">Back to employees</Link>
          </Button>
        </div>
      </Frame>
    )
  }

  if (state === 'failed' || !profile) {
    return (
      <Frame>
        <p role="alert" className="text-sm font-medium text-negative">
          That record could not be loaded. Check your connection and try again.
        </p>
      </Frame>
    )
  }

  const { person, employments, emergencyContacts } = profile
  const canEdit = viewer?.role === 'owner' || viewer?.role === 'hr'
  /**
   * Emergency contacts and documents share one rule: Owner, HR, or the
   * person themselves. A Manager is excluded from both — migration 0001
   * grants them neither, and a department head is not given sight of
   * personnel files.
   */
  const canSeeEmergencyContacts =
    viewer?.role === 'owner' || viewer?.role === 'hr' || viewer?.personId === person.id

  return (
    <Frame>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
        <h1 className="text-2xl font-semibold text-ink">
          {personName({
            firstName: person.firstName,
            lastName: person.lastName,
            preferredName: person.preferredName,
          })}
        </h1>
        {/* The legal name is shown when it differs from what we call
            them, rather than quietly replaced by the preferred one. */}
        {!isMissing(person.preferredName) && (
          <p className="mt-1 text-sm text-quiet">
            Full name on record: {[person.firstName, person.middleName, person.lastName]
              .filter((part) => !isMissing(part))
              .join(' ')}
          </p>
        )}
        </div>

        {canEdit && (
          <Button asChild variant="outline" className="h-11 w-full shrink-0 sm:w-auto">
            <Link to={`/app/employees/${person.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Link>
          </Button>
        )}
      </header>

      <Section title="Personal details">
        <Fields>
          <Field label="First name" value={person.firstName} />
          <Field label="Middle name" value={person.middleName} />
          <Field label="Last name" value={person.lastName} />
          <Field label="Preferred name" value={person.preferredName} />
          <Field label="Email" value={person.email} href={person.email ? `mailto:${person.email}` : undefined} />
          <Field label="Phone" value={person.phone} href={person.phone ? `tel:${person.phone}` : undefined} />
          <Field label="Date of birth" value={person.dateOfBirth} format={formatDate} />
          <Field label="Address" value={formatAddress(person)} />
        </Fields>
      </Section>

      <Section title="Employment history">
        {employments.length === 0 ? (
          <Empty>No employment has been recorded for this person yet.</Empty>
        ) : (
          <ul className="space-y-4">
            {employments.map((employment) => (
              <li
                key={employment.id}
                className="rounded-card border border-line bg-surface p-gutter sm:p-card"
              >
                <EmploymentEntry employment={employment} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        <EmployeeDocuments
          personId={person.id}
          tenantId={viewer?.tenantId ?? ''}
          uploadedBy={viewer?.id ?? ''}
          canUpload={canEdit}
          canRead={canSeeEmergencyContacts}
        />
      </Section>

      <Section title="Emergency contacts">
        {!canSeeEmergencyContacts ? (
          // Not "none recorded". A Manager has no policy granting them
          // this, so silence here would be a false statement about a
          // colleague's record.
          <Empty>
            Emergency contacts are not visible to managers. Ask HR if you need them for
            someone in your team.
          </Empty>
        ) : emergencyContacts.length === 0 ? (
          <Empty>No emergency contact has been recorded for this person yet.</Empty>
        ) : (
          <ul className="space-y-4">
            {emergencyContacts.map((contact) => (
              <li
                key={contact.id}
                className="rounded-card border border-line bg-surface p-gutter sm:p-card"
              >
                <p className="font-medium text-ink">{contact.name}</p>
                <Fields className="mt-3">
                  <Field label="Relationship" value={contact.relationship} />
                  <Field
                    label="Phone"
                    value={contact.phone}
                    href={contact.phone ? `tel:${contact.phone}` : undefined}
                  />
                </Fields>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Frame>
  )
}

function EmploymentEntry({ employment }: { employment: EmploymentDetail }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={employment.jobTitle ? 'font-medium text-ink' : 'font-medium text-quiet'}>
          {employment.jobTitle ?? NOT_STATED}
        </p>
        {employment.status === 'active' ? (
          <span className="inline-flex items-center rounded-control bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-control bg-wash-strong px-2 py-0.5 text-xs font-medium text-quiet">
            Ended
          </span>
        )}
      </div>

      <Fields className="mt-3">
        <Field label="Department" value={employment.departmentName} />
        <Field label="Manager" value={managerLabel(employment)} />
        <Field label="Start date" value={employment.startDate} format={formatDate} />
        <Field label="End date" value={employment.endDate} format={formatDate} />
      </Fields>
    </>
  )
}

/**
 * D10 again: a manager who exists but cannot be read is not the same as
 * no manager. The employment row carries the id either way, so the two
 * can be told apart.
 */
function managerLabel(employment: EmploymentDetail): string | null {
  if (employment.managerEmploymentId === null) return null
  return employment.managerName ?? 'Not visible to you'
}

function formatAddress(person: {
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
}): string | null {
  const parts = [
    person.addressLine1,
    person.addressLine2,
    person.city,
    person.state,
    person.country,
  ].filter((part) => !isMissing(part))

  return parts.length === 0 ? null : parts.join(', ')
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-8">
      <Link
        to="/app/employees"
        className="inline-flex items-center gap-2 rounded-control text-sm font-medium text-body hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to employees
      </Link>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
      <p className="text-sm leading-relaxed text-body">{children}</p>
    </div>
  )
}

/**
 * Field grid. One column on a phone, two from sm.
 *
 * A definition list rather than a table: this is a set of labelled
 * values about one person, not rows of comparable records, and a screen
 * reader announces dl/dt/dd as the pairs they are.
 */
function Fields({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 ${className}`}>{children}</dl>
  )
}

function Field({
  label,
  value,
  href,
  format,
}: {
  label: string
  value: string | null | undefined
  href?: string
  format?: (value: string | null | undefined) => string
}) {
  const missing = isMissing(value)
  const shown = format ? format(value) : missing ? NOT_STATED : (value as string)

  return (
    <div>
      <dt className="text-sm text-quiet">{label}</dt>
      <dd className={`mt-0.5 text-sm ${missing ? 'text-quiet' : 'text-ink'}`}>
        {missing || !href ? (
          shown
        ) : (
          <a href={href} className="text-brand underline underline-offset-4">
            {shown}
          </a>
        )}
      </dd>
    </div>
  )
}
