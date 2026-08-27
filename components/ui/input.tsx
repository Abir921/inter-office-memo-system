import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-sm border border-rule bg-card px-3 text-sm text-ink',
        'placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60',
        'aria-[invalid=true]:border-stamp',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-sm border border-rule bg-card p-3 text-sm leading-relaxed text-ink',
        'placeholder:text-muted aria-[invalid=true]:border-stamp',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-sm border border-rule bg-card px-3 text-sm text-ink',
        'aria-[invalid=true]:border-stamp',
        className,
      )}
      {...props}
    />
  ),
)
Select.displayName = 'Select'
