'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
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

/**
 * A password field with a show/hide toggle. Visibility is local UI state
 * only — the value itself is never altered, so this is safe to drop in
 * anywhere a plain `<Input type="password">` was used.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(({ className, id, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type={visible ? 'text' : 'password'}
        className={cn(
          'h-10 w-full rounded-sm border border-rule bg-card py-2 pl-3 pr-10 text-sm text-ink',
          'placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60',
          'aria-[invalid=true]:border-stamp',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

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
