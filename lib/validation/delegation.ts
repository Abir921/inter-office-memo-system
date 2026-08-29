// lib/validation/delegation.ts — Zod schemas for delegation (PRD 7.20, P2).

import { z } from 'zod'

export const createDelegationSchema = z
  .object({
    delegateId: z.string().cuid('Choose a colleague to delegate to.'),
    startDate: z.string().datetime({ message: 'Choose a start date.' }),
    endDate: z.string().datetime({ message: 'Choose an end date.' }),
    reason: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.endDate) <= new Date(v.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'The end date must be after the start date.',
      })
    }
    // A delegation that has already lapsed at the moment it's created can
    // never do anything — refuse it outright rather than silently accept a
    // dead row. A little slack (5 minutes) absorbs clock skew and the time a
    // form takes to submit.
    if (new Date(v.endDate).getTime() < Date.now() - 5 * 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'The end date has already passed.',
      })
    }
  })

export const updateDelegationStatusSchema = z.object({
  status: z.enum(['CANCELLED']), // the only client-initiated transition; EXPIRED is derived, never set directly
})

export type CreateDelegationInput = z.infer<typeof createDelegationSchema>
