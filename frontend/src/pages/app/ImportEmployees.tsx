import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { NOT_STATED } from '@/lib/format'
import { downloadBlob } from '@/lib/attendanceExport'
import {
  IMPORT_COLUMNS,
  buildImportTemplate,
  commitImport,
  loadImportContext,
  planImport,
} from '@/lib/employeeImport'
import type {
  ExistingEmployment,
  ExistingPerson,
  ImportOutcome,
  ImportPlan,
  NamedRecord,
  RowPlan,
} from '@/lib/employeeImport'

/**
 * Bulk employee import — Extension brief, Task 5.
 *
 * The screen is in three states and never skips one: choose a file,
 * read the preview, confirm. Nothing reaches the database before the
 * third, which is a structural fact rather than a promise — planning and
 * writing are separate functions in lib/employeeImport.ts and the plan
 * holds no database handles.
 */

interface Context {
  people: ExistingPerson[]
  employments: ExistingEmployment[]
  departments: NamedRecord[]
  jobTitles: NamedRecord[]
}

export function ImportEmployees() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [context, setContext] = useState<Context | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)

  const [filename, setFilename] = useState('')
  const [fileText, setFileText] = useState<string | null>(null)
  const [createMissing, setCreateMissing] = useState(false)
  const [decisions, setDecisions] = useState<Map<number, 'create' | 'skip'>>(new Map())

  const [committing, setCommitting] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)

  const canImport = profile?.role === 'owner' || profile?.role === 'hr'

  useEffect(() => {
    if (!canImport) return
    void loadImportContext().then((loaded) => {
      if (loaded.error) {
        setContextError(loaded.error)
        return
      }
      setContext(loaded)
    })
  }, [canImport])

  // Re-planned rather than patched whenever anything it depends on
  // changes. Turning "create the missing departments" on removes a
  // reason a row was a problem, and a plan that was edited in place
  // would drift from what a fresh read of the file would say.
  const plan: ImportPlan | null = useMemo(() => {
    if (fileText === null || context === null) return null
    return planImport(fileText, context, { createMissing })
  }, [fileText, context, createMissing])

  const handleFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setOutcome(null)
    setDecisions(new Map())
    setFilename(file.name)
    setFileText(await file.text())
  }, [])

  if (!canImport) {
    return (
      <Frame>
        <p className="text-sm leading-relaxed text-body">
          Importing employees is available to Owner and HR accounts. The database enforces
          this too — an import run from another account would write nothing.
        </p>
      </Frame>
    )
  }

  const counts = plan ? countRows(plan.rows, decisions) : null

  async function confirm() {
    if (!plan || !context || !profile || committing) return

    setCommitting(true)
    const result = await commitImport({
      tenantId: profile.tenantId,
      plan,
      duplicateDecisions: decisions,
      createMissing,
      filename,
      departments: context.departments,
      jobTitles: context.jobTitles,
    })
    setCommitting(false)
    setOutcome(result)
  }

  return (
    <Frame>
      <h1 className="text-2xl font-semibold text-ink">Import employees</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
        Add or update several people from a spreadsheet. You will see exactly what is going to
        happen before anything is saved.
      </p>

      {contextError && (
        <p role="alert" className="mt-6 text-sm font-medium text-negative">
          {contextError}
        </p>
      )}

      {outcome ? (
        <Result outcome={outcome} onDone={() => navigate('/app/employees')} />
      ) : (
        <>
          <Step number={1} title="Download the template">
            <p className="text-sm leading-relaxed text-body">
              Fifteen columns, of which <strong className="text-ink">First name</strong> and{' '}
              <strong className="text-ink">Last name</strong> are the only two required. The
              file has headings and no example row — an example row is a row somebody forgets
              to delete, and it would import as a person.
            </p>

            <div className="mt-4 overflow-x-auto">
              <p className="text-sm text-quiet">
                {IMPORT_COLUMNS.map((column) => column.header).join(' · ')}
              </p>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-body">
              Dates go in as <span className="tabular text-ink">yyyy-mm-dd</span> — 1990-09-04.
              Nothing else is accepted, because 04/09/1990 means two different days depending
              on who is reading it, and a date of birth wrong by five months is not something
              anybody notices.
            </p>

            {context && context.departments.length > 0 && (
              <p className="mt-4 text-sm leading-relaxed text-body">
                <span className="text-quiet">Departments already set up:</span>{' '}
                {context.departments.map((entry) => entry.name).join(', ')}
              </p>
            )}
            {context && context.jobTitles.length > 0 && (
              <p className="mt-2 text-sm leading-relaxed text-body">
                <span className="text-quiet">Job titles already set up:</span>{' '}
                {context.jobTitles.map((entry) => entry.name).join(', ')}
              </p>
            )}

            <Button
              variant="outline"
              className="mt-5 h-11"
              onClick={() =>
                downloadBlob(
                  new Blob([buildImportTemplate()], { type: 'text/csv;charset=utf-8' }),
                  'anthrop-employee-import-template.csv',
                )
              }
            >
              <Download className="size-4" aria-hidden="true" />
              Download template
            </Button>
          </Step>

          <Step number={2} title="Upload your filled-in file">
            <Label htmlFor="import-file" className="text-ink">
              CSV file
            </Label>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleFile(event)}
              className="mt-2 block w-full rounded-control border border-line bg-surface p-2.5 text-sm text-body file:mr-3 file:rounded-control file:border-0 file:bg-wash-strong file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
            {filename && (
              <p className="mt-2 text-sm text-quiet">
                Reading <span className="text-ink">{filename}</span>. Nothing has been saved.
              </p>
            )}
          </Step>

          {plan && (
            <Step number={3} title="Check what will happen">
              {plan.fatal ? (
                <p role="alert" className="text-sm font-medium text-negative">
                  {plan.fatal}
                </p>
              ) : (
                <>
                  {counts && <Summary counts={counts} />}

                  {plan.ignoredColumns.length > 0 && (
                    <p className="mt-4 text-sm text-quiet">
                      Columns in your file that this import does not use, and will leave alone:{' '}
                      {plan.ignoredColumns.join(', ')}.
                    </p>
                  )}

                  <MissingLabels
                    plan={plan}
                    createMissing={createMissing}
                    onChange={setCreateMissing}
                  />

                  <RowList plan={plan} decisions={decisions} onDecide={setDecisions} />

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="h-11"
                      onClick={() => void confirm()}
                      disabled={committing || (counts?.willWrite ?? 0) === 0}
                    >
                      {committing && (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      )}
                      <Upload className="size-4" aria-hidden="true" />
                      {counts && counts.willWrite > 0
                        ? `Import ${counts.willWrite} ${counts.willWrite === 1 ? 'record' : 'records'}`
                        : 'Nothing to import'}
                    </Button>

                    <Button asChild variant="outline" className="h-11">
                      <Link to="/app/employees">Cancel</Link>
                    </Button>
                  </div>
                </>
              )}
            </Step>
          )}
        </>
      )}
    </Frame>
  )
}

