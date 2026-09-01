import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, FileText, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/Logo'
import { OpeningSoon } from '@/components/OpeningSoon'

/**
 * The public landing page. The only page in the application a logged-out
 * stranger is meant to see.
 *
 * Every control here is disabled except "Staff login". Recruitment and
 * the client portal are later modules; the brief keeps their buttons
 * visible so the page reads as finished, and labels each one so nobody
 * is left clicking at something that will not respond.
 *
 * The company details and the footer links are the client's own, taken
 * from anthropmanagement.com. Nothing here is invented.
 */

const CARDS = [
  {
    icon: Briefcase,
    title: 'Open roles',
    body: 'Current vacancies we are recruiting for.',
    action: 'View roles',
    id: 'open-roles',
  },
  {
    icon: FileText,
    title: 'Submit your CV',
    body: 'Not seeing the right role? Send your CV and we will match it to future openings.',
    action: 'Submit CV',
    id: 'submit-cv',
  },
  {
    icon: LogIn,
    title: 'Working with us',
    body: 'Already an Anthrop client? Sign in to follow your vacancy.',
    action: 'Client login',
    id: 'client-login',
  },
] as const

export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      {/* Header. The logo, and the one control on this page that works. */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-gutter py-4 sm:px-8">
          <Link to="/" aria-label="Anthrop Management Limited, home">
            <Logo />
          </Link>

          <Button asChild size="sm" className="h-10 px-4">
            <Link to="/login">
              Staff login
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero. The client's own positioning line, verbatim. */}
        <section className="mx-auto w-full max-w-6xl px-gutter py-12 sm:px-8 sm:py-section">
          <h1 className="max-w-3xl text-3xl leading-tight font-semibold text-balance text-ink sm:text-4xl lg:text-5xl">
            Nigeria&rsquo;s Trusted HR Consulting Firm
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-body sm:text-lg">
            Anthrop Management Limited supports organisations across Nigeria with
            recruitment, executive training, and performance consulting.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              disabled
              aria-disabled="true"
              aria-describedby="hero-opening-soon"
              className="h-11 w-full px-5 sm:w-auto"
            >
              View open roles
            </Button>
            <Button
              variant="outline"
              disabled
              aria-disabled="true"
              aria-describedby="hero-opening-soon"
              className="h-11 w-full px-5 sm:w-auto"
            >
              Submit your CV
            </Button>
            <OpeningSoon id="hero-opening-soon" />
          </div>
        </section>

        {/* Three cards. Clean white cards on a light grey page. */}
        <section
          aria-label="What you can do here"
          className="mx-auto w-full max-w-6xl px-gutter pb-12 sm:px-8 sm:pb-section"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {CARDS.map((card) => (
              <Card key={card.id} className="flex flex-col border-line bg-surface shadow-none">
                <CardHeader className="gap-3">
                  <card.icon className="size-5 text-brand" aria-hidden="true" strokeWidth={1.75} />
                  <CardTitle className="text-lg text-ink">{card.title}</CardTitle>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-between gap-6">
                  <p className="text-sm leading-relaxed text-body">{card.body}</p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      aria-disabled="true"
                      aria-describedby={card.id + '-opening-soon'}
                      className="h-10 px-4"
                    >
                      {card.action}
                    </Button>
                    <OpeningSoon id={card.id + '-opening-soon'} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

/**
 * Footer. Address, email and phone are the client's, from their own site
 * footer. The policy links point at the pages that already exist on
 * anthropmanagement.com rather than at stubs here: Anthrop's published
 * policies are the real ones, and there is no second copy to fall out of
 * date.
 */
function LandingFooter() {
  return (
    <footer className="bg-brand text-white">
      <div className="mx-auto w-full max-w-6xl px-gutter py-10 sm:px-8 sm:py-12">
        <p className="text-base font-semibold text-white">Anthrop Management Limited</p>

        <address className="mt-3 space-y-1 text-sm leading-relaxed text-white/85 not-italic">
          <p>27 Acme Road, Agidingbi, Ikeja, Lagos</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href="mailto:info@anthropmanagement.com"
              className="underline underline-offset-4 hover:text-white"
            >
              info@anthropmanagement.com
            </a>
            <span aria-hidden="true" className="text-white/40">
              &middot;
            </span>
            <a
              href="tel:+2348033713519"
              className="tabular underline underline-offset-4 hover:text-white"
            >
              +234 803 371 3519
            </a>
          </p>
        </address>

        <nav
          aria-label="Company policies"
          className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/20 pt-6 text-sm text-white/85"
        >
          <FooterLink href="https://anthropmanagement.com/privacy-policy/">
            Privacy Policy
          </FooterLink>
          <Dot />
          <FooterLink href="https://anthropmanagement.com/terms-conditions/">Terms</FooterLink>
          <Dot />
          <FooterLink href="https://anthropmanagement.com/">anthropmanagement.com</FooterLink>
        </nav>
      </div>
    </footer>
  )
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-white/40">
      &middot;
    </span>
  )
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-4 hover:text-white"
    >
      {children}
    </a>
  )
}
