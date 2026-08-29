import { Skeleton } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-10">
      <header className="border-b border-rule pb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-32" />
        </div>
      </header>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
