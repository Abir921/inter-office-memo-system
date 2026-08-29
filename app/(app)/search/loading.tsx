import { Skeleton, SkeletonHeader, SkeletonTable } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-10 w-full" />
      <SkeletonTable rows={6} />
    </div>
  )
}
