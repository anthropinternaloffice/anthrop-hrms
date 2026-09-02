import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { NOT_STATED } from '@/lib/format'
import { normalisePhone } from '@/lib/phone'
import { listDepartments, listJobTitles } from '@/lib/setup'
import { getEmployeeProfile } from '@/lib/employeeProfile'
import { createEmployee, updateEmployee } from '@/lib/employeeWrite'
import type { Department, EmploymentStatus, JobTitle } from '@/lib/types'

/** Radix Select cannot hold an empty string. */
const NONE = 'none'

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  preferredName: string
  email: string
  phone: string
  dateOfBirth: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
  jobTitleId: string
  departmentId: string
  startDate: string
  endDate: string
  status: EmploymentStatus
  contactName: string
  contactRelationship: string
  contactPhone: string
}

const EMPTY: FormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  preferredName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  jobTitleId: NONE,
  departmentId: NONE,
  startDate: '',
  endDate: '',
  status: 'active',
  contactName: '',
  contactRelationship: '',
  contactPhone: '',
}

/**
 * Add and edit an employee. One form for both — the fields are
 * identical, and two copies would drift.
 *
 * Phone numbers are normalised here, before anything is sent, so that
 * 08031234567 and +234 803 123 4567 cannot become two records for one
 * person. A number that cannot be placed is refused with a message
 * rather than guessed at; see lib/phone.ts.
 *
 * The normalised name tokens the brief asks for are not computed here.
 * `people.name_tokens` is GENERATED ALWAYS in the database, so they are
 * produced on every write no matter what performs it.
 */