interface Counts {
  create: number
  update: number
  unchanged: number
  duplicate: number
  duplicateChosen: number
  problem: number
  willWrite: number
}

function countRows(rows: RowPlan[], decisions: Map<number, 'create' | 'skip'>): Counts {
  const counts: Counts = {
    create: 0,
    update: 0,
    unchanged: 0,
    duplicate: 0,
    duplicateChosen: 0,
    problem: 0,
    willWrite: 0,
  }

  for (const row of rows) {
    if (row.kind === 'create') counts.create += 1
    if (row.kind === 'update') counts.update += 1
    if (row.kind === 'unchanged') counts.unchanged += 1
    if (row.kind === 'problem') counts.problem += 1
    if (row.kind === 'duplicate') {
      counts.duplicate += 1
      if (decisions.get(row.line) === 'create') counts.duplicateChosen += 1
    }
  }

  counts.willWrite = counts.create + counts.update + counts.duplicateChosen
  return counts
}

function Summary({ counts }: { counts: Counts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Will be added" value={counts.create + counts.duplicateChosen} />
      <Tile label="Will be updated" value={counts.update} />
      <Tile label="Already match" value={counts.unchanged} />
      <Tile
        label="Need your attention"
        value={counts.problem + (counts.duplicate - counts.duplicateChosen)}
        warn={counts.problem + (counts.duplicate - counts.duplicateChosen) > 0}
      />
    </div>
  )
}

