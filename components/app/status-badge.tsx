import type { MemoStatus, Priority } from '@prisma/client'
import { cn } from '@/lib/utils'

// Status is always spelled out, never colour alone. A red dot means nothing to
// someone who cannot distinguish it from the green one.
const STATUS_LABEL: Record<MemoStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_REVIEW: 'Pending review',
  PENDING_APPROVAL: 'Pending approval',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const STATUS_TONE: Record<MemoStatus, string> = {
  DRAFT: 'border-rule bg-wash text-muted',
  SUBMITTED: 'border-ink/25 bg-ink/5 text-ink',
  PENDING_REVIEW: 'border-ink/25 bg-ink/5 text-ink',
  PENDING_APPROVAL: 'border-ink/25 bg-ink/5 text-ink',
  CHANGES_REQUESTED: 'border-pending/40 bg-pending/10 text-pending',
  APPROVED: 'border-seal/40 bg-seal/10 text-seal',
  REJECTED: 'border-stamp/40 bg-stamp/10 text-stamp',
  CANCELLED: 'border-rule bg-wash text-muted',
}

export function StatusBadge({
  status,
  className,
}: {
  status: MemoStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

const PRIORITY_LABEL: Record<Priority, string> = {
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}

const PRIORITY_TONE: Record<Priority, string> = {
  NORMAL: 'border-rule bg-card text-muted',
  HIGH: 'border-pending/40 bg-pending/10 text-pending',
  URGENT: 'border-stamp/40 bg-stamp/10 text-stamp',
}

export function PriorityChip({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  // Normal is the default and carries no information worth the ink.
  if (priority === 'NORMAL') return null

  return (
    <span
      className={cn(
        'font-data inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] whitespace-nowrap',
        PRIORITY_TONE[priority],
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

export { STATUS_LABEL, PRIORITY_LABEL }
