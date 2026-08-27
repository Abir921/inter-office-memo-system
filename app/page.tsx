import Link from 'next/link'

const CAPABILITIES = [
  {
    n: '01',
    title: 'Ordered routing',
    body: 'Each memo carries a numbered list of desks. Only the desk whose turn it is may act, and only in order.',
  },
  {
    n: '02',
    title: 'Permanent record',
    body: 'Every approval, rejection and change request is written once and never edited. Resubmission adds to the file; it does not overwrite it.',
  },
  {
    n: '03',
    title: 'Separate organizations',
    body: 'Each organization sees its own memos and nothing else. The boundary is enforced on the server, on every query.',
  },
]

export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
              Form&nbsp;IOM&#8209;1
            </span>
            <span className="text-sm font-semibold text-ink">
              Inter-Office Memo
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/login"
              className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/register-org"
              className="rounded-sm bg-ink px-4 py-2 font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              Register an organization
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
          Internal circulation &middot; Approval required
        </p>
        <h1 className="mt-5 max-w-2xl text-3xl leading-[1.15] sm:text-5xl">
          The routing slip, made reliable.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
          Memos move desk to desk in a fixed order — department head, finance,
          director, chief executive. This system keeps that order, records who
          did what and when, and keeps every organization&rsquo;s file separate
          from every other.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/register-org"
            className="rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            Register an organization
          </Link>
          <Link
            href="/login"
            className="rounded-sm border border-rule bg-card px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-wash"
          >
            Sign in
          </Link>
        </div>

        <ol className="mt-16 grid gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <li key={item.n} className="bg-card p-6">
              <span className="font-data text-[11px] tracking-[0.12em] text-muted">
                {item.n}
              </span>
              <h2 className="mt-3 text-base">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
          <p className="font-data text-[11px] tracking-[0.1em] text-muted">
            CSE226 &middot; North South University &middot; Dept. of ECE
          </p>
        </div>
      </footer>
    </main>
  )
}
