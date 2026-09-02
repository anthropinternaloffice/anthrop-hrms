import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NOT_STATED, formatDate } from '@/lib/format'
import {
  MAX_UPLOAD_BYTES,
  formatBytes,
  getDownloadUrl,
  listDocuments,
  uploadDocument,
} from '@/lib/documents'
import type { EmployeeDocument } from '@/lib/types'

/**
 * The documents on an employee's record.
 *
 * Uploading is Owner and HR only. Reading follows the same policies as
 * everything else: Owner and HR see their tenant's, a member of staff
 * sees their own, and a Manager sees none — personnel files are not
 * something a department head is given sight of, which is a decision
 * migration 0001 made and this screen only reports.
 */
export function EmployeeDocuments({
  personId,
  tenantId,
  uploadedBy,
  canUpload,
  canRead,
}: {
  personId: string
  tenantId: string
  uploadedBy: string
  canUpload: boolean
  canRead: boolean
}) {
  const [documents, setDocuments] = useState<EmployeeDocument[] | null>(null)
  const [documentType, setDocumentType] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    if (!canRead) return
    const { data } = await listDocuments(personId)
    setDocuments(data ?? [])
  }, [personId, canRead])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]

    if (!file) {
      setError('Choose a file first.')
      return
    }

    setBusy('upload')
    setError(null)

    const { error: uploadError } = await uploadDocument({
      tenantId,
      personId,
      file,
      documentType,
      uploadedBy,
    })

    setBusy(null)

    if (uploadError) {
      setError(uploadError)
      return
    }

    if (fileInput.current) fileInput.current.value = ''
    setDocumentType('')
    void reload()
  }

  async function handleDownload(document_: EmployeeDocument) {
    setBusy(document_.id)
    setError(null)

    const { url, error: downloadError } = await getDownloadUrl(
      document_.id,
      document_.originalFilename,
    )

    setBusy(null)

    if (downloadError || !url) {
      setError(downloadError ?? 'That download link could not be created.')
      return
    }

    // A link click rather than window.open: popup blockers stop the
    // latter when it follows an await, and this has to work first time
    // on a phone.
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.rel = 'noreferrer noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  if (!canRead) {
    // Not "no documents". A Manager has no policy granting them
    // personnel files, and silence would read as an empty record.
    return (
      <div className="rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
        <p className="text-sm leading-relaxed text-body">
          Documents are not visible to managers. Ask HR if you need something from a
          colleague&rsquo;s file.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm font-medium text-negative">
          {error}
        </p>
      )}

      {documents === null ? (
        <p className="text-sm text-quiet" role="status">
          Loading…
        </p>
      ) : documents.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
          <p className="text-sm leading-relaxed text-body">
            No documents have been uploaded for this person yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-card border border-line bg-surface p-gutter sm:flex-row sm:items-center sm:justify-between sm:p-card"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink" title={item.originalFilename}>
                  {item.originalFilename}
                </p>
                <p className="mt-1 text-sm text-quiet">
                  {item.documentType ?? NOT_STATED}
                  {' · '}
                  {formatBytes(item.sizeBytes) ?? NOT_STATED}
                  {' · '}
                  uploaded {formatDate(item.uploadedAt.slice(0, 10))}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => void handleDownload(item)}
                disabled={busy !== null}
                className="h-11 shrink-0"
              >
                {busy === item.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form
          onSubmit={handleUpload}
          className="rounded-card border border-line bg-surface p-gutter sm:p-card"
        >
          <p className="font-medium text-ink">Upload a document</p>
          <p className="mt-1 text-sm text-quiet">
            Up to {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB. Stored privately and only
            ever served through a link that expires after a minute.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-file" className="text-ink">
                File
              </Label>
              <Input
                id="document-file"
                ref={fileInput}
                type="file"
                required
                className="h-11 py-2 text-base file:mr-3 file:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-type" className="text-ink">
                What is it? <span className="font-normal text-quiet">(optional)</span>
              </Label>
              <Input
                id="document-type"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                placeholder="Contract, ID, certificate…"
                className="h-11 text-base"
              />
            </div>
          </div>

          <Button type="submit" disabled={busy !== null} className="mt-4 h-11">
            {busy === 'upload' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            Upload
          </Button>
        </form>
      )}
    </div>
  )
}
