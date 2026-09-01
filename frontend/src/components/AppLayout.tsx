import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Building2,
  Clock,
  Home,
  IdCard,
  LogOut,
  Menu,
  ScrollText,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

/**
 * The logged-in shell.
 *
 * A left sidebar, not the reference's nine horizontal tabs: this list has
 * to reach roughly fifteen items across the later modules, and horizontal
 * tabs stop working long before that. Below `lg` the same list moves into
 * a drawer so the content gets the whole width of a phone.
 *
 * The items are Module 1's only. Recruitment, leave and payroll are not
 * listed, greyed out, or otherwise hinted at — the brief says do not
 * scaffold them, and a disabled menu item is a promise about a date
 * nobody has agreed.
 */

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** `end` so Home does not stay highlighted on every child route. */
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/employees', label: 'Employees', icon: Users },
  { to: '/app/departments', label: 'Departments', icon: Building2 },
  { to: '/app/job-titles', label: 'Job titles', icon: IdCard },
  { to: '/app/attendance', label: 'Attendance', icon: Clock },
  { to: '/app/users', label: 'Users and roles', icon: UserCog },
  { to: '/app/audit-log', label: 'Audit log', icon: ScrollText },
]

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-page">
      {/* Desktop sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo />
        </div>
        <SidebarNav />
        <SignedInAs />
      </aside>

      {/* Phone and tablet header. */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface px-gutter lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="size-10" aria-label="Open menu">
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-72 gap-0 bg-surface p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex h-16 items-center border-b border-line px-5">
              <Logo />
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            <SignedInAs />
          </SheetContent>
        </Sheet>

        <Logo className="h-8 w-auto" />
      </header>

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-gutter py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/**
 * The item list, shared by the fixed sidebar and the drawer.
 *
 * `onNavigate` is how the drawer closes: on the tap that navigates,
 * rather than in an effect watching the location afterwards. Same
 * result, one render instead of two.
 */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  // 44px tall: the sidebar is used with a thumb on a phone.
                  'flex min-h-11 items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-body hover:bg-wash hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn('size-5 shrink-0', isActive ? 'text-white' : 'text-quiet')}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Who is signed in, and the way out.
 *
 * The email is shown on screen because the person needs to know which
 * account they are in. It is never written to the console — rule 7.
 */
function SignedInAs() {
  const { session, signOut } = useAuth()
  const email = session?.user.email

  return (
    <div className="border-t border-line p-3">
      {email && (
        <p className="truncate px-3 pt-1 pb-2 text-xs text-quiet" title={email}>
          Signed in as {email}
        </p>
      )}

      <Button
        variant="ghost"
        onClick={() => void signOut()}
        className="min-h-11 w-full justify-start gap-3 px-3 text-sm font-medium text-body hover:bg-wash hover:text-ink"
      >
        <LogOut className="size-5 text-quiet" strokeWidth={1.75} aria-hidden="true" />
        Sign out
      </Button>
    </div>
  )
}