function Tile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-surface p-gutter">
      <p className={`text-2xl font-semibold ${warn && value > 0 ? 'text-negative' : 'text-ink'}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-quiet">{label}</p>
    </div>
  )
}

function MissingLabels({
  plan,
  createMissing,
  onChange,
}: {
  plan: ImportPlan
  createMissing: boolean
  onChange: (next: boolean) => void
}) {
  const total = plan.missingDepartments.length + plan.missingJobTitles.length
  if (total === 0) return null

  return (
    <div className="mt-6 rounded-card border border-line bg-wash-strong p-gutter sm:p-card">
      <p className="font-medium text-ink">
        {total === 1 ? 'One name in your file does not exist yet' : `${total} names in your file do not exist yet`}
      </p>

      {plan.missingDepartments.length > 0 && (
        <p className="mt-3 text-sm text-body">
          <span className="text-quiet">Departments:</span> {plan.missingDepartments.join(', ')}
        </p>
      )}
      {plan.missingJobTitles.length > 0 && (
        <p className="mt-2 text-sm text-body">
          <span className="text-quiet">Job titles:</span> {plan.missingJobTitles.join(', ')}
        </p>
      )}

      {/* The choice the brief asks for, put plainly. Nothing is created
          on a guess: a misspelling and a genuinely new department look
          identical from here, and only the person reading this knows
          which it is. */}
      <p className="mt-4 text-sm leading-relaxed text-body">
        These are either new, or spelled differently from what is already set up. Create them,
        or close this, correct the spelling in your file, and upload it again.
      </p>

      <label
        htmlFor="import-create-missing"
        className="mt-4 inline-flex cursor-pointer items-start gap-2.5 text-sm text-body"
      >
        <input
          id="import-create-missing"
          type="checkbox"
          checked={createMissing}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 cursor-pointer rounded-[3px] border-line accent-brand"
        />
        Create {total === 1 ? 'it' : 'them'} as part of this import
      </label>
    </div>
  )
}

function RowList({
  plan,
  decisions,
  onDecide,
}: {
  plan: ImportPlan
  decisions: Map<number, 'create' | 'skip'>
  onDecide: (next: Map<number, 'create' | 'skip'>) => void
}) {
  // Problems and duplicates first. They are the only rows that need a
  // person to do something, and burying them under fifty clean rows on a
  // phone is the same as not showing them.
  const order = { problem: 0, duplicate: 1, update: 2, create: 3, unchanged: 4 }
  const sorted = [...plan.rows].sort(
    (a, b) => order[a.kind] - order[b.kind] || a.line - b.line,
  )

  return (
    <ul className="mt-6 space-y-3">
      {sorted.map((row) => (
        <li key={row.line} className="rounded-card border border-line bg-surface p-gutter">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="font-medium text-ink">
              <span className="text-quiet">Line {row.line}</span> — {row.name}
            </p>
            <KindBadge kind={row.kind} />
          </div>

          {row.kind === 'problem' && (
            <ul className="mt-3 space-y-1">
              {row.reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm text-negative">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {reason}
                </li>
              ))}
            </ul>
          )}

          {row.kind === 'update' && (
            <dl className="mt-3 space-y-1 text-sm">
              {row.changes.map((change) => (
                <div key={change.column} className="flex flex-wrap gap-x-2">
                  <dt className="text-quiet">{change.label}</dt>
                  <dd className="text-body">
                    <span className="text-quiet line-through">{change.from ?? NOT_STATED}</span>{' '}
                    → <span className="text-ink">{change.to}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {row.kind === 'duplicate' && (
            <div className="mt-3">
              <ul className="space-y-1 text-sm text-body">
                {row.matches.map((match) => (
                  <li key={`${match.personId}-${match.name}`}>
                    Looks like <span className="text-ink">{match.name}</span> — {match.why}
                  </li>
                ))}
              </ul>

              {/* Skip is the default and stays the default until somebody
                  actively chooses otherwise. Two people can share a name;
                  nothing here knows that they do not. */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={decisions.get(row.line) === 'create' ? 'default' : 'outline'}
                  onClick={() => {
                    const next = new Map(decisions)
                    next.set(row.line, 'create')
                    onDecide(next)
                  }}
                >
                  Add as a new person
                </Button>
                <Button
                  size="sm"
                  variant={decisions.get(row.line) === 'create' ? 'outline' : 'default'}
                  onClick={() => {
                    const next = new Map(decisions)
                    next.set(row.line, 'skip')
                    onDecide(next)
                  }}
                >
                  Skip this row
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

const KIND_WORDS: Record<RowPlan['kind'], string> = {
  create: 'Will be added',
  update: 'Will be updated',
  unchanged: 'Already matches',
  duplicate: 'Possible duplicate',
  problem: 'Cannot import',
}

function KindBadge({ kind }: { kind: RowPlan['kind'] }) {
  const tone =
    kind === 'problem'
      ? 'bg-negative/10 text-negative'
      : kind === 'duplicate'
        ? 'bg-wash-strong text-ink'
        : kind === 'unchanged'
          ? 'bg-wash-strong text-quiet'
          : 'bg-positive/10 text-positive'

  return (
    <span className={`inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium ${tone}`}>
      {KIND_WORDS[kind]}
    </span>
  )
}

function Result({ outcome, onDone }: { outcome: ImportOutcome; onDone: () => void }) {
  return (
    <div className="mt-8 rounded-card border border-line bg-surface p-gutter sm:p-card">
      <h2 className="text-lg font-semibold text-ink">Import finished</h2>

      <dl className="mt-4 space-y-1 text-sm">
        <Line label="Added" value={outcome.created} />
        <Line label="Updated" value={outcome.updated} />
        <Line label="Already matched, left alone" value={outcome.unchanged} />
        <Line label="Skipped" value={outcome.skipped} />
        <Line label="Failed" value={outcome.failures.length} />
      </dl>

      {outcome.failures.length > 0 && (
        <div className="mt-5">
          <p className="font-medium text-negative">These rows were not saved</p>
          <ul className="mt-2 space-y-1 text-sm text-body">
            {outcome.failures.map((failure) => (
              <li key={failure.line}>
                Line {failure.line}, {failure.name}: {failure.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome.auditWarning && (
        <p className="mt-5 rounded-control bg-wash px-3 py-2 text-sm leading-relaxed text-body">
          {outcome.auditWarning}
        </p>
      )}

      <Button className="mt-6 h-11" onClick={onDone}>
        Back to employees
      </Button>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-2">
      <dt className="text-quiet">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">
        <span className="text-quiet">{number}.</span> {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Link
        to="/app/employees"
        className="inline-flex items-center gap-1.5 text-sm text-brand underline underline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Employees
      </Link>
      <div className="mt-4">{children}</div>
    </div>
  )
}
