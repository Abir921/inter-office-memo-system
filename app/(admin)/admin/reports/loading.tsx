import { SkeletonHeader, SkeletonStats } from '@/components/app/skeleton'
import { Skeleton } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonHeader />
      <Skeleton className="h-10 w-full" />
      <SkeletonStats count={5} />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
