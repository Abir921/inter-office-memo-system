-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MemoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StepState" AS ENUM ('PENDING', 'CURRENT', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "StepActionType" AS ENUM ('APPROVE', 'REJECT', 'COMMENT', 'REQUEST_CHANGES', 'REVIEW_COMPLETE');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('GENERAL', 'APPROVAL', 'REJECTION', 'CHANGE_REQUEST');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ACTION_REQUIRED', 'MEMO_APPROVED', 'MEMO_REJECTED', 'CHANGES_REQUESTED', 'COMMENT_ADDED', 'MEMO_RESUBMITTED', 'WORKFLOW_COMPLETED', 'WORKFLOW_ASSIGNED');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_UPDATED', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'ORGANIZATION_UPDATED', 'DEPARTMENT_CREATED', 'DEPARTMENT_UPDATED', 'DEPARTMENT_DEACTIVATED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'TEMPLATE_CREATED', 'TEMPLATE_UPDATED', 'MEMO_CREATED', 'MEMO_MODIFIED', 'MEMO_SUBMITTED', 'MEMO_RESUBMITTED', 'MEMO_CANCELLED', 'WORKFLOW_ASSIGNED', 'WORKFLOW_COMMENT', 'WORKFLOW_APPROVAL', 'WORKFLOW_REJECTION', 'WORKFLOW_CHANGE_REQUEST', 'WORKFLOW_COMPLETED', 'ATTACHMENT_UPLOADED', 'ATTACHMENT_DELETED', 'DELEGATION_CREATED', 'DELEGATION_CANCELLED', 'MEMO_EXPORTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "designation" TEXT,
    "departmentId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatarUrl" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "designation" TEXT,
    "departmentId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "positionLabel" TEXT NOT NULL,
    "defaultDepartmentId" TEXT,

    CONSTRAINT "WorkflowTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MemoSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memoNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "categoryId" TEXT,
    "templateId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "MemoStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStepId" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "submissionCycle" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "finalApproverId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "submissionCycle" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,
    "positionLabel" TEXT,
    "assigneeId" TEXT NOT NULL,
    "state" "StepState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "stepId" TEXT,
    "submissionCycle" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER,
    "action" "StepActionType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actedOnBehalfOfId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "submissionCycle" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "CommentType" NOT NULL DEFAULT 'GENERAL',
    "workflowStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "DelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_tokenHash_key" ON "UserInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvite_organizationId_idx" ON "UserInvite"("organizationId");

-- CreateIndex
CREATE INDEX "MemoCategory_organizationId_idx" ON "MemoCategory"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoCategory_organizationId_name_key" ON "MemoCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_organizationId_idx" ON "WorkflowTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_organizationId_name_key" ON "WorkflowTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "WorkflowTemplateStep_templateId_idx" ON "WorkflowTemplateStep"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplateStep_templateId_position_key" ON "WorkflowTemplateStep"("templateId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MemoSequence_organizationId_year_key" ON "MemoSequence"("organizationId", "year");

-- CreateIndex
CREATE INDEX "Memo_organizationId_status_idx" ON "Memo"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Memo_organizationId_authorId_idx" ON "Memo"("organizationId", "authorId");

-- CreateIndex
CREATE INDEX "Memo_organizationId_departmentId_idx" ON "Memo"("organizationId", "departmentId");

-- CreateIndex
CREATE INDEX "Memo_currentStepId_idx" ON "Memo"("currentStepId");

-- CreateIndex
CREATE INDEX "Memo_organizationId_createdAt_idx" ON "Memo"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Memo_organizationId_memoNumber_key" ON "Memo"("organizationId", "memoNumber");

-- CreateIndex
CREATE INDEX "WorkflowStep_organizationId_assigneeId_state_idx" ON "WorkflowStep"("organizationId", "assigneeId", "state");

-- CreateIndex
CREATE INDEX "WorkflowStep_memoId_idx" ON "WorkflowStep"("memoId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_memoId_submissionCycle_position_key" ON "WorkflowStep"("memoId", "submissionCycle", "position");

-- CreateIndex
CREATE INDEX "WorkflowAction_memoId_createdAt_idx" ON "WorkflowAction"("memoId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowAction_organizationId_idx" ON "WorkflowAction"("organizationId");

-- CreateIndex
CREATE INDEX "MemoVersion_memoId_idx" ON "MemoVersion"("memoId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoVersion_memoId_versionNumber_key" ON "MemoVersion"("memoId", "versionNumber");

-- CreateIndex
CREATE INDEX "Comment_memoId_createdAt_idx" ON "Comment"("memoId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_organizationId_idx" ON "Comment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_memoId_idx" ON "Attachment"("memoId");

-- CreateIndex
CREATE INDEX "Attachment_organizationId_idx" ON "Attachment"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_eventType_idx" ON "AuditLog"("organizationId", "eventType");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Delegation_organizationId_delegatorId_status_idx" ON "Delegation"("organizationId", "delegatorId", "status");

-- CreateIndex
CREATE INDEX "Delegation_delegateId_status_idx" ON "Delegation"("delegateId", "status");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoCategory" ADD CONSTRAINT "MemoCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplateStep" ADD CONSTRAINT "WorkflowTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoSequence" ADD CONSTRAINT "MemoSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MemoCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_finalApproverId_fkey" FOREIGN KEY ("finalApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_actedOnBehalfOfId_fkey" FOREIGN KEY ("actedOnBehalfOfId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
