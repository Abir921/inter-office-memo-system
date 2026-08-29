import { Skeleton, SkeletonHeader } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonHeader />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}
