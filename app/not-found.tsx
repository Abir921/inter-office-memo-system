import Link from 'next/link'

/**
 * Replaces Next.js's built-in 404.
 *
 * The built-in one ships its own stylesheet containing a
 * `@media (prefers-color-scheme: dark)` rule that repaints the body black.
 * This app is deliberately single-theme — the paper routing slip — so that
 * rule produced a black page for anyone whose OS or browser is set to dark
 * mode. Defining this file stops the default from rendering at all.
 *
 * The copy is deliberately neutral. A memo belonging to another organization
 * reaches this page, and it must not read as "this exists but you may not see
 * it" — that would confirm the record exists.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
              Form&nbsp;IOM&#8209;1
            </span>
            <span className="text-sm font-semibold text-ink">Inter-Office Memo</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Not on file
        </p>
        <h1 className="mt-3 text-3xl">404 &mdash; nothing here</h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft">
          We could not find that page. The address may be mistyped, or the item
          may have been removed.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-sm bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            Go to your dashboard
          </Link>
          <Link
            href="/memos"
            className="inline-flex h-10 items-center rounded-sm border border-rule bg-card px-5 text-sm font-medium text-ink transition-colors hover:bg-wash"
          >
            My memos
          </Link>
        </div>
      </main>
    </div>
  )
}
