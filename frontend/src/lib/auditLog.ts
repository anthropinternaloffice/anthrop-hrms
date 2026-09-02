import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { personName } from '@/lib/format'
import type { AuditAction, AuditEntry, AuditActor } from '@/lib/types'

/**
 * The audit log.
 *
 * Readable by the Owner and nobody else — `audit_log_select_owner` is
 * the only select policy on the table, and there is no insert grant for
 * anyone. Every row here was written by a database trigger, or by
 * public.log_document_download() for reads that no trigger can catch.
 *
 * The label for each entry comes out of the row's own `before`/`after`
 * snapshot rather than from a fresh lookup. That is deliberate: it shows
 * what a thing was called *at the time it happened*, it still works for
 * records that have since been deleted, and it cannot quietly rewrite
 * history when something is renamed.
 */

export interface AuditFilters {
  /** A profile/auth user id, or null for everyone. */
  actorId: string | null
  /** YYYY-MM-DD in Lagos, inclusive, or empty. */
  fromDay: string
  toDay: string
}

const PAGE_SIZE = 50

/** Nigeria is UTC+1 all year and has never observed daylight saving. */
function lagosDayStart(day: string): string {
  return new Date(`${day}T00:00:00+01:00`).toISOString()
}
function lagosDayEnd(day: string): string {
  return new Date(`${day}T23:59:59.999+01:00`).toISOString()
}

/** Fields that are noise in a summary of what changed. */
const UNINTERESTING = new Set(['updated_at', 'created_at', 'name_tokens'])

function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return []
  return Object.keys(after)
    .filter((key) => !UNINTERESTING.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}

/**
 * What the affected record was called.
 *
 * Every table gets its own answer because there is no common "name"
 * column, and a bare UUID tells a reader nothing. Where a table has no
 * natural label — an employment, an attendance record — it says so
 * rather than inventing one.
 */
function describeSubject(
  table: string,
  snapshot: Record<string, unknown> | null,
): string | null {
  if (!snapshot) return null
  const text = (key: string) => {
    const value = snapshot[key]
    return typeof value === 'string' && value.trim() !== '' ? value : null
  }

  switch (table) {
    case 'people':
      return [text('first_name'), text('last_name')].filter(Boolean).join(' ') || null
    case 'departments':
    case 'tenants':
    case 'emergency_contacts':
      return text('name')
    case 'job_titles':
      return text('title')
    case 'documents':
      return text('original_filename')
    default:
      return null
  }
}

const TABLE_LABELS: Record<string, string> = {
  people: 'Employee',
  departments: 'Department',
  job_titles: 'Job title',
  employments: 'Employment',
  documents: 'Document',
  emergency_contacts: 'Emergency contact',
  attendance_records: 'Attendance record',
  profiles: 'User account',
  tenants: 'Organisation',
}

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table
}

export async function listAuditLog(
  filters: AuditFilters,
  page: number,
): Promise<{ data: AuditEntry[] | null; hasMore: boolean; error: PostgrestError | null }> {
  let query = supabase
    .from('audit_log')
    .select('id, occurred_at, actor_user_id, action, table_name, record_id, before, after')
    .order('occurred_at', { ascending: false })
    // One extra row is fetched purely to find out whether there is
    // another page, without a second count query.
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (filters.actorId) query = query.eq('actor_user_id', filters.actorId)
  if (filters.fromDay) query = query.gte('occurred_at', lagosDayStart(filters.fromDay))
  if (filters.toDay) query = query.lte('occurred_at', lagosDayEnd(filters.toDay))

  const { data, error } = await query
  if (error) return { data: null, hasMore: false, error }

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE

  const entries: AuditEntry[] = rows.slice(0, PAGE_SIZE).map((row) => {
    const before = row.before as Record<string, unknown> | null
    const after = row.after as Record<string, unknown> | null

    return {
      id: String(row.id),
      occurredAt: row.occurred_at as string,
      actorUserId: (row.actor_user_id as string | null) ?? null,
      action: row.action as AuditAction,
      tableName: row.table_name as string,
      recordId: (row.record_id as string | null) ?? null,
      subject: describeSubject(row.table_name as string, after ?? before),
      changed: changedFields(before, after),
      // Surfaced on its own because the brief requires a correction's
      // reason to be visible, and this is where it is discoverable
      // after the fact.
      correctionReason:
        typeof after?.correction_reason === 'string' ? (after.correction_reason as string) : null,
    }
  })

  return { data: entries, hasMore, error: null }
}

/**
 * Everyone who could appear in the "who" column.
 *
 * Built from profiles rather than from the log itself, so the filter
 * lists people by name and stays stable even when someone has not done
 * anything yet.
 */
export async function listActors(): Promise<{
  data: AuditActor[] | null
  error: PostgrestError | null
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, person:people(first_name, last_name, preferred_name)')

  if (error) return { data: null, error }

  interface Row {
    id: string
    role: string
    person: { first_name: string; last_name: string; preferred_name: string | null } | null
  }

  return {
    data: (data as unknown as Row[]).map((row) => ({
      id: row.id,
      name: row.person
        ? personName({
            firstName: row.person.first_name,
            lastName: row.person.last_name,
            preferredName: row.person.preferred_name,
          })
        : null,
      role: row.role,
    })),
    error: null,
  }
}
