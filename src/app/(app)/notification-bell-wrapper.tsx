'use client';

import { NotificationBell } from './notification-bell';
import { NotificationDropdown } from './notification-dropdown';
import { useNotifications } from './use-notifications';

/**
 * Wrapper component that integrates NotificationBell with NotificationDropdown
 * and the useNotifications hook for state management.
 *
 * @returns The integrated notification bell component
 */
export function NotificationBellWrapper() {
  const {
    notifications,
    unreadCount,
    loading,
    isPending,
    fetchNotifications,
    handleNotificationClick,
    handleMarkAllRead,
  } = useNotifications();

  const handleOpenChange = (open: boolean) => {
    if (open) {
      fetchNotifications();
    }
  };

  return (
    <NotificationBell unreadCount={unreadCount} onOpenChange={handleOpenChange}>
      <NotificationDropdown
        notifications={notifications}
        loading={loading}
        isPending={isPending}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllRead}
      />
    </NotificationBell>
  );
}
