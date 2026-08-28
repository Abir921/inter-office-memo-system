/**
 * A simple horizontal bar breakdown — no charting library, just proportional
 * width, so it inherits the site's palette and never needs its own category
 * colour scheme. The number is always printed, never implied by bar length
 * alone.
 */
export function BarList({
  rows,
  tone = 'ink',
}: {
  rows: { label: string; count: number }[]
  tone?: 'ink' | 'seal' | 'stamp' | 'pending'
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No data for this filter.</p>
  }

  const max = Math.max(...rows.map((r) => r.count), 1)
  const barColor = {
    ink: 'bg-ink',
    seal: 'bg-seal',
    stamp: 'bg-stamp',
    pending: 'bg-pending',
  }[tone]

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-ink-soft" title={row.label}>
            {row.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-sm bg-wash">
            <span
              className={'block h-full rounded-sm ' + barColor}
              style={{ width: (row.count / max) * 100 + '%' }}
            />
          </span>
          <span className="font-data w-8 shrink-0 text-right text-xs text-ink">{row.count}</span>
        </li>
      ))}
    </ul>
  )
}
