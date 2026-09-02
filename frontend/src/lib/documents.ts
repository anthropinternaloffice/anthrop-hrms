import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toNullable } from '@/lib/format'
import type { EmployeeDocument } from '@/lib/types'

/**
 * Employee documents.
 *
 * The bucket is private (migration 0002). Nothing here is reachable by
 * URL alone; a file is served only through a signed link that expires,
 * and every download is recorded first.
 */

const BUCKET = 'employee-documents'

/**
 * How long a download link lives.
 *
 * Sixty seconds is enough to start a download and not enough to be
 * pasted into a chat and still work later. The link is minted the moment
 * someone asks for the file, so there is no reason for it to outlive the
 * click that created it.
 */
const SIGNED_URL_SECONDS = 60

/** 10 MB. Bigger than any contract or certificate, small enough to upload on Nigerian mobile data. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * The stored filename is random and the original is never part of the
 * path.
 *
 * Two reasons. A filename like "Adeyemi_disciplinary_letter.pdf" leaks
 * personal information to anyone who sees a URL, a log line or a storage
 * listing. And a path built from user input is a path someone can shape
 * — with traversal, with a collision, with characters the bucket handles
 * badly. Only the extension survives, sanitised, so the file still opens
 * in the right application.
 */
function randomObjectPath(tenantId: string, personId: string, originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.')
  const rawExtension = dot === -1 ? '' : originalFilename.slice(dot + 1)
  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)

  const id = crypto.randomUUID()
  return `${tenantId}/${personId}/${id}${extension ? `.${extension}` : ''}`
}

export async function listDocuments(
  personId: string,
): Promise<{ data: EmployeeDocument[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, original_filename, mime_type, size_bytes, document_type, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      originalFilename: row.original_filename as string,
      mimeType: (row.mime_type as string | null) ?? null,
      sizeBytes: (row.size_bytes as number | null) ?? null,
      documentType: (row.document_type as string | null) ?? null,
      uploadedAt: row.created_at as string,
    })),
    error: null,
  }
}

/**
 * Upload, then record.
 *
 * That order matters: the storage write policy cannot consult the
 * `documents` table, because the row does not exist yet. If the row
 * fails to insert, the uploaded object is removed again — an orphaned
 * file that no record accounts for is exactly the thing an audit would
 * ask about.
 */
export async function uploadDocument(input: {
  tenantId: string
  personId: string
  file: File
  documentType: string
  uploadedBy: string
}): Promise<{ error: string | null }> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That file is larger than 10 MB. Please upload a smaller copy.' }
  }
  if (input.file.size === 0) {
    return { error: 'That file is empty.' }
  }

  const path = randomObjectPath(input.tenantId, input.personId, input.file.name)

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.file, {
    contentType: input.file.type || 'application/octet-stream',
    // Never overwrite. The path is a fresh UUID, so a collision would
    // mean something is badly wrong and should fail loudly.
    upsert: false,
  })

  if (uploadError) {
    return { error: 'That file could not be uploaded. Check your connection and try again.' }
  }

  const { error: rowError } = await supabase.from('documents').insert({
    tenant_id: input.tenantId,
    person_id: input.personId,
    storage_path: path,
    original_filename: input.file.name,
    mime_type: toNullable(input.file.type),
    size_bytes: input.file.size,
    document_type: toNullable(input.documentType),
    uploaded_by: input.uploadedBy,
  })

  if (rowError) {
    // Put the bucket back how we found it.
    await supabase.storage.from(BUCKET).remove([path])
    return {
      error: 'The file was uploaded but could not be recorded, so it has been removed. Try again.',
    }
  }

  return { error: null }
}

/**
 * A link to one document, logged on the way.
 *
 * The RPC is what writes the audit line, and it returns the storage path
 * so that asking where the file is and recording that you asked are the
 * same call. `authenticated` cannot insert into audit_log directly, so
 * this is the only route by which a download becomes a log entry.
 *
 * See migration 0002 for the limit: without a server, signing and
 * logging cannot be one atomic step.
 */
export async function getDownloadUrl(
  documentId: string,
  originalFilename: string,
): Promise<{ url: string | null; error: string | null }> {
  const { data: path, error: logError } = await supabase.rpc('log_document_download', {
    p_document_id: documentId,
  })

  if (logError || typeof path !== 'string') {
    return { url: null, error: 'That document is not available.' }
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    // `download` hands the file back under the name it was uploaded
    // with. The stored object stays a meaningless UUID; only the person
    // who is allowed to have it ever sees the real name.
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: originalFilename })

  if (error || !data?.signedUrl) {
    return { url: null, error: 'That download link could not be created. Try again.' }
  }

  return { url: data.signedUrl, error: null }
}

/** File size for humans. */
export function formatBytes(bytes: number | null): string | null {
  if (bytes === null) return null
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
