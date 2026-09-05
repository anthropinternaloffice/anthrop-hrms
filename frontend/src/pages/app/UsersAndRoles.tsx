import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Check, Copy, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListEmpty, ListLoading, SetupPage } from '@/components/setup/SetupPage'
import { ConfirmDeactivate } from '@/components/setup/ConfirmDeactivate'
import { useAuth } from '@/lib/auth'
import { useAsyncList } from '@/lib/useAsyncList'
import { formatDayLong, formatTime, roleLabel } from '@/lib/format'
import {
  changeUserRole,
  describeUserError,
  inviteUser,
  listManagedDepartments,
  listPeopleWithoutAccounts,
  listUserAccounts,
  setUserActive,
} from '@/lib/users'
import type { AppRole, ManagedDepartment, PersonOption, UserAccount } from '@/lib/types'

/**
 * Users and roles.
 *
 * Until this screen existed, giving somebody an Anthrop HR account meant
 * opening the Supabase dashboard — so in practice only the person who
 * built the system could do it. That is the gap this closes.
 *
 * Two things it does not do, both on purpose.
 *
 * It does not enforce anything. Every rule below has a counterpart in
 * migration 0004 that is the one actually stopping the write, and the
 * interface's job is to say what will happen rather than to be the
 * reason it does. Where the two could drift, the database wins.
 *
 * It does not delete. An account is switched off. The audit log names
 * this profile as the actor on every row it wrote, and a system that
 * can erase a user erases the record of what they did.
 */

const ROLE_ORDER: AppRole[] = ['owner', 'hr', 'manager', 'staff']

/** Radix Select cannot hold an empty string, so absence needs a name. */
const NO_PERSON = 'none'

/**
 * What each role reaches. Shown at the point of assignment, because
 * "Manager" is not self-explanatory and the consequence of getting it
 * wrong is somebody reading records they should not.
 */
const ROLE_SUMMARY: Record<AppRole, string> = {
  owner: 'Everything, including the audit log and the ability to change roles.',
  hr: 'Everything except the audit log and role assignment.',
  manager: 'Only the employees and attendance of their own department.',
  staff: 'Only their own record and their own attendance.',
}

export function UsersAndRoles() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const canInvite = isOwner || profile?.role === 'hr'

  const { items, error, loading, reload } = useAsyncList<UserAccount>(listUserAccounts)

  const [inviting, setInviting] = useState(false)
  const [changingRole, setChangingRole] = useState<UserAccount | null>(null)
  const [switchingOff, setSwitchingOff] = useState<UserAccount | null>(null)

  const closeAndReload = useCallback(
    (changed: boolean) => {
      setInviting(false)
      setChangingRole(null)
      if (changed) void reload()
    },
    [reload],
  )

  return (
    <SetupPage
      title="Users and roles"
      description="Who can sign in to Anthrop HR, and what each of them can see. An account is switched off rather than deleted, because the audit log records what every account has done and that record has to keep meaning something."
      addLabel="Invite user"
      canManage={canInvite}
      onAdd={() => setInviting(true)}
      error={error}
    >
      {/* The brief asks for the Owner-only rule to be surfaced rather
          than restated in code. It is one sentence, and it is shown to
          the people it constrains rather than only to the people it
          exempts. */}
      {!isOwner && canInvite && (
        <p className="mb-6 flex items-start gap-2.5 rounded-card border border-line bg-surface p-gutter text-sm leading-relaxed text-body">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-quiet" aria-hidden="true" />
          <span>
            You can invite colleagues as Staff and switch accounts off. Setting or changing a
            role is reserved to an Owner — the database refuses it, so it is not something
            this screen can offer you.
          </span>
        </p>
      )}

      {loading && items === null ? (
        <ListLoading />
      ) : items && items.length === 0 ? (
        <ListEmpty message="No accounts yet." />
      ) : (
        <UserList
          users={items ?? []}
          currentUserId={profile?.id ?? ''}
          isOwner={isOwner}
          canInvite={canInvite}
          onChangeRole={setChangingRole}
          onSwitchOff={setSwitchingOff}
          onSwitchOn={async (user) => {
            await setUserActive(user.id, true)
            void reload()
          }}
        />
      )}

      {inviting && (
        <InviteDialog
          isOwner={isOwner}
          onClose={closeAndReload}
        />
      )}

      {changingRole && (
        <ChangeRoleDialog user={changingRole} onClose={closeAndReload} />
      )}

      {switchingOff && (
        <ConfirmDeactivate
          title="Switch off this account?"
          body={`${describeUser(switchingOff)} will lose access immediately — every screen and every record, from the moment you confirm. Nothing they have done is removed, and you can switch the account back on at any time.`}
          confirmLabel="Switch off"
          onCancel={() => setSwitchingOff(null)}
          onConfirm={async () => {
            const { error: writeError } = await setUserActive(switchingOff.id, false)
            setSwitchingOff(null)
            if (!writeError) void reload()
            return writeError ? describeUserError(writeError) : null
          }}
        />
      )}
    </SetupPage>
  )
}

