import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

export type NotificationType =
  | 'APPLICATION_REVIEWED'
  | 'APPLICATION_REJECTED'
  | 'REGISTRATION_APPROVED'
  | 'REGISTRATION_REJECTED'
  | 'NEW_ASSIGNMENT'
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED'
  | 'ORDER_STATUS_CHANGE'
  | 'TIER_CHANGED'
  | 'LATE_AVAILABILITY_WARNING'
  | 'MISSED_DELIVERY_WARNING'
  | 'DELIVERY_REMINDER'
  | 'STANDING_ORDER_GENERATED';

export interface CreateNotificationData {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an in-app notification for a user.
 */
export async function createNotification(data: CreateNotificationData) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata ? (data.metadata as object) : undefined,
    },
  });
}

/**
 * List notifications for a user (newest first).
 */
export async function listNotificationsByUser(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  const limit = options?.limit ?? 50;
  const where: { userId: string; isRead?: boolean } = { userId };
  if (options?.unreadOnly) where.isRead = false;

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Count unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Mark a single notification as read (only if it belongs to the user).
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
) {
  const updated = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  if (updated.count === 0) {
    throw createError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }
  return prisma.notification.findUnique({
    where: { id: notificationId },
  });
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId },
    data: { isRead: true },
  });
  return { success: true };
}
