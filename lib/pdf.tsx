// lib/pdf.tsx
//
// Server-rendered PDF export (PRD 7.19). Built with @react-pdf/renderer's own
// layout primitives, not by converting the memo's HTML body — react-pdf does
// not render arbitrary HTML, so the body is laid out as plain paragraphs
// (lib/sanitize.ts toParagraphs) rather than reproducing rich formatting.
// Bold/italic/lists in the on-screen memo do not carry over to the PDF; this
// is a deliberate simplification, noted here and in the project report.
//
// Uses the PDF base-14 fonts (Helvetica, Helvetica-Bold) rather than the
// site's web fonts, so no font file has to be fetched at render time.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { MemoStatus, Priority, StepActionType } from '@prisma/client'
import { toParagraphs } from './sanitize'

const INK = '#16202B'
const MUTED = '#6B7580'
const RULE = '#D8D3C7'
const STAMP = '#A3242B'
const SEAL = '#2F5D50'
const PENDING = '#B8791F'

const STATUS_LABEL: Record<MemoStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_REVIEW: 'Pending review',
  PENDING_APPROVAL: 'In progress',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const STATUS_COLOR: Record<MemoStatus, string> = {
  DRAFT: MUTED,
  SUBMITTED: INK,
  PENDING_REVIEW: INK,
  PENDING_APPROVAL: INK,
  CHANGES_REQUESTED: PENDING,
  APPROVED: SEAL,
  REJECTED: STAMP,
  CANCELLED: MUTED,
}

const ACTION_LABEL: Record<StepActionType, string> = {
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  REQUEST_CHANGES: 'Changes requested',
  REVIEW_COMPLETE: 'Reviewed',
  COMMENT: 'Commented',
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: INK },
  orgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orgName: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  formCode: { fontSize: 8, color: MUTED, marginTop: 2 },
  stamp: {
    borderWidth: 1.5,
    borderStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginTop: 12, marginBottom: 14 },
  memoNumber: { fontSize: 9, color: MUTED, fontFamily: 'Helvetica-Bold' },
  subject: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 12 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  metaItem: { width: '50%', flexDirection: 'row', marginBottom: 4 },
  metaLabel: { width: 90, color: MUTED },
  metaValue: { flex: 1 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: MUTED,
    marginBottom: 6,
    marginTop: 16,
  },
  paragraph: { marginBottom: 6, lineHeight: 1.5 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingVertical: 5,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 2,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', color: MUTED },
  colPosition: { width: 24 },
  colName: { width: 130 },
  colAction: { width: 90 },
  colWhen: { flex: 1 },
  actionLabel: { fontFamily: 'Helvetica-Bold' },
  commentBlock: { marginTop: 2, marginLeft: 154, color: MUTED, fontSize: 9, lineHeight: 1.4 },
  commentRow: { marginBottom: 8 },
  commentHeader: { flexDirection: 'row', gap: 6 },
  commentAuthor: { fontFamily: 'Helvetica-Bold' },
  commentTime: { color: MUTED, fontSize: 8 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 6,
  },
  emptyNote: { color: MUTED, fontStyle: 'italic' },
})

