import Link from 'next/link'

/**
 * The 404 a signed-in user sees — rendered inside the app shell, so the
 * sidebar and header stay put rather than dropping them to a bare page.
 *
 * This is the boundary a cross-tenant memo URL lands on: lib/tenant.ts
 * returns null for another organization's row, the page calls notFound(),
 * and this renders. The copy is therefore deliberately neutral — it must
 * never read as "this exists but you may not see it", because that would
 * confirm the record exists. Same words whether the memo is real and
 * someone else's, or never existed at all.
 */
export default function AppNotFound() {
  return (
    <section>
      <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
        Not on file
      </p>
      <h1 className="mt-2 text-2xl">Nothing here</h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
        We could not find that memo. It may have been removed, or the address
        may be mistyped.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-sm bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          Dashboard
        </Link>
        <Link
          href="/memos"
          className="inline-flex h-10 items-center rounded-sm border border-rule bg-card px-5 text-sm font-medium text-ink transition-colors hover:bg-wash"
        >
          My memos
        </Link>
        <Link
          href="/inbox"
          className="inline-flex h-10 items-center rounded-sm border border-rule bg-card px-5 text-sm font-medium text-ink transition-colors hover:bg-wash"
        >
          Inbox
        </Link>
      </div>
    </section>
  )
}
