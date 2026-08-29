import { Skeleton, SkeletonHeader } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <div className="divide-y divide-rule overflow-hidden rounded-sm border border-rule bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
