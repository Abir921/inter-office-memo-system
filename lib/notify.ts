// lib/notify.ts
//
// In-app notifications. Written inside the same transaction as the event that
// caused them, so a user is never told about a change that was rolled back.

import { NotificationType, Prisma, PrismaClient } from '@prisma/client'

type Db = Prisma.TransactionClient | PrismaClient

export interface NotificationInput {
  organizationId: string
  userId: string
  memoId?: string | null
  type: NotificationType
  title: string
  message: string
}

export async function pushNotifications(
  db: Db,
  notifications: NotificationInput[],
): Promise<void> {
  if (notifications.length === 0) return

  await db.notification.createMany({
    data: notifications.map((n) => ({
      organizationId: n.organizationId,
      userId: n.userId,
      memoId: n.memoId ?? null,
      type: n.type,
      title: n.title,
      message: n.message,
    })),
  })
}

export async function countUnread(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<number> {
  return db.notification.count({
    where: { organizationId, userId, isRead: false },
  })
}

export async function markRead(
  db: Db,
  organizationId: string,
  userId: string,
  notificationId?: string,
): Promise<number> {
  const result = await db.notification.updateMany({
    // Scoped by BOTH organization and user: a notification id from another
    // tenant matches nothing.
    where: {
      organizationId,
      userId,
      isRead: false,
      ...(notificationId ? { id: notificationId } : {}),
    },
    data: { isRead: true, readAt: new Date() },
  })

  return result.count
}