/** How an account is named in a sentence. */
function describeUser(user: UserAccount): string {
  return user.personName ?? user.email ?? 'This account'
}

/**
 * The three states an account can be in, kept apart because they mean
 * different things to whoever is looking.
 *
 * "Invited" is the one worth having. An administrator who sends an
 * invitation and then sees "Active" has no way to tell whether it
 * arrived; this says plainly that it has not been taken up yet.
 */
function accountStatus(user: UserAccount): { label: string; className: string } {
  if (!user.isActive) {
    return { label: 'Switched off', className: 'bg-wash-strong text-quiet' }
  }
  if (user.lastSignInAt === null) {
    return { label: 'Invited', className: 'bg-wash-strong text-body' }
  }
  return { label: 'Active', className: 'bg-positive/10 text-positive' }
}

function StatusPill({ user }: { user: UserAccount }) {
  const status = accountStatus(user)
  return (
    <span
      className={`inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium ${status.className}`}
    >
      {status.label}
    </span>
  )
}

/** "2 September 2026, 08:32", or the reason there is no date. */
function lastSignIn(user: UserAccount): string {
  if (user.lastSignInAt === null) {
    return user.isActive ? 'Not yet' : 'Never'
  }
  return `${formatDayLong(user.lastSignInAt)}, ${formatTime(user.lastSignInAt)}`
}

