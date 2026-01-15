'use server';

import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export type NotificationActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Creates a notification for a user.
 * This is an internal helper function used by other actions.
 *
 * @param data - The notification data
 * @param data.userId - The recipient user's ID
 * @param data.type - The notification type
 * @param data.message - The notification message
 * @param data.todoId - Optional related todo ID
 */
export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  message: string;
  todoId?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      message: data.message,
      todoId: data.todoId,
      isRead: false,
    },
  });
}

/**
 * Gets notifications for the current user.
 * Returns the most recent notifications ordered by createdAt desc.
 *
 * @param limit - Maximum number of notifications to return (default: 20)
 * @returns Object with notifications array and optional error
 */
export async function getNotifications(limit: number = 20): Promise<{
  notifications: Array<{
    id: string;
    type: NotificationType;
    message: string;
    todoId: string | null;
    isRead: boolean;
    createdAt: Date;
  }>;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { notifications: [], error: 'Not authenticated' };
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      todoId: true,
      isRead: true,
      createdAt: true,
    },
  });

  return { notifications };
}

/**
 * Gets the count of unread notifications for the current user.
 *
 * @returns The count of unread notifications
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getSession();
  if (!session) {
    return 0;
  }

  const count = await prisma.notification.count({
    where: {
      userId: session.userId,
      isRead: false,
    },
  });

  return count;
}

/**
 * Marks a single notification as read.
 * Verifies the notification belongs to the current user.
 *
 * @param notificationId - The ID of the notification to mark as read
 * @returns The result of the operation
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!notification || notification.userId !== session.userId) {
    return { error: 'Notification not found' };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return { success: true };
}

/**
 * Marks all notifications for the current user as read.
 *
 * @returns The result of the operation
 */
export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { success: true };
}
