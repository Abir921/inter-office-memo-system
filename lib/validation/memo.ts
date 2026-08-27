// lib/validation/memo.ts — Zod schemas for every memo and workflow input.
//
// These run in the route handler before anything touches the database. The
// workflow service revalidates the rules it owns (comment required on reject,
// contiguous positions) so the invariants hold even if a handler forgets.

import { z } from 'zod'

const cuid = z.string().cuid('That is not a valid identifier.')

/** Optional relation id: an empty select box sends "", which means "none". */
const optionalCuid = z
  .union([cuid, z.literal('')])
  .optional()
  .transform((v) => (v ? v : null))

export const prioritySchema = z.enum(['NORMAL', 'HIGH', 'URGENT'])

const subject = z
  .string()
  .trim()
  .min(3, 'Give the memo a subject of at least 3 characters.')
  .max(200, 'Keep the subject under 200 characters.')

// The cap is generous but finite: without one, a paste bomb becomes a denial of
// service on the sanitizer.
const bodyHtml = z
  .string()
  .min(1, 'Write the body of the memo.')
  .max(100_000, 'This memo is too long. Attach a document instead.')

/** One desk on the routing slip. */
export const participantSchema = z.object({
  position: z.number().int().min(1).max(20),
  assigneeId: cuid,
  positionLabel: z
    .string()
    .trim()
    .max(80, 'Keep the role label under 80 characters.')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
})

export const participantsSchema = z
  .array(participantSchema)
  .min(1, 'A memo needs at least one approver.')
  .max(20, 'A workflow cannot have more than 20 steps.')
  .superRefine((participants, ctx) => {
    const sorted = [...participants].sort((a, b) => a.position - b.position)

    sorted.forEach((p, index) => {
      if (p.position !== index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Workflow positions must start at 1 and run consecutively.',
        })
      }
    })

    // Back-to-back repeats are always a mistake: approving your own step twice
    // in a row means the author added the same person by accident.
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].assigneeId === sorted[i - 1].assigneeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The same person cannot occupy two consecutive steps.',
        })
      }
    }
  })

export const createMemoSchema = z.object({
  subject,
  bodyHtml,
  departmentId: optionalCuid,
  categoryId: optionalCuid,
  templateId: optionalCuid,
  priority: prioritySchema.default('NORMAL'),
  /** Present when the author is submitting straight away rather than drafting. */
  participants: participantsSchema.optional(),
})

export const updateMemoSchema = z.object({
  subject,
  bodyHtml,
  departmentId: optionalCuid,
  categoryId: optionalCuid,
  priority: prioritySchema,
})

export const submitMemoSchema = z.object({
  participants: participantsSchema,
  templateId: optionalCuid,
})

export const resubmitMemoSchema = z.object({
  subject,
  bodyHtml,
  departmentId: optionalCuid,
  categoryId: optionalCuid,
  priority: prioritySchema,
  note: z.string().trim().max(2000).optional().or(z.literal('')),
})

export const workflowActionSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'COMMENT', 'REQUEST_CHANGES', 'REVIEW_COMPLETE']),
    comment: z.string().trim().max(4000, 'Keep the comment under 4000 characters.').optional(),
  })
  .superRefine((value, ctx) => {
    // Refusing a memo, or sending it back, must say why. Enforced here and
    // again in lib/workflow.ts.
    const needsReason = value.action === 'REJECT' || value.action === 'REQUEST_CHANGES'
    if (needsReason && !value.comment?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message:
          value.action === 'REJECT'
            ? 'Say why you are rejecting this memo.'
            : 'Say what needs to change.',
      })
    }
    if (value.action === 'COMMENT' && !value.comment?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message: 'Write your comment.',
      })
    }
  })

export const commentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Write your comment.')
    .max(4000, 'Keep the comment under 4000 characters.'),
})

/** Query parameters for the memo lists and search. */
export const memoListQuerySchema = z.object({
  scope: z.enum(['inbox', 'sent', 'completed', 'all']).default('sent'),
  status: z
    .enum([
      'DRAFT',
      'SUBMITTED',
      'PENDING_REVIEW',
      'PENDING_APPROVAL',
      'CHANGES_REQUESTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ])
    .optional(),
  priority: prioritySchema.optional(),
  departmentId: optionalCuid,
  categoryId: optionalCuid,
  q: z.string().trim().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export type CreateMemoInput = z.infer<typeof createMemoSchema>
export type UpdateMemoInput = z.infer<typeof updateMemoSchema>
export type SubmitMemoInput = z.infer<typeof submitMemoSchema>
export type WorkflowActionInput = z.infer<typeof workflowActionSchema>
export type MemoListQuery = z.infer<typeof memoListQuerySchema>