function UserList({
  users,
  currentUserId,
  isOwner,
  canInvite,
  onChangeRole,
  onSwitchOff,
  onSwitchOn,
}: {
  users: UserAccount[]
  currentUserId: string
  isOwner: boolean
  canInvite: boolean
  onChangeRole: (user: UserAccount) => void
  onSwitchOff: (user: UserAccount) => void
  onSwitchOn: (user: UserAccount) => void
}) {
  return (
    <>
      {/* Phone: one card per account. Five columns do not survive 390px. */}
      <ul className="space-y-3 sm:hidden">
        {users.map((user) => (
          <li key={user.id} className="rounded-card border border-line bg-surface p-gutter">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {user.personName ?? <span className="text-quiet">No employee record</span>}
                </p>
                <p className="mt-0.5 truncate text-sm text-body">{user.email ?? '—'}</p>
              </div>
              <StatusPill user={user} />
            </div>

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-quiet">Role:</dt>
                <dd className="font-medium text-ink">{roleLabel(user.role)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-quiet">Last signed in:</dt>
                <dd className="text-body">{lastSignIn(user)}</dd>
              </div>
            </dl>

            <RowActions
              user={user}
              isSelf={user.id === currentUserId}
              isOwner={isOwner}
              canInvite={canInvite}
              onChangeRole={onChangeRole}
              onSwitchOff={onSwitchOff}
              onSwitchOn={onSwitchOn}
              className="mt-4 flex flex-wrap gap-2"
            />
          </li>
        ))}
      </ul>

      {/* Tablet and up: the table. */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-ink">Name</TableHead>
              <TableHead className="text-ink">Email</TableHead>
              <TableHead className="text-ink">Role</TableHead>
              <TableHead className="text-ink">Status</TableHead>
              <TableHead className="text-ink">Last signed in</TableHead>
              {canInvite && <TableHead className="sr-only">Actions</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-ink">
                  {user.personName ?? <span className="text-quiet">No employee record</span>}
                </TableCell>
                <TableCell className="text-body">{user.email ?? '—'}</TableCell>
                <TableCell className="text-body">{roleLabel(user.role)}</TableCell>
                <TableCell>
                  <StatusPill user={user} />
                </TableCell>
                <TableCell className="text-body">{lastSignIn(user)}</TableCell>
                {canInvite && (
                  <TableCell className="text-right">
                    <RowActions
                      user={user}
                      isSelf={user.id === currentUserId}
                      isOwner={isOwner}
                      canInvite={canInvite}
                      onChangeRole={onChangeRole}
                      onSwitchOff={onSwitchOff}
                      onSwitchOn={onSwitchOn}
                      className="flex justify-end gap-2"
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

/**
 * What can be done to one account.
 *
 * Your own row gets no controls at all, and says so. An Owner cannot
 * remove their own Owner role — the database refuses it — and switching
 * your own account off is a thing with no use and one very bad outcome.
 * Neither is hidden: the row says why it is empty, because a blank space
 * reads as a missing feature.
 */
function RowActions({
  user,
  isSelf,
  isOwner,
  canInvite,
  onChangeRole,
  onSwitchOff,
  onSwitchOn,
  className,
}: {
  user: UserAccount
  isSelf: boolean
  isOwner: boolean
  canInvite: boolean
  onChangeRole: (user: UserAccount) => void
  onSwitchOff: (user: UserAccount) => void
  onSwitchOn: (user: UserAccount) => void
  className: string
}) {
  if (!canInvite) return null

  if (isSelf) {
    return (
      <div className={className}>
        <span className="text-xs text-quiet">This is you</span>
      </div>
    )
  }

  return (
    <div className={className}>
      {isOwner && (
        <Button variant="outline" size="sm" onClick={() => onChangeRole(user)} className="h-10">
          Change role
        </Button>
      )}
      {user.isActive ? (
        <Button variant="outline" size="sm" onClick={() => onSwitchOff(user)} className="h-10">
          Switch off
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => onSwitchOn(user)} className="h-10">
          Switch on
        </Button>
      )}
    </div>
  )
}

/**
 * What the Manager role would actually resolve to for this person.
 *
 * A Manager's departments are worked out, not stored: the department of
 * their own active employment, plus any department they are recorded as
 * the head of. Somebody with neither gets an account that signs in
 * perfectly and shows an empty screen — which reads as a broken system
 * rather than as a missing department.
 *
 * So the answer is fetched and shown before the role is given, and the
 * empty case is a warning rather than silence.
 */
function ManagerReach({ personId }: { personId: string | null }) {
  const [departments, setDepartments] = useState<ManagedDepartment[] | null>(null)

  useEffect(() => {
    if (personId === null) {
      setDepartments([])
      return
    }
    let active = true
    setDepartments(null)
    void listManagedDepartments(personId).then(({ data }) => {
      if (active) setDepartments(data ?? [])
    })
    return () => {
      active = false
    }
  }, [personId])

  if (departments === null) {
    return <p className="text-sm text-quiet">Checking which departments they would manage…</p>
  }

  if (departments.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-control border border-negative/30 bg-negative/5 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden="true" />
        <div className="text-sm leading-relaxed text-body">
          <p className="font-medium text-negative">
            This Manager would not be able to see anybody.
          </p>
          <p className="mt-1">
            {personId === null
              ? 'A Manager sees the department of their own employment. Without an employee record there is no department to resolve, so they would sign in to an empty screen.'
              : 'A Manager sees the department of their own active employment, plus any department they are recorded as the head of. This person has neither.'}
          </p>
          <p className="mt-1">
            You can still go ahead. To fix it, give them an active employment in a department,
            or set them as a department&rsquo;s head on the Departments screen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <p className="rounded-control border border-line bg-wash p-3 text-sm leading-relaxed text-body">
      As a Manager they would see{' '}
      <span className="font-medium text-ink">
        {departments.map((department) => department.name).join(', ')}
      </span>{' '}
      — resolved from their own employment and any department they head, not stored on the
      account. It changes if their employment does.
    </p>
  )
}

/** The role picker, plus the one-line description of what it grants. */
function RolePicker({
  value,
  onChange,
  isOwner,
  disabled,
  id,
}: {
  value: AppRole
  onChange: (role: AppRole) => void
  isOwner: boolean
  disabled: boolean
  id: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-ink">
        Role
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next as AppRole)} disabled={disabled}>
        <SelectTrigger id={id} className="h-11 w-full text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_ORDER.map((role) => (
            // Everything above Staff is an Owner's to give. Shown and
            // disabled rather than absent, so an HR user can see that
            // the other roles exist and that this is a rule rather than
            // an oversight.
            <SelectItem key={role} value={role} disabled={!isOwner && role !== 'staff'}>
              {roleLabel(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-quiet">{ROLE_SUMMARY[value]}</p>
    </div>
  )
}

function InviteDialog({
  isOwner,
  onClose,
}: {
  isOwner: boolean
  onClose: (changed: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('staff')
  const [personId, setPersonId] = useState(NO_PERSON)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<{ email: string; actionLink: string | null } | null>(null)

  useEffect(() => {
    let active = true
    void listPeopleWithoutAccounts().then(({ data }) => {
      if (active && data) setPeople(data)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (email.trim() === '') {
      setError('Enter the email address to send the invitation to.')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await inviteUser({
      email: email.trim(),
      role,
      personId: personId === NO_PERSON ? null : personId,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSentTo({ email: email.trim(), actionLink: result.actionLink })
  }

  // The account exists either way. What changes is whether we managed to
  // tell them about it.
  if (sentTo) {
    return (
      <Dialog open onOpenChange={() => onClose(true)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {sentTo.actionLink === null ? 'Invitation sent' : 'Account created'}
            </DialogTitle>
            <DialogDescription>
              {sentTo.actionLink === null
                ? `${sentTo.email} will get an email with a link to choose their own password. Until they do, their account shows as Invited.`
                : 'The account was created, but the invitation email could not be sent.'}
            </DialogDescription>
          </DialogHeader>

          {sentTo.actionLink !== null && <ActionLink link={sentTo.actionLink} />}

          <DialogFooter>
            <Button onClick={() => onClose(true)} className="h-11 text-base">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They receive an email, choose their own password, and sign in. Nobody here ever
            sees it. Every invitation is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <p role="alert" className="text-sm font-medium text-negative">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-ink">
              Email address
            </Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              autoFocus
              required
              className="h-11 text-base"
            />
          </div>

          <RolePicker
            id="invite-role"
            value={role}
            onChange={setRole}
            isOwner={isOwner}
            disabled={submitting}
          />

          <div className="space-y-2">
            <Label htmlFor="invite-person" className="text-ink">
              Employee record <span className="font-normal text-quiet">(optional)</span>
            </Label>
            <Select value={personId} onValueChange={setPersonId} disabled={submitting}>
              <SelectTrigger id="invite-person" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PERSON}>Not linked yet</SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-quiet">
              A login and an employee record are separate things. Linking them is what lets
              this person clock in and see their own attendance — without it the account works
              but has no history of its own. Only employees without an account are listed.
            </p>
          </div>

          {role === 'manager' && (
            <ManagerReach personId={personId === NO_PERSON ? null : personId} />
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
              className="h-11 text-base"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-11 text-base">
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The link, when the email could not carry it.
 *
 * A Supabase project on the free plan sends a few emails an hour through
 * a shared service that is explicitly not meant for production, so this
 * will happen until Anthrop configures their own SMTP. The account was
 * created regardless; refusing to show the link would mean an account
 * nobody can reach and no way to tell.
 *
 * It is the same single-use, expiring link the email would have carried,
 * shown once to the administrator who just asked for it.
 */
function ActionLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-body">
        Send them this link yourself. It can be used once, it expires, and it takes them
        straight to choosing their own password.
      </p>

      <div className="flex gap-2">
        <Input
          readOnly
          value={link}
          aria-label="Invitation link"
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied(true)
            } catch {
              // Clipboard access can be refused, and there is nothing to
              // do about it: the field beside this button holds the text
              // and selects itself when tapped.
            }
          }}
        >
          {copied ? (
            <Check className="size-4 text-positive" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">Copy link</span>
        </Button>
      </div>

      <p className="text-sm text-quiet">
        Invitation emails need an email service configured on the Supabase project. Until that
        is done, links have to be passed on by hand.
      </p>
    </div>
  )
}

/** Owner only. app.guard_role_assignment() is what makes that true. */
function ChangeRoleDialog({
  user,
  onClose,
}: {
  user: UserAccount
  onClose: (changed: boolean) => void
}) {
  const [role, setRole] = useState<AppRole>(user.role)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || role === user.role) return

    setSubmitting(true)
    setError(null)

    const { error: writeError } = await changeUserRole(user.id, role)
    setSubmitting(false)

    if (writeError) {
      setError(describeUserError(writeError))
      return
    }

    onClose(true)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {describeUser(user)} is currently {roleLabel(user.role)}. The change takes effect
            at once and is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <p role="alert" className="text-sm font-medium text-negative">
              {error}
            </p>
          )}

          <RolePicker
            id="change-role"
            value={role}
            onChange={setRole}
            isOwner
            disabled={submitting}
          />

          {role === 'manager' && <ManagerReach personId={user.personId} />}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
              className="h-11 text-base"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || role === user.role}
              className="h-11 text-base"
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
