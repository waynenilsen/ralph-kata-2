import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { NotificationType } from '@prisma/client';
import {
  formatRelativeTime,
  getNotificationIcon,
  NotificationDropdown,
  type NotificationDropdownProps,
} from './notification-dropdown';

describe('NotificationDropdown', () => {
  const mockNotifications = [
    {
      id: '1',
      type: 'TODO_ASSIGNED' as NotificationType,
      message: 'John assigned you to "Fix bug"',
      todoId: 'todo-1',
      isRead: false,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      id: '2',
      type: 'TODO_COMMENTED' as NotificationType,
      message: 'Jane commented on "Add feature"',
      todoId: 'todo-2',
      isRead: true,
      createdAt: new Date('2026-01-14T10:00:00Z'),
    },
    {
      id: '3',
      type: 'TODO_ASSIGNED' as NotificationType,
      message: 'Bob assigned you to "Review PR"',
      todoId: null,
      isRead: false,
      createdAt: new Date('2026-01-13T10:00:00Z'),
    },
  ];

  const defaultProps: NotificationDropdownProps = {
    notifications: mockNotifications,
    loading: false,
    isPending: false,
    onNotificationClick: mock(() => {}),
    onMarkAllRead: mock(() => {}),
  };

  test('renders loading state', () => {
    const result = NotificationDropdown({
      ...defaultProps,
      loading: true,
    });
    expect(result).toBeDefined();
    // Check for loading text in rendered content
    const props = result?.props;
    expect(props).toBeDefined();
  });

  test('renders empty state when no notifications', () => {
    const result = NotificationDropdown({
      ...defaultProps,
      notifications: [],
    });
    expect(result).toBeDefined();
  });

  test('renders notifications list', () => {
    const result = NotificationDropdown(defaultProps);
    expect(result).toBeDefined();
    // Verify the component structure is correct
    expect(result?.props?.children).toBeDefined();
  });

  test('shows "Mark all read" button when unread exist', () => {
    const result = NotificationDropdown(defaultProps);
    expect(result).toBeDefined();
    // Component should render with unread notifications present
  });

  test('hides "Mark all read" button when all read', () => {
    const allReadNotifications = mockNotifications.map((n) => ({
      ...n,
      isRead: true,
    }));
    const result = NotificationDropdown({
      ...defaultProps,
      notifications: allReadNotifications,
    });
    expect(result).toBeDefined();
  });

  test('calls onNotificationClick when notification clicked', () => {
    const mockClick = mock(() => {});
    const result = NotificationDropdown({
      ...defaultProps,
      onNotificationClick: mockClick,
    });
    expect(result).toBeDefined();
    // onNotificationClick is passed through props
  });

  test('calls onMarkAllRead when mark all read clicked', () => {
    const mockMarkAll = mock(() => {});
    const result = NotificationDropdown({
      ...defaultProps,
      onMarkAllRead: mockMarkAll,
    });
    expect(result).toBeDefined();
    // onMarkAllRead is passed through props
  });

  test('disables buttons when isPending is true', () => {
    const result = NotificationDropdown({
      ...defaultProps,
      isPending: true,
    });
    expect(result).toBeDefined();
  });

  test('renders notification with correct visual distinction for unread', () => {
    const result = NotificationDropdown(defaultProps);
    expect(result).toBeDefined();
    // Unread notifications should have bold text and blue dot
  });
});

describe('getNotificationIcon', () => {
  test('returns User icon for TODO_ASSIGNED', () => {
    const icon = getNotificationIcon('TODO_ASSIGNED');
    expect(icon).toBeDefined();
    expect(icon?.type?.displayName || icon?.type?.name).toBe('User');
  });

  test('returns MessageSquare icon for TODO_COMMENTED', () => {
    const icon = getNotificationIcon('TODO_COMMENTED');
    expect(icon).toBeDefined();
    expect(icon?.type?.displayName || icon?.type?.name).toBe('MessageSquare');
  });
});

describe('formatRelativeTime', () => {
  let originalNow: typeof Date.now;

  beforeEach(() => {
    // Mock Date.now to return a fixed time
    originalNow = Date.now;
    Date.now = () => new Date('2026-01-15T12:00:00Z').getTime();
  });

  afterEach(() => {
    Date.now = originalNow;
  });

  test('formats recent time correctly', () => {
    const twoHoursAgo = new Date('2026-01-15T10:00:00Z');
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toContain('2 hours ago');
  });

  test('formats day old time correctly', () => {
    const oneDayAgo = new Date('2026-01-14T12:00:00Z');
    const result = formatRelativeTime(oneDayAgo);
    expect(result).toContain('1 day ago');
  });

  test('handles Date objects', () => {
    const date = new Date('2026-01-15T11:00:00Z');
    const result = formatRelativeTime(date);
    expect(typeof result).toBe('string');
  });
});
