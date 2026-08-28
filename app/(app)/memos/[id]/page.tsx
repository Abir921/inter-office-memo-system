import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { StepActionType } from '@prisma/client'
import { ActionPanel } from '@/components/app/action-panel'
import { Attachments } from '@/components/app/attachments'
import { CancelMemoButton } from '@/components/app/cancel-memo-button'
import { CommentForm } from '@/components/app/comment-form'
import { RoutingRail, type RailStep } from '@/components/app/routing-rail'
import { PriorityChip, StatusBadge } from '@/components/app/status-badge'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { stamp } from '@/lib/format'
import { MEMO_DETAIL_INCLUDE } from '@/lib/memo'
import { ACTIVE_STATUSES, visibleMemoWhere } from '@/lib/memo-queries'
import { prisma } from '@/lib/prisma'
import { scoped, tenantContext } from '@/lib/tenant'
import { getActiveDelegatorIds } from '@/lib/workflow'

export const metadata: Metadata = { title: 'Memo · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

const ACTION_VERB: Record<StepActionType, string> = {
  APPROVE: 'approved this memo',
  REJECT: 'rejected this memo',
  REQUEST_CHANGES: 'asked for changes',
  REVIEW_COMPLETE: 'completed their review',
  COMMENT: 'commented',
}

/** One row of the merged chronological record. */
interface TimelineEntry {
  id: string
  at: Date
  who: string
  what: string
  detail?: string | null
  tone: 'ink' | 'seal' | 'stamp' | 'pending' | 'muted'
}

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const ctx = tenantContext(user)
  const db = scoped(ctx)

  // Tenant-scoped AND authorization-scoped. Another organization's memo, or a
  // colleague's memo this user has no part in, is not found — never forbidden,
  // which would confirm that it exists.
  const memo = await db.memo.findById(id, {
    where: visibleMemoWhere(ctx),
    include: MEMO_DETAIL_INCLUDE,
  })

  if (!memo) notFound()

  const [steps, actions, comments, attachments, cycleCount] = await Promise.all([
    db.step.findMany({
      where: { memoId: memo.id, submissionCycle: memo.submissionCycle },
      orderBy: { position: 'asc' },
      include: { assignee: { select: { id: true, name: true, designation: true } } },
    }),
    db.action.findMany({
      where: { memoId: memo.id },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, name: true } },
        actedOnBehalfOf: { select: { name: true } },
      },
    }),
    db.comment.findMany({
      where: { memoId: memo.id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, designation: true } } },
    }),
    db.attachment.findMany({
      where: { memoId: memo.id, isDeleted: false },
      orderBy: { uploadedAt: 'asc' },
      include: { uploadedBy: { select: { name: true } } },
    }),
    db.step.findMany({
      where: { memoId: memo.id },
      distinct: ['submissionCycle'],
      select: { submissionCycle: true },
    }),
  ])

  // Latest decision per step, for the rail. WorkflowAction is the source of
  // truth here, not the mutable step row.
  const decisionByStep = new Map<string, (typeof actions)[number]>()
  for (const action of actions) {
    if (action.stepId && action.action !== 'COMMENT') decisionByStep.set(action.stepId, action)
  }

  const railSteps: RailStep[] = steps.map((step) => ({
    id: step.id,
    position: step.position,
    positionLabel: step.positionLabel,
    state: step.state,
    createdAt: step.createdAt,
    assignee: step.assignee,
    action: decisionByStep.get(step.id) ?? null,
  }))

  // The chronological record: creation, every decision, every comment.
  const timeline: TimelineEntry[] = [
    {
      id: 'created',
      at: memo.createdAt,
      who: memo.author.name,
      what: 'created this memo',
      tone: 'muted' as const,
    },
    ...(memo.submittedAt
      ? [
          {
            id: 'submitted',
            at: memo.submittedAt,
            who: memo.author.name,
            what: 'submitted it into the workflow',
            tone: 'ink' as const,
          },
        ]
      : []),
    ...actions.map((action) => ({
      id: action.id,
      at: action.createdAt,
      who: action.actedOnBehalfOf
        ? action.actor.name + ' (for ' + action.actedOnBehalfOf.name + ')'
        : action.actor.name,
      what: ACTION_VERB[action.action],
      detail: action.comment,
      tone:
        action.action === 'APPROVE' || action.action === 'REVIEW_COMPLETE'
          ? ('seal' as const)
          : action.action === 'REJECT'
            ? ('stamp' as const)
            : action.action === 'REQUEST_CHANGES'
              ? ('pending' as const)
              : ('muted' as const),
    })),
    ...comments.map((comment) => ({
      id: comment.id,
      at: comment.createdAt,
      who: comment.author.name,
      what: 'commented',
      detail: comment.text,
      tone: 'muted' as const,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime())

  const currentStep = steps.find((s) => s.id === memo.currentStepId)

  const participantIds = new Set(steps.map((s) => s.assigneeId))
  const isAuthor = memo.authorId === user.id

  // Attachments and edits are the author's, and only while the memo is still
  // with them. Once it is routed it belongs to the record.
  const canEdit = isAuthor && (memo.status === 'DRAFT' || memo.status === 'CHANGES_REQUESTED')

  const mayComment =
    memo.status !== 'DRAFT' &&
    (isAuthor || participantIds.has(user.id) || isAdmin(user))

  // Whether THIS session may act on the current step. Rendering the panel at
  // all is a courtesy — performWorkflowAction re-derives and re-checks this
  // exact condition server-side, from the session, before writing anything.
  // Hiding a button is not authorization; this only decides what to show.
  const delegatorIds = currentStep
    ? await getActiveDelegatorIds(prisma, {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
      })
    : []
  const canAct =
    Boolean(currentStep) &&
    ACTIVE_STATUSES.includes(memo.status) &&
    (currentStep!.assigneeId === user.id || delegatorIds.includes(currentStep!.assigneeId))

  const isLastStep = Boolean(currentStep) && currentStep!.position === steps.length

  const canCancel =
    (isAuthor || isAdmin(user)) &&
    memo.status !== 'DRAFT' &&
    ACTIVE_STATUSES.includes(memo.status)

  const toneClass = {
    ink: 'text-ink',
    seal: 'text-seal',
    stamp: 'text-stamp',
    pending: 'text-pending',
    muted: 'text-muted',
  }

  return (
    <article className="space-y-10">
      {/* ---- Header: the memo's identity ---- */}
      <header className="border-b border-rule pb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-data text-xs tracking-[0.08em] text-muted">{memo.memoNumber}</span>
          <StatusBadge status={memo.status} />
          <PriorityChip priority={memo.priority} />
        </div>

        <h1 className="mt-3 text-2xl leading-tight">{memo.subject}</h1>

        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted">From</dt>
            <dd className="text-ink-soft">
              {memo.author.name}
              {memo.author.designation ? ', ' + memo.author.designation : ''}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Department</dt>
            <dd className="text-ink-soft">{memo.department?.name ?? 'Not specified'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Category</dt>
            <dd className="text-ink-soft">{memo.category?.name ?? 'Not specified'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Raised</dt>
            <dd className="font-data text-ink-soft">{stamp(memo.createdAt)}</dd>
          </div>
          {memo.submittedAt ? (
            <div className="flex gap-2">
              <dt className="text-muted">Submitted</dt>
              <dd className="font-data text-ink-soft">{stamp(memo.submittedAt)}</dd>
            </div>
          ) : null}
          {memo.completedAt ? (
            <div className="flex gap-2">
              <dt className="text-muted">Closed</dt>
              <dd className="font-data text-ink-soft">{stamp(memo.completedAt)}</dd>
            </div>
          ) : null}
          {memo.finalApprover ? (
            <div className="flex gap-2">
              <dt className="text-muted">Final approver</dt>
              <dd className="text-ink-soft">{memo.finalApprover.name}</dd>
            </div>
          ) : null}
        </dl>

        {canEdit || canCancel ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {canEdit ? (
              <Link
                href={'/memos/' + memo.id + '/edit'}
                className="inline-flex h-9 items-center rounded-sm border border-rule bg-card px-4 text-sm font-medium text-ink hover:bg-wash"
              >
                {memo.status === 'DRAFT' ? 'Edit draft' : 'Revise and resubmit'}
              </Link>
            ) : null}
            {canCancel ? <CancelMemoButton memoId={memo.id} /> : null}
          </div>
        ) : null}
      </header>

      {/* ---- Action panel: rendered ONLY for the current step's assignee.
           This is a courtesy, not the authorization boundary — the route
           handler re-checks the same condition from the session before
           writing anything. ---- */}
      {canAct && currentStep ? (
        <ActionPanel memoId={memo.id} stepId={currentStep.id} isLastStep={isLastStep} />
      ) : null}

      {/* ---- The memo body ---- */}
      <section>
        <h2 className="sr-only">Memo</h2>
        <div
          className="memo-body max-w-prose text-[15px] leading-[1.7] text-ink-soft"
          // Sanitized on the way IN (lib/sanitize.ts), so what is stored is
          // already safe. Nothing hostile can reach this point.
          dangerouslySetInnerHTML={{ __html: memo.bodyHtml }}
        />
      </section>

      {/* ---- Attachments ---- */}
      <Attachments memoId={memo.id} attachments={attachments} canEdit={canEdit} />

      {/* ---- The routing slip: the centrepiece ---- */}
      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Routing</h2>
          {currentStep ? (
            <p className="text-sm text-ink-soft">
              With {currentStep.assignee.name}
              {currentStep.positionLabel ? ', ' + currentStep.positionLabel : ''}
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <RoutingRail
            steps={railSteps}
            cycle={memo.submissionCycle}
            totalCycles={cycleCount.length}
          />
        </div>
      </section>

      {/* ---- Chronological record ---- */}
      <section>
        <h2 className="text-sm font-semibold">History</h2>
        <ol className="mt-3 space-y-3">
          {timeline.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
              <span className="font-data w-40 shrink-0 text-[11px] text-muted">
                {stamp(entry.at)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-ink">{entry.who}</span>{' '}
                <span className={toneClass[entry.tone]}>{entry.what}</span>
                {entry.detail ? (
                  <span className="mt-1 block border-l-2 border-rule pl-3 leading-relaxed text-ink-soft">
                    {entry.detail}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Comments ---- */}
      {mayComment ? (
        <section>
          <h2 className="text-sm font-semibold">Add a comment</h2>
          <p className="mt-1 text-xs text-muted">
            Comments are permanent. They cannot be edited or removed once posted.
          </p>
          <div className="mt-3">
            <CommentForm memoId={memo.id} />
          </div>
        </section>
      ) : null}
    </article>
  )
}
