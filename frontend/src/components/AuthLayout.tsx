import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo, LogoPlate } from '@/components/Logo'

/**
 * The frame around sign in, forgot password, and set a new password.
 *
 * The layout reference puts a 3D cartoon character beside the form. The
 * brief replaces it with the Anthrop logo on a solid brand panel, which
 * is what the navy half is. On a phone the panel would cost a screenful
 * of thumb travel before anyone reached the first field, so below `lg`
 * it collapses to a plain white header and the form starts at the top.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
  showBackLink = true,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  showBackLink?: boolean
}) {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* The brand panel. Decoration only, so it is hidden from screen
          readers rather than read out before every form. */}
      <aside
        aria-hidden="true"
        className="hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <LogoPlate />

        <div className="max-w-sm">
          <p className="text-2xl leading-snug font-semibold text-balance text-white">
            We do not measure success by activity. We measure it by performance.
          </p>
          <p className="mt-4 text-sm text-white/70">Anthrop Management Limited</p>
        </div>
      </aside>

      {/* The form side. */}
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <header className="border-b border-line bg-surface lg:hidden">
          <div className="flex items-center px-gutter py-4">
            <Link to="/" aria-label="Anthrop Management Limited, home">
              <Logo />
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-gutter py-10 sm:px-8 sm:py-12">
          <div className="w-full max-w-md">
            {showBackLink && (
              <Link
                to="/"
                className="mb-6 inline-flex items-center gap-2 rounded-control text-sm font-medium text-body hover:text-brand"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to the main page
              </Link>
            )}

            <div className="rounded-card border border-line bg-surface p-gutter sm:p-card">
              <h1 className="text-2xl font-semibold text-ink">{title}</h1>
              {description && (
                <p className="mt-2 text-sm leading-relaxed text-body">{description}</p>
              )}

              <div className="mt-6">{children}</div>
            </div>

            {footer && <div className="mt-6 text-sm text-body">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  )
}
