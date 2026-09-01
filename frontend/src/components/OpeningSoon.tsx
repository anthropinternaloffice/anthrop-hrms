/**
 * The label on every control that is visible but not yet built.
 *
 * Module 1 has no recruitment and no client portal. The brief keeps these
 * buttons on the page anyway, because the landing page has to look like
 * the finished thing to whoever Anthrop shows it to — but a control that
 * looks live and does nothing is worse than no control at all, so each
 * one says so plainly.
 */
export function OpeningSoon({ id }: { id: string }) {
  return (
    <span
      id={id}
      className="text-xs font-medium tracking-wide text-quiet uppercase"
    >
      Opening soon
    </span>
  )
}