function formatDateTime(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const PRIORITY_LABEL: Record<Priority, string> = { NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' }

export interface MemoPdfData {
  organizationName: string
  memoNumber: string
  subject: string
  bodyHtml: string
  status: MemoStatus
  priority: Priority
  authorName: string
  authorDesignation: string | null
  departmentName: string | null
  categoryName: string | null
  createdAt: Date
  submittedAt: Date | null
  completedAt: Date | null
  finalApproverName: string | null
  steps: {
    position: number
    positionLabel: string | null
    assigneeName: string
    action: StepActionType | null
    actionAt: Date | null
    comment: string | null
  }[]
  comments: { authorName: string; text: string; createdAt: Date }[]
  attachments: { fileName: string; sizeBytes: number; uploaderName: string }[]
  exportedAt: Date
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function MemoPdfDocument(data: MemoPdfData) {
  const paragraphs = toParagraphs(data.bodyHtml)

  return (
    <Document title={data.memoNumber + ' — ' + data.subject}>
      <Page size="A4" style={styles.page}>
        <View style={styles.orgRow}>
          <View>
            <Text style={styles.orgName}>{data.organizationName}</Text>
            <Text style={styles.formCode}>Inter-office memo</Text>
          </View>
          <View style={[styles.stamp, { borderColor: STATUS_COLOR[data.status], color: STATUS_COLOR[data.status] }]}>
            <Text>{STATUS_LABEL[data.status]}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <Text style={styles.memoNumber}>{data.memoNumber}</Text>
        <Text style={styles.subject}>{data.subject}</Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>From</Text>
            <Text style={styles.metaValue}>
              {data.authorName}
              {data.authorDesignation ? ', ' + data.authorDesignation : ''}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Priority</Text>
            <Text style={styles.metaValue}>{PRIORITY_LABEL[data.priority]}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Department</Text>
            <Text style={styles.metaValue}>{data.departmentName ?? 'Not specified'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{data.categoryName ?? 'Not specified'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Raised</Text>
            <Text style={styles.metaValue}>{formatDateTime(data.createdAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>{formatDateTime(data.submittedAt)}</Text>
          </View>
          {data.completedAt ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Closed</Text>
              <Text style={styles.metaValue}>{formatDateTime(data.completedAt)}</Text>
            </View>
          ) : null}
          {data.finalApproverName ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Final approver</Text>
              <Text style={styles.metaValue}>{data.finalApproverName}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Memo</Text>
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyNote}>No body text.</Text>
        )}

        {data.attachments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Attachments</Text>
            {data.attachments.map((a, i) => (
              <Text key={i} style={styles.paragraph}>
                {a.fileName} — {fileSize(a.sizeBytes)} — uploaded by {a.uploaderName}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Workflow participants and approval history</Text>
        {data.steps.length > 0 ? (
          <View>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colPosition]}>#</Text>
              <Text style={[styles.th, styles.colName]}>Participant</Text>
              <Text style={[styles.th, styles.colAction]}>Decision</Text>
              <Text style={[styles.th, styles.colWhen]}>When</Text>
            </View>
            {data.steps.map((s, i) => (
              <View key={i}>
                <View style={styles.tableRow}>
                  <Text style={styles.colPosition}>{String(s.position).padStart(2, '0')}</Text>
                  <Text style={styles.colName}>
                    {s.assigneeName}
                    {s.positionLabel ? '\n' + s.positionLabel : ''}
                  </Text>
                  <Text
                    style={[
                      styles.colAction,
                      styles.actionLabel,
                      s.action
                        ? {
                            color:
                              s.action === 'APPROVE' || s.action === 'REVIEW_COMPLETE'
                                ? SEAL
                                : s.action === 'REJECT'
                                  ? STAMP
                                  : s.action === 'REQUEST_CHANGES'
                                    ? PENDING
                                    : INK,
                          }
                        : { color: MUTED },
                    ]}
                  >
                    {s.action ? ACTION_LABEL[s.action] : 'Awaiting'}
                  </Text>
                  <Text style={styles.colWhen}>{s.actionAt ? formatDateTime(s.actionAt) : '—'}</Text>
                </View>
                {s.comment ? (
                  <Text style={styles.commentBlock}>{'"' + s.comment + '"'}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyNote}>This memo has not been submitted into a workflow.</Text>
        )}

        {data.comments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Comments</Text>
            {data.comments.map((c, i) => (
              <View key={i} style={styles.commentRow}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{c.authorName}</Text>
                  <Text style={styles.commentTime}>{formatDateTime(c.createdAt)}</Text>
                </View>
                <Text>{c.text}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {data.memoNumber} — exported {formatDateTime(data.exportedAt)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => pageNumber + ' / ' + totalPages} />
        </View>
      </Page>
    </Document>
  )
}
