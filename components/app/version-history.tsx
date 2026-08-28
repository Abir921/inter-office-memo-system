import { PriorityChip } from './status-badge'
import { stamp } from '@/lib/format'

export interface VersionRow {
  id: string
  versionNumber: number
  submissionCycle: number
  subject: string
  bodyHtml: string
  priority: 'NORMAL' | 'HIGH' | 'URGENT'
  createdAt: Date
  editedBy: { id: string; name: string }
}

/**
 * A read-only, diff-free list of every submitted version (PRD 7.16). Each
 * entry is a full snapshot taken at submit or resubmit time — never edited
 * afterwards — so this is simply rendering history, not computing it.
 */
export function VersionHistory({ versions }: { versions: VersionRow[] }) {
  if (versions.length <= 1) return null

  return (
    <section>
      <h2 className="text-sm font-semibold">Versions</h2>
      <p className="mt-1 text-xs text-muted">
        A snapshot was recorded each time this memo was submitted or resubmitted.
      </p>

      <div className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
        {[...versions].reverse().map((v) => (
          <details key={v.id} className="group open:bg-wash">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 marker:content-none">
              <span className="font-data text-xs text-muted">
                v{v.versionNumber} · cycle {v.submissionCycle}
              </span>
              <span className="min-w-0 flex-1 basis-full truncate text-sm font-medium text-ink sm:basis-auto">
                {v.subject}
              </span>
              <PriorityChip priority={v.priority} />
              <span className="font-data text-xs text-muted">
                {v.editedBy.name} · {stamp(v.createdAt)}
              </span>
            </summary>
            <div
              className="memo-body border-t border-rule px-4 py-4 text-sm leading-relaxed text-ink-soft"
              dangerouslySetInnerHTML={{ __html: v.bodyHtml }}
            />
          </details>
        ))}
      </div>
    </section>
  )
}
