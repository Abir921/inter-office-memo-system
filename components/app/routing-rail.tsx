import type { StepActionType, StepState } from '@prisma/client'
import { Check, CircleDashed, Minus, RotateCcw, X } from 'lucide-react'
import { agePending, stamp } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface RailStep {
  id: string
  position: number
  positionLabel: string | null
  state: StepState
  createdAt: Date
  assignee: { id: string; name: string; designation: string | null }
  /** The decision taken at this step, if one has been. */
  action?: {
    action: StepActionType
    comment: string | null
    createdAt: Date
    actor: { name: string }
    actedOnBehalfOf: { name: string } | null
  } | null
}

/** The stamp pressed onto a completed step. */
const MARK: Record<
  StepActionType,
  { label: string; icon: typeof Check; tone: string; border: string }
> = {
  APPROVE: {
    label: 'Approved',
    icon: Check,
    tone: 'text-seal',
    border: 'border-seal/45 bg-seal/8',
  },
  REVIEW_COMPLETE: {
    label: 'Reviewed',
    icon: Check,
    tone: 'text-seal',
    border: 'border-seal/45 bg-seal/8',
  },
  REJECT: {
    label: 'Rejected',
    icon: X,
    tone: 'text-stamp',
    border: 'border-stamp/45 bg-stamp/8',
  },
  REQUEST_CHANGES: {
    label: 'Changes requested',
    icon: RotateCcw,
    tone: 'text-pending',
    border: 'border-pending/45 bg-pending/8',
  },
  COMMENT: {
    label: 'Commented',
    icon: Minus,
    tone: 'text-muted',
    border: 'border-rule bg-wash',
  },
}

function StepMarker({ state, action }: { state: StepState; action?: RailStep['action'] }) {
  if (state === 'COMPLETED' && action) {
    const { icon: Icon, tone, border } = MARK[action.action]
    return (
      <span
        className={cn(
          'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2',
          border,
          tone,
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    )
  }

  if (state === 'CURRENT') {
    return (
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-paper">
        <span className="h-2 w-2 rounded-full bg-ink" />
      </span>
    )
  }

  if (state === 'SKIPPED') {
    return (
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-rule bg-paper text-muted">
        <Minus className="h-3.5 w-3.5" />
      </span>
    )
  }

  return (
    <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-rule bg-paper text-muted">
      <CircleDashed className="h-3.5 w-3.5" />
    </span>
  )
}

/**
 * The routing slip itself: one row per desk, in order.
 *
 * Completed steps are solid, the current step is outlined and highlighted,
 * future steps are muted. Each state is also named in words, so the rail reads
 * correctly without colour.
 */
export function RoutingRail({
  steps,
  cycle,
  totalCycles,
}: {
  steps: RailStep[]
  cycle: number
  totalCycles: number
}) {
  if (steps.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-rule bg-card p-6 text-sm text-muted">
        This memo has not been submitted, so it has no routing yet.
      </p>
    )
  }

  return (
    <div>
      {totalCycles > 1 ? (
        <p className="font-data mb-3 text-[11px] uppercase tracking-[0.14em] text-muted">
          Submission {cycle} of {totalCycles}
        </p>
      ) : null}

      <ol className="relative">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          const isCurrent = step.state === 'CURRENT'
          const action = step.action

          return (
            <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* The rail: a hairline joining one desk to the next. */}
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[13px] top-7 h-full w-0.5',
                    step.state === 'COMPLETED' ? 'bg-ink/25' : 'bg-rule',
                  )}
                />
              ) : null}

              <StepMarker state={step.state} action={action} />

              <div
                className={cn(
                  'min-w-0 flex-1 rounded-sm border px-4 py-3',
                  isCurrent
                    ? 'border-ink bg-card shadow-[0_1px_0_0_var(--rule)]'
                    : step.state === 'COMPLETED'
                      ? 'border-rule bg-card'
                      : 'border-rule/60 bg-transparent',
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span
                    className={cn(
                      'font-data text-xs',
                      step.state === 'PENDING' ? 'text-muted' : 'text-ink-soft',
                    )}
                  >
                    {String(step.position).padStart(2, '0')}
                  </span>

                  <span
                    className={cn(
                      'text-sm font-medium',
                      step.state === 'PENDING' ? 'text-muted' : 'text-ink',
                    )}
                  >
                    {step.assignee.name}
                  </span>

                  {step.positionLabel || step.assignee.designation ? (
                    <span className="text-xs text-muted">
                      {step.positionLabel ?? step.assignee.designation}
                    </span>
                  ) : null}

                  {action ? (
                    <span
                      className={cn(
                        'font-data ml-auto rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]',
                        MARK[action.action].border,
                        MARK[action.action].tone,
                      )}
                    >
                      {MARK[action.action].label}
                    </span>
                  ) : isCurrent ? (
                    <span className="font-data ml-auto rounded-sm border border-ink/30 bg-ink/5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-ink">
                      Awaiting
                    </span>
                  ) : step.state === 'SKIPPED' ? (
                    <span className="font-data ml-auto text-[10px] uppercase tracking-[0.1em] text-muted">
                      Not reached
                    </span>
                  ) : null}
                </div>

                {action ? (
                  <p className="font-data mt-1.5 text-[11px] text-muted">
                    {stamp(action.createdAt)}
                    {action.actedOnBehalfOf
                      ? ' · ' + action.actor.name + ' acting for ' + action.actedOnBehalfOf.name
                      : ''}
                  </p>
                ) : isCurrent ? (
                  <p className="font-data mt-1.5 text-[11px] text-muted">
                    Waiting {agePending(step.createdAt)}
                  </p>
                ) : null}

                {action?.comment ? (
                  <p className="mt-2 border-l-2 border-rule pl-3 text-sm leading-relaxed text-ink-soft">
                    {action.comment}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
