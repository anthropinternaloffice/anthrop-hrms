/**
 * Shapes returned by the database, in the application's own terms.
 *
 * The database speaks snake_case; everything above this file speaks
 * camelCase. The mapping happens once, in the functions that do the
 * querying, so a column rename is one edit rather than a search.
 */

/** public.app_role. The four roles, in descending order of reach. */
export type AppRole = 'owner' | 'hr' | 'manager' | 'staff'

/**
 * A login, and the person it belongs to.
 *
 * `personId` is null for an account not yet linked to an employee
 * record. That is a real state — an administrator can be given a login
 * before their employee record exists — and it is why "Staff sees only
 * themselves" has to be able to resolve to nothing at all.
 */
export interface Profile {
  id: string
  tenantId: string
  personId: string | null
  role: AppRole
  isActive: boolean
}

export interface Department {
  id: string
  name: string
  /** Null when no head has been recorded. Displayed as "Not stated". */
  headPersonId: string | null
  /** Resolved from the join, null when there is no head or it is unreadable. */
  headName: string | null
  isActive: boolean
}

export interface JobTitle {
  id: string
  title: string
  /** Null when no level has been recorded. Displayed as "Not stated". */
  level: string | null
  isActive: boolean
}

/** Just enough of a person to put them in a picker. */
export interface PersonOption {
  id: string
  name: string
}

/** public.employment_status. */
export type EmploymentStatus = 'active' | 'ended'

/**
 * One line of the employee list: a person, plus the employment that
 * describes what they currently do here.
 *
 * Every employment field is nullable because every one of them can
 * genuinely be unknown. A person can exist with no employment recorded
 * yet — the two are separate tables on purpose (D2) — and an employment
 * can exist with no department or job title attached. Rule 4: each of
 * those reads as "Not stated" rather than being guessed at or hidden.
 */
export interface EmployeeRow {
  personId: string
  name: string
  /** Sorted on, so it is kept separately from the display name. */
  lastName: string
  /**
   * Every form of the name, lower-cased, for the search box.
   *
   * The list shows the preferred name, but somebody looking for Abiodun
   * should still find her when the row reads "Bola Adeyemi". Searching
   * only what is displayed would hide people behind their own nickname.
   */
  searchText: string
  jobTitle: string | null
  departmentId: string | null
  departmentName: string | null
  status: EmploymentStatus | null
}

/** Everything on the `people` row, as the profile shows it. */
export interface PersonDetail {
  id: string
  firstName: string
  middleName: string | null
  lastName: string
  preferredName: string | null
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
}

/** One job this person has held. */
export interface EmploymentDetail {
  id: string
  jobTitle: string | null
  departmentName: string | null
  status: EmploymentStatus
  startDate: string | null
  endDate: string | null
  /** Null when no manager is recorded. */
  managerEmploymentId: string | null
  /**
   * The manager's name, or null. Null with a non-null
   * managerEmploymentId means a manager exists but this viewer cannot
   * read them — a different sentence from "no manager" (D10).
   */
  managerName: string | null
}

export interface EmergencyContact {
  id: string
  name: string
  relationship: string | null
  phone: string | null
}

export interface EmployeeProfile {
  person: PersonDetail
  employments: EmploymentDetail[]
  emergencyContacts: EmergencyContact[]
}

/** A file attached to an employee. Metadata only — the file lives in Storage. */
export interface EmployeeDocument {
  id: string
  originalFilename: string
  mimeType: string | null
  sizeBytes: number | null
  documentType: string | null
  uploadedAt: string
}

/** public.attendance_source. There is no 'device' value, by design (rule 8). */
export type AttendanceSource = 'self_service' | 'hr_correction'

/**
 * One clock-in, and the clock-out that closed it if it has been closed.
 *
 * The `original*` fields are only ever populated by a correction, and
 * they are what makes "the original value stays visible beside the
 * correction" possible.
 */
export interface AttendanceRecord {
  id: string
  clockInAt: string
  clockInSource: AttendanceSource
  clockOutAt: string | null
  clockOutSource: AttendanceSource | null
  correctedAt: string | null
  correctionReason: string | null
  originalClockInAt: string | null
  originalClockOutAt: string | null
}

/** A row of "who is in today". */
export interface WhoIsInRow {
  record: AttendanceRecord
  employmentId: string
  /** Null when the viewer may not read that person (D10). */
  personName: string | null
  departmentName: string | null
}

/** public.audit_action. 'download' exists because a read leaves no trigger behind. */
export type AuditAction = 'insert' | 'update' | 'delete' | 'download'

/** One line of the audit log, already made readable. */
export interface AuditEntry {
  id: string
  occurredAt: string
  /** Null when the database itself acted, with nobody signed in. */
  actorUserId: string | null
  action: AuditAction
  tableName: string
  recordId: string | null
  /** What the record was called at the time, where the table has a name at all. */
  subject: string | null
  /** Which columns an update touched. Empty for inserts, deletes and downloads. */
  changed: string[]
  correctionReason: string | null
}

/** Somebody who can appear in the "who" column. */
export interface AuditActor {
  id: string
  /** Null when the account is not linked to a person record. */
  name: string | null
  role: string
}
