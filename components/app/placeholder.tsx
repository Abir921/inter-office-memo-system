/**
 * Stands in for a screen that a later phase will build. Deliberately plain:
 * it should never be mistaken for a finished feature.
 */
export function Placeholder({
  title,
  phase,
  description,
}: {
  title: string
  phase: string
  description: string
}) {
  return (
    <section>
      <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">{phase}</p>
      <h1 className="mt-2 text-2xl">{title}</h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{description}</p>
      <div className="mt-6 rounded-sm border border-dashed border-rule bg-card p-8 text-center">
        <p className="text-sm text-muted">This screen is built in {phase}.</p>
      </div>
    </section>
  )
}
