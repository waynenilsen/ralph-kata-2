'use client';

import type { NotificationType } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Notification data structure for display in the dropdown.
 */
export interface NotificationData {
  id: string;
  type: NotificationType;
  message: string;
  todoId: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Props for the NotificationDropdown component.
 */
export interface NotificationDropdownProps {
  /** List of notifications to display */
  notifications: NotificationData[];
  /** Whether notifications are loading */
  loading: boolean;
  /** Whether a transition is pending */
  isPending: boolean;
  /** Callback when a notification is clicked */
  onNotificationClick: (notification: NotificationData) => void;
  /** Callback when "Mark all read" is clicked */
  onMarkAllRead: () => void;
}

/**
 * Returns the appropriate icon for a notification type.
 *
 * @param type - The notification type
 * @returns The icon element
 */
export function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'TODO_ASSIGNED':
      return <User className="h-4 w-4" />;
    case 'TODO_COMMENTED':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return null;
  }
}

/**
 * Formats a date to a relative time string.
 *
 * @param date - The date to format
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * NotificationDropdown displays a list of notifications with loading,
 * empty, and populated states.
 *
 * @param props - Component props
 * @returns The NotificationDropdown component
 */
export function NotificationDropdown({
  notifications,
  loading,
  isPending,
  onNotificationClick,
  onMarkAllRead,
}: NotificationDropdownProps) {
  const hasUnread = notifications.some((n) => !n.isRead);

  if (loading) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            disabled={isPending}
          >
            Mark all read
          </Button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => onNotificationClick(notification)}
              className={`w-full flex items-start gap-3 p-3 hover:bg-muted text-left transition-colors ${
                !notification.isRead ? 'bg-muted/50' : ''
              }`}
              disabled={isPending}
              type="button"
            >
              <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${!notification.isRead ? 'font-medium' : ''}`}
                >
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(new Date(notification.createdAt))}
                </p>
              </div>
              {!notification.isRead && (
                <div className="flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
