import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { NotificationType } from '@prisma/client';
import type { NotificationData } from './notification-dropdown';
import {
  createMarkAllReadHandler,
  createNotificationClickHandler,
  getNavigationUrl,
} from './use-notifications';

describe('createNotificationClickHandler', () => {
  const mockPush = mock(() => {});
  const mockMarkRead = mock(() => Promise.resolve({ success: true }));

  beforeEach(() => {
    mockPush.mockClear();
    mockMarkRead.mockClear();
  });

  const createNotification = (
    overrides: Partial<NotificationData> = {},
  ): NotificationData => ({
    id: 'notif-1',
    type: 'TODO_ASSIGNED' as NotificationType,
    message: 'Test notification',
    todoId: 'todo-1',
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  });

  test('marks notification as read when clicked', async () => {
    const notification = createNotification({ id: 'notif-123' });
    const handler = createNotificationClickHandler(
      mockPush,
      () => Promise.resolve(),
      mockMarkRead,
    );

    await handler(notification);

    expect(mockMarkRead).toHaveBeenCalledWith('notif-123');
  });

  test('navigates to todo with highlight param when todoId exists', async () => {
    const notification = createNotification({ todoId: 'todo-456' });
    const handler = createNotificationClickHandler(
      mockPush,
      () => Promise.resolve(),
      mockMarkRead,
    );

    await handler(notification);

    expect(mockPush).toHaveBeenCalledWith('/todos?highlight=todo-456');
  });

  test('does not navigate when todoId is null (deleted todo)', async () => {
    const notification = createNotification({ todoId: null });
    const handler = createNotificationClickHandler(
      mockPush,
      () => Promise.resolve(),
      mockMarkRead,
    );

    await handler(notification);

    expect(mockMarkRead).toHaveBeenCalledWith('notif-1');
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('calls onComplete callback after handling notification', async () => {
    const notification = createNotification();
    const mockOnComplete = mock(() => Promise.resolve());
    const handler = createNotificationClickHandler(
      mockPush,
      mockOnComplete,
      mockMarkRead,
    );

    await handler(notification);

    expect(mockOnComplete).toHaveBeenCalled();
  });
});

describe('createMarkAllReadHandler', () => {
  const mockMarkAllRead = mock(() => Promise.resolve({ success: true }));

  beforeEach(() => {
    mockMarkAllRead.mockClear();
  });

  test('calls markAllNotificationsRead action', async () => {
    const mockOnComplete = mock(() => Promise.resolve());
    const handler = createMarkAllReadHandler(mockOnComplete, mockMarkAllRead);

    await handler();

    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  test('calls onComplete callback after marking all as read', async () => {
    const mockOnComplete = mock(() => Promise.resolve());
    const handler = createMarkAllReadHandler(mockOnComplete, mockMarkAllRead);

    await handler();

    expect(mockOnComplete).toHaveBeenCalled();
  });
});

describe('getNavigationUrl', () => {
  test('returns URL with highlight param for valid todoId', () => {
    expect(getNavigationUrl('todo-123')).toBe('/todos?highlight=todo-123');
  });

  test('returns null for null todoId', () => {
    expect(getNavigationUrl(null)).toBeNull();
  });

  test('returns null for empty string todoId', () => {
    expect(getNavigationUrl('')).toBeNull();
  });
});
