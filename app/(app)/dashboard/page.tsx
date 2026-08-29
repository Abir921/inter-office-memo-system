import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MemoStatus } from '@prisma/client'
import { PriorityChip, StatusBadge } from '@/components/app/status-badge'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { agePending, stampDate } from '@/lib/format'
import { scoped, tenantContext } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Dashboard · Inter-Office Memo' }
export const dynamic = 'force-dynamic'

const ACTIVE: MemoStatus[] = [
  MemoStatus.SUBMITTED,
  MemoStatus.PENDING_REVIEW,
  MemoStatus.PENDING_APPROVAL,
]

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string
  value: React.ReactNode
  href?: string
  tone?: 'stamp' | 'seal' | 'pending'
}) {
  const toneClass =
    tone === 'stamp'
      ? 'text-stamp'
      : tone === 'seal'
        ? 'text-seal'
        : tone === 'pending'
          ? 'text-pending'
          : 'text-ink'

  const body = (
    <>
      <p className={'font-data text-2xl ' + toneClass}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-soft">{label}</p>
    </>
  )

  return href ? (
    <Link href={href} className="block bg-card p-4 transition-colors hover:bg-wash">
      {body}
    </Link>
  ) : (
    <div className="bg-card p-4">{body}</div>
  )
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = scoped(tenantContext(user))
  const admin = isAdmin(user)

  const [
    awaitingMe,
    myActive,
    myDrafts,
    myApproved,
    myChangesRequested,
    urgentAwaitingMe,
    inboxRows,
    recentActivity,
  ] = await Promise.all([
    db.step.count({ state: 'CURRENT', assigneeId: user.id, memo: { status: { in: ACTIVE } } }),
    db.memo.count({ authorId: user.id, status: { in: ACTIVE } }),
    db.memo.count({ authorId: user.id, status: MemoStatus.DRAFT }),
    db.memo.count({ authorId: user.id, status: MemoStatus.APPROVED }),
    db.memo.count({ authorId: user.id, status: MemoStatus.CHANGES_REQUESTED }),
    db.step.count({
      state: 'CURRENT',
      assigneeId: user.id,
      memo: { status: { in: ACTIVE }, priority: 'URGENT' },
    }),
    db.step.findMany({
      where: { state: 'CURRENT', assigneeId: user.id, memo: { status: { in: ACTIVE } } },
      orderBy: { updatedAt: 'asc' },
      take: 5,
      include: {
        memo: {
          select: {
            id: true,
            memoNumber: true,
            subject: true,
            status: true,
            priority: true,
            submittedAt: true,
            author: { select: { name: true } },
          },
        },
      },
    }),
    db.memo.findMany({
      where: { authorId: user.id },
      orderBy: { lastActivityAt: 'desc' },
      take: 5,
      select: {
        id: true,
        memoNumber: true,
        subject: true,
        status: true,
        priority: true,
        lastActivityAt: true,
      },
    }),
  ])

  // Administrators additionally see the shape of the whole organization.
  const orgStats = admin
    ? await Promise.all([
        db.user.count({ status: 'ACTIVE' }),
        db.department.count({ isActive: true }),
        db.memo.count(),
        db.memo.count({ status: { in: ACTIVE } }),
        db.memo.count({ status: MemoStatus.APPROVED }),
        db.memo.count({ status: MemoStatus.REJECTED }),
        db.user.count(),
      ])
    : null

  return (
    <div className="space-y-10">
      <header>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          {stampDate(new Date())}
        </p>
        <h1 className="mt-2 text-2xl">Good day, {user.name.split(' ')[0]}.</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {awaitingMe === 0
            ? 'Nothing is waiting on you right now.'
            : awaitingMe === 1
              ? 'One memo is waiting on your decision.'
              : awaitingMe + ' memos are waiting on your decision.'}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold">Your desk</h2>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Awaiting your action"
            value={awaitingMe}
            href="/inbox"
            tone={awaitingMe > 0 ? 'pending' : undefined}
          />
          <Stat
            label="Urgent, awaiting you"
            value={urgentAwaitingMe}
            href="/inbox"
            tone={urgentAwaitingMe > 0 ? 'stamp' : undefined}
          />
          <Stat label="Your memos in progress" value={myActive} href="/memos" />
          <Stat
            label="Changes requested"
            value={myChangesRequested}
            href="/memos"
            tone={myChangesRequested > 0 ? 'pending' : undefined}
          />
          <Stat label="Your drafts" value={myDrafts} href="/memos" />
          <Stat label="Approved" value={myApproved} href="/completed" tone="seal" />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Waiting on you</h2>
          <Link
            href="/inbox"
            className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Open inbox
          </Link>
        </div>

        {inboxRows.length === 0 ? (
          <p className="mt-3 rounded-sm border border-rule bg-card p-6 text-sm text-muted">
            No memos are waiting on you.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
            {inboxRows.map((step) => (
              <li key={step.id}>
                <Link
                  href={'/memos/' + step.memo.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 p-4 transition-colors hover:bg-wash"
                >
                  <span className="font-data text-xs text-muted">{step.memo.memoNumber}</span>
                  <span className="min-w-0 flex-1 basis-full truncate text-sm font-medium text-ink sm:basis-auto">
                    {step.memo.subject}
                  </span>
                  <PriorityChip priority={step.memo.priority} />
                  <span className="font-data text-xs text-muted">
                    {step.memo.author.name} · {agePending(step.memo.submittedAt ?? step.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Your recent memos</h2>
          <Link
            href="/memos/new"
            className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Write a memo
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <p className="mt-3 rounded-sm border border-rule bg-card p-6 text-sm text-muted">
            You have not written a memo yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
            {recentActivity.map((memo) => (
              <li key={memo.id}>
                <Link
                  href={'/memos/' + memo.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-4 transition-colors hover:bg-wash"
                >
                  <span className="font-data text-xs text-muted">{memo.memoNumber}</span>
                  <span className="min-w-0 flex-1 basis-full truncate text-sm font-medium text-ink sm:basis-auto">
                    {memo.subject}
                  </span>
                  <StatusBadge status={memo.status} />
                  <span className="font-data text-xs text-muted">
                    {stampDate(memo.lastActivityAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orgStats ? (
        <section>
          <h2 className="text-sm font-semibold">{user.organizationName}</h2>
          <p className="mt-1 text-xs text-muted">Visible to administrators.</p>
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Active users"
              value={
                <>
                  {orgStats[0]}
                  <span className="text-base text-muted"> / {orgStats[6]}</span>
                </>
              }
              href="/admin/users"
            />
            <Stat label="Departments" value={orgStats[1]} href="/admin/departments" />
            <Stat label="Memos, all time" value={orgStats[2]} />
            <Stat label="In progress" value={orgStats[3]} />
            <Stat label="Approved" value={orgStats[4]} tone="seal" />
            <Stat label="Rejected" value={orgStats[5]} tone="stamp" />
          </div>
        </section>
      ) : null}
    </div>
  )
}
