import { cn } from '@/lib/utils'

/**
 * Loading placeholders.
 *
 * These exist so a route transition is instant: Next.js only swaps the URL
 * and shows the new route once it has something to render, so without a
 * loading state a click appears to do nothing until the server answers. With
 * one, the address bar and the shell update immediately and the content fills
 * in behind it.
 *
 * The pulse is a Tailwind animation, and globals.css already reduces every
 * animation to a single instant frame under prefers-reduced-motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-wash', className)} />
}

/** Page heading: eyebrow, title. */
export function SkeletonHeader() {
  return (
    <div>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-7 w-56" />
    </div>
  )
}

/** Stands in for MemoTable while its query runs. */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-sm border border-rule bg-card">
      <div className="border-b border-rule bg-wash px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y divide-rule">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-3 w-28 shrink-0" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-5 w-24 shrink-0" />
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stands in for the dashboard's stat strip. */
export function SkeletonStats({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card p-4">
          <Skeleton className="h-6 w-10" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
