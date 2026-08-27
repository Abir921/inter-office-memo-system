import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-muted">
              Form&nbsp;IOM&#8209;1
            </span>
            <span className="text-sm font-semibold text-ink">
              Inter-Office Memo
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        {children}
      </main>
    </div>
  )
}
