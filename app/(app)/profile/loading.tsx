import { Skeleton, SkeletonHeader } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="max-w-lg space-y-10">
      <SkeletonHeader />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
