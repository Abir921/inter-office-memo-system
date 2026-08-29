import { SkeletonHeader, SkeletonStats, SkeletonTable } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-10">
      <SkeletonHeader />
      <SkeletonStats />
      <SkeletonTable rows={4} />
    </div>
  )
}
