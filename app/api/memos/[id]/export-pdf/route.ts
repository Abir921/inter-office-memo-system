// GET /api/memos/:id/export-pdf
//
// Server-rendered PDF (PRD 7.19). Authorization is the same visibility rule
// as the memo detail page: a memo you cannot see does not exist for this
// route either, so it 404s rather than confirming anything.

import { AuditEventType } from '@prisma/client'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { handler, jsonError } from '@/lib/api'
import { writeAudit } from '@/lib/audit'
import { requireSession } from '@/lib/auth'
import { visibleMemoWhere } from '@/lib/memo-queries'
import { MemoPdfDocument, type MemoPdfData } from '@/lib/pdf'
import { prisma } from '@/lib/prisma'
import { scoped, tenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await requireSession()
    const ctx = tenantContext(user)
    const db = scoped(ctx)

    const memo = await db.memo.findById(id, {
      where: visibleMemoWhere(ctx),
      include: {
        author: { select: { name: true, designation: true } },
        department: { select: { name: true } },
        category: { select: { name: true } },
        finalApprover: { select: { name: true } },
      },
    })

    if (!memo) return jsonError(404, 'Not found.')

    const [steps, actions, comments, attachments] = await Promise.all([
      db.step.findMany({
        where: { memoId: memo.id, submissionCycle: memo.submissionCycle },
        orderBy: { position: 'asc' },
        include: { assignee: { select: { name: true } } },
      }),
      db.action.findMany({
        where: { memoId: memo.id, submissionCycle: memo.submissionCycle },
        orderBy: { createdAt: 'asc' },
      }),
      db.comment.findMany({
        where: { memoId: memo.id },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true } } },
      }),
      db.attachment.findMany({
        where: { memoId: memo.id, isDeleted: false },
        orderBy: { uploadedAt: 'asc' },
        include: { uploadedBy: { select: { name: true } } },
      }),
    ])

    const decisionByStep = new Map<string, (typeof actions)[number]>()
    for (const action of actions) {
      if (action.stepId && action.action !== 'COMMENT') decisionByStep.set(action.stepId, action)
    }

    const pdfData: MemoPdfData = {
      organizationName: user.organizationName,
      memoNumber: memo.memoNumber,
      subject: memo.subject,
      bodyHtml: memo.bodyHtml,
      status: memo.status,
      priority: memo.priority,
      authorName: memo.author.name,
      authorDesignation: memo.author.designation,
      departmentName: memo.department?.name ?? null,
      categoryName: memo.category?.name ?? null,
      createdAt: memo.createdAt,
      submittedAt: memo.submittedAt,
      completedAt: memo.completedAt,
      finalApproverName: memo.finalApprover?.name ?? null,
      steps: steps.map((s) => {
        const decision = decisionByStep.get(s.id)
        return {
          position: s.position,
          positionLabel: s.positionLabel,
          assigneeName: s.assignee.name,
          action: decision?.action ?? null,
          actionAt: decision?.createdAt ?? null,
          comment: decision?.comment ?? null,
        }
      }),
      comments: comments.map((c) => ({
        authorName: c.author.name,
        text: c.text,
        createdAt: c.createdAt,
      })),
      attachments: attachments.map((a) => ({
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
        uploaderName: a.uploadedBy.name,
      })),
      exportedAt: new Date(),
    }

    const buffer = await renderToBuffer(MemoPdfDocument(pdfData))

    await writeAudit(prisma, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: AuditEventType.MEMO_EXPORTED,
      entityType: 'Memo',
      entityId: memo.id,
      description: memo.memoNumber + ' exported as PDF.',
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="' + memo.memoNumber + '.pdf"',
        'Cache-Control': 'private, no-store',
      },
    })
  },
)
