'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/actions/notifications';
import type { NotificationData } from './notification-dropdown';

/**
 * Return type for the useNotifications hook.
 */
export interface UseNotificationsReturn {
  /** List of notifications */
  notifications: NotificationData[];
  /** Number of unread notifications */
  unreadCount: number;
  /** Whether notifications are being fetched */
  loading: boolean;
  /** Whether an action is pending */
  isPending: boolean;
  /** Fetch notifications */
  fetchNotifications: () => Promise<void>;
  /** Handle notification click - marks as read and navigates */
  handleNotificationClick: (notification: NotificationData) => Promise<void>;
  /** Handle mark all as read */
  handleMarkAllRead: () => Promise<void>;
}

/**
 * Gets the navigation URL for a notification's todo.
 * Returns null if the todo was deleted (todoId is null/empty).
 *
 * @param todoId - The todo ID to navigate to
 * @returns The navigation URL or null
 */
export function getNavigationUrl(todoId: string | null): string | null {
  if (!todoId) {
    return null;
  }
  return `/todos?highlight=${todoId}`;
}

/**
 * Creates a click handler for notifications.
 * Marks the notification as read and navigates to the todo if it exists.
 *
 * @param push - Router push function
 * @param onComplete - Callback after handling completes
 * @param markRead - Function to mark notification as read (for testing)
 * @returns Handler function
 */
export function createNotificationClickHandler(
  push: (url: string) => void,
  onComplete: () => Promise<void>,
  markRead: (id: string) => Promise<unknown> = markNotificationRead,
): (notification: NotificationData) => Promise<void> {
  return async (notification: NotificationData) => {
    await markRead(notification.id);

    const url = getNavigationUrl(notification.todoId);
    if (url) {
      push(url);
    }

    await onComplete();
  };
}

/**
 * Creates a handler for marking all notifications as read.
 *
 * @param onComplete - Callback after marking completes
 * @param markAllRead - Function to mark all notifications as read (for testing)
 * @returns Handler function
 */
export function createMarkAllReadHandler(
  onComplete: () => Promise<void>,
  markAllRead: () => Promise<unknown> = markAllNotificationsRead,
): () => Promise<void> {
  return async () => {
    await markAllRead();
    await onComplete();
  };
}

/**
 * Hook for managing notifications state and actions.
 * Provides notification fetching, click handling with navigation,
 * and mark all as read functionality.
 *
 * @returns Notifications state and handlers
 */
export function useNotifications(): UseNotificationsReturn {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPending] = useTransition();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getNotifications();
      setNotifications(result.notifications);
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const count = await getUnreadNotificationCount();
    setUnreadCount(count);
  }, []);

  const handleNotificationClick = useMemo(
    () => createNotificationClickHandler(router.push, refreshUnreadCount),
    [router.push, refreshUnreadCount],
  );

  const handleMarkAllRead = useMemo(
    () => createMarkAllReadHandler(refreshUnreadCount),
    [refreshUnreadCount],
  );

  return {
    notifications,
    unreadCount,
    loading,
    isPending,
    fetchNotifications,
    handleNotificationClick,
    handleMarkAllRead,
  };
}
