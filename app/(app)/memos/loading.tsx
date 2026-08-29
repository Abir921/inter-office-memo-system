import { SkeletonHeader, SkeletonTable } from '@/components/app/skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonHeader />
      <SkeletonTable rows={6} />
    </div>
  )
}
