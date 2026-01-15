import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NotificationBellWrapper } from './notification-bell-wrapper';

// Mock the useNotifications hook
const mockFetchNotifications = mock(() => Promise.resolve());
const mockHandleNotificationClick = mock(() => Promise.resolve());
const mockHandleMarkAllRead = mock(() => Promise.resolve());

let mockNotifications: Array<{
  id: string;
  type: 'TODO_ASSIGNED' | 'TODO_COMMENTED';
  message: string;
  todoId: string | null;
  isRead: boolean;
  createdAt: Date;
}> = [];
let mockUnreadCount = 0;
let mockLoading = false;
let mockIsPending = false;

mock.module('./use-notifications', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: mockUnreadCount,
    loading: mockLoading,
    isPending: mockIsPending,
    fetchNotifications: mockFetchNotifications,
    handleNotificationClick: mockHandleNotificationClick,
    handleMarkAllRead: mockHandleMarkAllRead,
  }),
}));

describe('NotificationBellWrapper', () => {
  beforeEach(() => {
    mockNotifications = [];
    mockUnreadCount = 0;
    mockLoading = false;
    mockIsPending = false;
    mockFetchNotifications.mockClear();
    mockHandleNotificationClick.mockClear();
    mockHandleMarkAllRead.mockClear();
  });

  test('renders component', () => {
    const result = NotificationBellWrapper();
    expect(result).toBeDefined();
  });

  test('returns NotificationBell component structure', () => {
    const result = NotificationBellWrapper();
    expect(result?.type).toBeDefined();
  });

  test('passes unreadCount to NotificationBell', () => {
    mockUnreadCount = 5;
    const result = NotificationBellWrapper();
    expect(result?.props?.unreadCount).toBe(5);
  });

  test('passes onOpenChange handler to NotificationBell', () => {
    const result = NotificationBellWrapper();
    expect(result?.props?.onOpenChange).toBeDefined();
    expect(typeof result?.props?.onOpenChange).toBe('function');
  });

  test('passes NotificationDropdown as children', () => {
    const result = NotificationBellWrapper();
    expect(result?.props?.children).toBeDefined();
  });

  test('onOpenChange fetches notifications when opened', async () => {
    const result = NotificationBellWrapper();
    const onOpenChange = result?.props?.onOpenChange;

    await onOpenChange(true);
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
  });

  test('onOpenChange does not fetch when closed', async () => {
    const result = NotificationBellWrapper();
    const onOpenChange = result?.props?.onOpenChange;

    await onOpenChange(false);
    expect(mockFetchNotifications).not.toHaveBeenCalled();
  });

  test('passes notifications to dropdown', () => {
    const testNotification = {
      id: '1',
      type: 'TODO_ASSIGNED' as const,
      message: 'Test',
      todoId: 'todo-1',
      isRead: false,
      createdAt: new Date(),
    };
    mockNotifications = [testNotification];

    const result = NotificationBellWrapper();
    const dropdown = result?.props?.children;
    expect(dropdown?.props?.notifications).toEqual([testNotification]);
  });

  test('passes loading state to dropdown', () => {
    mockLoading = true;
    const result = NotificationBellWrapper();
    const dropdown = result?.props?.children;
    expect(dropdown?.props?.loading).toBe(true);
  });

  test('passes isPending state to dropdown', () => {
    mockIsPending = true;
    const result = NotificationBellWrapper();
    const dropdown = result?.props?.children;
    expect(dropdown?.props?.isPending).toBe(true);
  });

  test('passes onNotificationClick to dropdown', () => {
    const result = NotificationBellWrapper();
    const dropdown = result?.props?.children;
    expect(dropdown?.props?.onNotificationClick).toBe(
      mockHandleNotificationClick,
    );
  });

  test('passes onMarkAllRead to dropdown', () => {
    const result = NotificationBellWrapper();
    const dropdown = result?.props?.children;
    expect(dropdown?.props?.onMarkAllRead).toBe(mockHandleMarkAllRead);
  });
});
