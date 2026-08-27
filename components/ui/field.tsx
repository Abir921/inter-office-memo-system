import * as React from 'react'
import { cn } from '@/lib/utils'

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-sm font-medium text-ink', className)} {...props} />
  )
}

/**
 * Label + control + error message. The error is rendered in the same place
 * every time, so the form does not jump as messages appear.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string | string[]
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  const message = Array.isArray(error) ? error[0] : error
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-stamp">*</span> : null}
      </Label>
      {children}
      {hint && !message ? <p className="text-xs text-muted">{hint}</p> : null}
      {message ? (
        <p id={htmlFor + '-error'} className="text-xs text-stamp">
          {message}
        </p>
      ) : null}
    </div>
  )
}
