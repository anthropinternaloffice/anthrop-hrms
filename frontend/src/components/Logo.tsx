import { cn } from '@/lib/utils'

/**
 * The Anthrop mark.
 *
 * docs/decisions.md D3: a one-colour navy mark on white. It is placed on
 * white or on a solid brand panel, never on a tint and never recoloured.
 * The file has no transparency, so on a navy panel it is set inside a
 * white plate rather than laid directly on the colour.
 *
 * Served from public/ rather than hot-linked to anthropmanagement.com:
 * the client's WordPress site is not this application's CDN, and a
 * marketing site redesign should not be able to break the login screen.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/anthrop-logo.jpg"
      alt="Anthrop Management Limited"
      width={234}
      height={90}
      className={cn('h-9 w-auto sm:h-10', className)}
    />
  )
}

/** The mark on its white plate, for use on a solid brand panel. */
export function LogoPlate({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex rounded-card bg-surface px-5 py-4', className)}>
      <Logo className="h-10 w-auto sm:h-12" />
    </span>
  )
}
