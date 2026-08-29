// lib/format.ts — presentation helpers for the data face.

/** "2d 4h" — how long a memo has been sitting on somebody's desk. */
export function agePending(since: Date | string, now: Date = new Date()): string {
  const start = typeof since === 'string' ? new Date(since) : since
  const minutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000))

  if (minutes < 60) return minutes + 'm'

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ' + (minutes % 60) + 'm'

  const days = Math.floor(hours / 24)
  return days + 'd ' + (hours % 24) + 'h'
}

/** Fixed-width timestamp for the mono face: "27 Aug 2026, 14:32". */
export function stamp(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Date only: "27 Aug 2026". */
export function stampDate(
  date: Date | string | null | undefined,
  opts: { utc?: boolean } = {},
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(opts.utc ? { timeZone: 'UTC' } : {}),
  })
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