export function EmployeeForm({ mode }: { mode: 'create' | 'edit' }) {
  const { personId } = useParams<{ personId: string }>()
  const { profile: viewer } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [departments, setDepartments] = useState<Department[]>([])
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
  const [employmentId, setEmploymentId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = viewer?.role === 'owner' || viewer?.role === 'hr'

  useEffect(() => {
    let active = true

    async function load() {
      const [departmentResult, jobTitleResult] = await Promise.all([
        listDepartments(),
        listJobTitles(),
      ])
      if (!active) return

      setDepartments(departmentResult.data ?? [])
      setJobTitles(jobTitleResult.data ?? [])

      if (mode === 'edit' && personId) {
        const { data } = await getEmployeeProfile(personId)
        if (!active) return

        if (data) {
          const employment = data.employments[0] ?? null
          const contact = data.emergencyContacts[0] ?? null

          setEmploymentId(employment?.id ?? null)
          setContactId(contact?.id ?? null)
          setForm({
            firstName: data.person.firstName,
            middleName: data.person.middleName ?? '',
            lastName: data.person.lastName,
            preferredName: data.person.preferredName ?? '',
            email: data.person.email ?? '',
            phone: data.person.phone ?? '',
            dateOfBirth: data.person.dateOfBirth ?? '',
            addressLine1: data.person.addressLine1 ?? '',
            addressLine2: data.person.addressLine2 ?? '',
            city: data.person.city ?? '',
            state: data.person.state ?? '',
            country: data.person.country ?? '',
            // The profile carries names, not ids, so the ids are matched
            // back by name against the lists just loaded.
            jobTitleId:
              jobTitleResult.data?.find((t) => t.title === employment?.jobTitle)?.id ?? NONE,
            departmentId:
              departmentResult.data?.find((d) => d.name === employment?.departmentName)?.id ?? NONE,
            startDate: employment?.startDate ?? '',
            endDate: employment?.endDate ?? '',
            status: employment?.status ?? 'active',
            contactName: contact?.name ?? '',
            contactRelationship: contact?.relationship ?? '',
            contactPhone: contact?.phone ?? '',
          })
        }
      }

      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [mode, personId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (form.firstName.trim() === '' || form.lastName.trim() === '') {
      setError('A first name and a last name are needed.')
      return
    }

    // Both numbers are normalised before anything is sent. A number that
    // cannot be placed stops the save rather than reaching the database
    // as a constraint violation nobody can read.
    const phone = normalisePhone(form.phone)
    if (phone.error) {
      setError(`Phone number: ${phone.error}`)
      return
    }

    const contactPhone = normalisePhone(form.contactPhone)
    if (contactPhone.error) {
      setError(`Emergency contact phone: ${contactPhone.error}`)
      return
    }

    if (form.contactName.trim() === '' && (contactPhone.value || form.contactRelationship.trim())) {
      setError('An emergency contact needs a name.')
      return
    }

    setSubmitting(true)
    setError(null)

    const person = {
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      preferredName: form.preferredName,
      email: form.email,
      phone: phone.value,
      dateOfBirth: form.dateOfBirth,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      state: form.state,
      country: form.country,
    }

    const employment = {
      jobTitleId: form.jobTitleId === NONE ? null : form.jobTitleId,
      departmentId: form.departmentId === NONE ? null : form.departmentId,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
    }

    const emergencyContact = {
      name: form.contactName,
      relationship: form.contactRelationship,
      phone: contactPhone.value,
    }

    const result =
      mode === 'create'
        ? await createEmployee({
            tenantId: viewer?.tenantId ?? '',
            person,
            employment,
            emergencyContact,
          })
        : await updateEmployee({
            tenantId: viewer?.tenantId ?? '',
            personId: personId ?? '',
            person,
            employment,
            employmentId,
            emergencyContact,
            emergencyContactId: contactId,
          })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      // A partial save still moved the record forward. Sending them to
      // the profile lets them see what landed instead of guessing.
      if (result.partial && result.personId) {
        setTimeout(() => navigate(`/app/employees/${result.personId}`), 2500)
      }
      return
    }

    navigate(`/app/employees/${result.personId}`)
  }

  if (!canManage) {
    return (
      <Frame>
        <div className="rounded-card border border-line bg-surface p-gutter sm:p-card">
          <h1 className="text-xl font-semibold text-ink">Not available to you</h1>
          <p className="mt-3 text-sm leading-relaxed text-body">
            Only an Owner or HR can add and edit employee records.
          </p>
        </div>
      </Frame>
    )
  }

  if (loading) {
    return (
      <Frame>
        <p className="text-sm text-quiet" role="status">
          Loading…
        </p>
      </Frame>
    )
  }

  // A job title or department that has since been switched off stays in
  // the list when this person is the one still assigned to it, so that
  // saving the form cannot quietly clear it.
  const jobTitleOptions = jobTitles.filter((t) => t.isActive || t.id === form.jobTitleId)
  const departmentOptions = departments.filter((d) => d.isActive || d.id === form.departmentId)

  return (
    <Frame>
      <h1 className="text-2xl font-semibold text-ink">
        {mode === 'create' ? 'Add employee' : 'Edit employee'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-body">
        Only a first and last name are required. Anything you leave empty is recorded as
        nothing at all, and shows as &ldquo;{NOT_STATED}&rdquo; — never as a guess.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-10">
        {error && (
          <Alert
            variant="destructive"
            role="alert"
            className="border-negative/30 bg-negative/5 text-negative"
          >
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription className="text-negative">{error}</AlertDescription>
          </Alert>
        )}

        <Fieldset legend="Personal details">
          <TextField id="firstName" label="First name" required value={form.firstName} onChange={(v) => set('firstName', v)} />
          <TextField id="middleName" label="Middle name" value={form.middleName} onChange={(v) => set('middleName', v)} />
          <TextField id="lastName" label="Last name" required value={form.lastName} onChange={(v) => set('lastName', v)} />
          <TextField
            id="preferredName"
            label="Preferred name"
            hint="What this person is actually called at work, if it differs."
            value={form.preferredName}
            onChange={(v) => set('preferredName', v)}
          />
          <TextField id="email" label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} />
          <TextField
            id="phone"
            label="Phone"
            type="tel"
            hint="08031234567 is fine — it is stored as +2348031234567."
            value={form.phone}
            onChange={(v) => set('phone', v)}
          />
          <TextField id="dateOfBirth" label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
        </Fieldset>

        <Fieldset legend="Address">
          <TextField id="addressLine1" label="Address line 1" value={form.addressLine1} onChange={(v) => set('addressLine1', v)} />
          <TextField id="addressLine2" label="Address line 2" value={form.addressLine2} onChange={(v) => set('addressLine2', v)} />
          <TextField id="city" label="City" value={form.city} onChange={(v) => set('city', v)} />
          <TextField id="state" label="State" value={form.state} onChange={(v) => set('state', v)} />
          <TextField id="country" label="Country" value={form.country} onChange={(v) => set('country', v)} />
        </Fieldset>

        <Fieldset legend="Employment">
          <PickerField
            id="jobTitleId"
            label="Job title"
            value={form.jobTitleId}
            onChange={(v) => set('jobTitleId', v)}
            options={jobTitleOptions.map((t) => ({ id: t.id, label: t.title }))}
            emptyHint="No job titles have been added yet."
          />
          <PickerField
            id="departmentId"
            label="Department"
            value={form.departmentId}
            onChange={(v) => set('departmentId', v)}
            options={departmentOptions.map((d) => ({ id: d.id, label: d.name }))}
            emptyHint="No departments have been added yet."
          />
          <TextField id="startDate" label="Start date" type="date" value={form.startDate} onChange={(v) => set('startDate', v)} />
          <TextField id="endDate" label="End date" type="date" value={form.endDate} onChange={(v) => set('endDate', v)} />

          <div className="space-y-2">
            <Label htmlFor="status" className="text-ink">
              Status
            </Label>
            <Select value={form.status} onValueChange={(v) => set('status', v as EmploymentStatus)}>
              <SelectTrigger id="status" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Fieldset>

        <Fieldset
          legend="Emergency contact"
          description="Optional, but the one field somebody will need in a hurry."
        >
          <TextField id="contactName" label="Name" value={form.contactName} onChange={(v) => set('contactName', v)} />
          <TextField id="contactRelationship" label="Relationship" value={form.contactRelationship} onChange={(v) => set('contactRelationship', v)} />
          <TextField id="contactPhone" label="Phone" type="tel" value={form.contactPhone} onChange={(v) => set('contactPhone', v)} />
        </Fieldset>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={submitting} className="h-11 text-base sm:w-auto sm:px-6">
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {mode === 'create' ? 'Add employee' : 'Save changes'}
          </Button>
          <Button asChild variant="outline" className="h-11 text-base sm:w-auto sm:px-6">
            <Link to={mode === 'edit' && personId ? `/app/employees/${personId}` : '/app/employees'}>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div>
      <Link
        to="/app/employees"
        className="mb-6 inline-flex items-center gap-2 rounded-control text-sm font-medium text-body hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to employees
      </Link>
      {children}
    </div>
  )
}

function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="rounded-card border border-line bg-surface p-gutter sm:p-card">
      <legend className="px-1 text-lg font-semibold text-ink">{legend}</legend>
      {description && <p className="mt-1 text-sm text-body">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-ink">
        {label}
        {!required && <span className="ml-1 font-normal text-quiet">(optional)</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // 44px and 16px text: this is filled in on a phone far more
        // often than at a desk, and anything under 16px makes iOS zoom.
        className="h-11 text-base"
      />
      {hint && <p className="text-sm text-quiet">{hint}</p>}
    </div>
  )
}

function PickerField({
  id,
  label,
  value,
  onChange,
  options,
  emptyHint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; label: string }>
  emptyHint: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-ink">
        {label} <span className="font-normal text-quiet">(optional)</span>
      </Label>
      <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger id={id} className="h-11 w-full text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* Leaving this unset stores null, which reads as "Not stated"
              rather than as a guess. */}
          <SelectItem value={NONE}>{NOT_STATED}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {options.length === 0 && <p className="text-sm text-quiet">{emptyHint}</p>}
    </div>
  )
}
