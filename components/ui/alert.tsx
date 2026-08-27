import { cn } from '@/lib/utils'

/**
 * Errors state what happened and what to do. They never apologise and never
 * stay vague.
 */
export function Alert({
  variant = 'error',
  title,
  children,
  className,
}: {
  variant?: 'error' | 'info' | 'success' | 'pending'
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  const tone = {
    error: 'border-stamp/40 bg-stamp/5 text-stamp',
    info: 'border-rule bg-wash text-ink-soft',
    success: 'border-seal/40 bg-seal/5 text-seal',
    pending: 'border-pending/40 bg-pending/5 text-pending',
  }[variant]

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('rounded-sm border px-3 py-2.5 text-sm', tone, className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
    </div>
  )
}
