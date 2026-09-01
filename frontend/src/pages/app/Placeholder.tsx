/**
 * A page that exists so the route and the sidebar item are real, and
 * nothing more.
 *
 * Each one names the task that fills it in. That is deliberate: at Gate 4
 * somebody will click every item in the sidebar, and "Employees" opening
 * onto a blank rectangle looks like a bug. This says which it is.
 *
 * These get replaced, not extended. Nothing in Module 1 is scaffolded
 * ahead of its own task.
 */
export function Placeholder({ title, task }: { title: string; task: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>

      <div className="mt-6 rounded-card border border-dashed border-line bg-surface p-gutter sm:p-card">
        <p className="text-sm leading-relaxed text-body">
          This screen has not been built yet. It is {task}.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-quiet">
          The page exists now so the route and the menu item are real and can be checked.
        </p>
      </div>
    </div>
  )
}
