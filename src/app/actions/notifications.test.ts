import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Mock next/cache
mock.module('next/cache', () => ({
  revalidatePath: mock(() => {}),
}));

// Mock session module
const mockGetSession = mock(() =>
  Promise.resolve({ userId: 'user-1', tenantId: 'tenant-1' }),
);
mock.module('@/lib/session', () => ({
  getSession: mockGetSession,
}));

// Import after mocking
const {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} = await import('./notifications');

describe('notifications', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let otherUser: { id: string };
  let testTodo: { id: string };

  beforeEach(async () => {
    // Create test tenant and users
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Notifications' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `notification-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `notification-other-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Notifications',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    // Clean up in order (respect FK constraints)
    await prisma.notification.deleteMany({
      where: { userId: { in: [testUser.id, otherUser.id] } },
    });
    await prisma.todo.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.session.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.user.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenant.id },
    });
  });

  describe('createNotification', () => {
    test('creates notification with correct fields', async () => {
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'You were assigned to "Test Todo"',
        todoId: testTodo.id,
      });

      const notification = await prisma.notification.findFirst({
        where: { userId: testUser.id },
      });

      expect(notification).toBeDefined();
      expect(notification?.type).toBe(NotificationType.TODO_ASSIGNED);
      expect(notification?.message).toBe('You were assigned to "Test Todo"');
      expect(notification?.todoId).toBe(testTodo.id);
      expect(notification?.isRead).toBe(false);
      expect(notification?.createdAt).toBeInstanceOf(Date);
    });

    test('creates notification without todoId', async () => {
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_COMMENTED,
        message: 'Someone commented on your todo',
      });

      const notification = await prisma.notification.findFirst({
        where: { userId: testUser.id },
      });

      expect(notification).toBeDefined();
      expect(notification?.todoId).toBeNull();
    });
  });

  describe('getNotifications', () => {
    test('returns empty array when not authenticated', async () => {
      mockGetSession.mockImplementation(() => Promise.resolve(null));

      const result = await getNotifications();

      expect(result.notifications).toEqual([]);
      expect(result.error).toBe('Not authenticated');
    });

    test('returns only current user notifications', async () => {
      // Create notifications for test user
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Notification for test user',
        todoId: testTodo.id,
      });
      // Create notification for other user
      await createNotification({
        userId: otherUser.id,
        type: NotificationType.TODO_COMMENTED,
        message: 'Notification for other user',
        todoId: testTodo.id,
      });

      const result = await getNotifications();

      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].message).toBe(
        'Notification for test user',
      );
    });

    test('returns notifications ordered by createdAt desc', async () => {
      // Create notifications with slight delay to ensure order
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'First notification',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_COMMENTED,
        message: 'Second notification',
      });

      const result = await getNotifications();

      expect(result.notifications.length).toBe(2);
      expect(result.notifications[0].message).toBe('Second notification');
      expect(result.notifications[1].message).toBe('First notification');
    });

    test('respects limit parameter', async () => {
      // Create 5 notifications
      for (let i = 0; i < 5; i++) {
        await createNotification({
          userId: testUser.id,
          type: NotificationType.TODO_ASSIGNED,
          message: `Notification ${i}`,
        });
      }

      const result = await getNotifications(3);

      expect(result.notifications.length).toBe(3);
    });

    test('defaults to 20 notifications', async () => {
      // Create 25 notifications
      for (let i = 0; i < 25; i++) {
        await createNotification({
          userId: testUser.id,
          type: NotificationType.TODO_ASSIGNED,
          message: `Notification ${i}`,
        });
      }

      const result = await getNotifications();

      expect(result.notifications.length).toBe(20);
    });

    test('returns correct notification fields', async () => {
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Test notification',
        todoId: testTodo.id,
      });

      const result = await getNotifications();

      expect(result.notifications[0]).toHaveProperty('id');
      expect(result.notifications[0]).toHaveProperty('type');
      expect(result.notifications[0]).toHaveProperty('message');
      expect(result.notifications[0]).toHaveProperty('todoId');
      expect(result.notifications[0]).toHaveProperty('isRead');
      expect(result.notifications[0]).toHaveProperty('createdAt');
    });
  });

  describe('getUnreadNotificationCount', () => {
    test('returns 0 when not authenticated', async () => {
      mockGetSession.mockImplementation(() => Promise.resolve(null));

      const count = await getUnreadNotificationCount();

      expect(count).toBe(0);
    });

    test('returns count of unread notifications only', async () => {
      // Create 3 unread notifications
      for (let i = 0; i < 3; i++) {
        await createNotification({
          userId: testUser.id,
          type: NotificationType.TODO_ASSIGNED,
          message: `Unread ${i}`,
        });
      }
      // Create 1 read notification
      const readNotification = await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: NotificationType.TODO_COMMENTED,
          message: 'Read notification',
          isRead: true,
        },
      });

      const count = await getUnreadNotificationCount();

      expect(count).toBe(3);

      // Clean up the directly created notification
      await prisma.notification.delete({ where: { id: readNotification.id } });
    });

    test('counts only current user notifications', async () => {
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Test user notification',
      });
      await createNotification({
        userId: otherUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Other user notification',
      });

      const count = await getUnreadNotificationCount();

      expect(count).toBe(1);
    });
  });

  describe('markNotificationRead', () => {
    test('returns error when not authenticated', async () => {
      mockGetSession.mockImplementation(() => Promise.resolve(null));

      const result = await markNotificationRead('some-id');

      expect(result.error).toBe('Not authenticated');
      expect(result.success).toBeUndefined();
    });

    test('returns error when notification does not exist', async () => {
      const result = await markNotificationRead('nonexistent-id');

      expect(result.error).toBe('Notification not found');
      expect(result.success).toBeUndefined();
    });

    test('returns error when notification belongs to different user', async () => {
      // Create notification for other user
      const otherNotification = await prisma.notification.create({
        data: {
          userId: otherUser.id,
          type: NotificationType.TODO_ASSIGNED,
          message: 'Other user notification',
          isRead: false,
        },
      });

      const result = await markNotificationRead(otherNotification.id);

      expect(result.error).toBe('Notification not found');
      expect(result.success).toBeUndefined();

      // Clean up
      await prisma.notification.delete({ where: { id: otherNotification.id } });
    });

    test('marks notification as read successfully', async () => {
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Test notification',
      });

      const notification = await prisma.notification.findFirstOrThrow({
        where: { userId: testUser.id },
      });

      const result = await markNotificationRead(notification.id);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify notification is now read
      const updated = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(updated?.isRead).toBe(true);
    });

    test('succeeds even if notification already read', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: NotificationType.TODO_ASSIGNED,
          message: 'Already read notification',
          isRead: true,
        },
      });

      const result = await markNotificationRead(notification.id);

      expect(result.success).toBe(true);
    });
  });

  describe('markAllNotificationsRead', () => {
    test('returns error when not authenticated', async () => {
      mockGetSession.mockImplementation(() => Promise.resolve(null));

      const result = await markAllNotificationsRead();

      expect(result.error).toBe('Not authenticated');
      expect(result.success).toBeUndefined();
    });

    test('marks all user notifications as read', async () => {
      // Create multiple unread notifications
      for (let i = 0; i < 3; i++) {
        await createNotification({
          userId: testUser.id,
          type: NotificationType.TODO_ASSIGNED,
          message: `Notification ${i}`,
        });
      }

      const result = await markAllNotificationsRead();

      expect(result.success).toBe(true);

      // Verify all notifications are read
      const unreadCount = await prisma.notification.count({
        where: { userId: testUser.id, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });

    test('does not affect other user notifications', async () => {
      // Create notification for test user
      await createNotification({
        userId: testUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Test user notification',
      });
      // Create notification for other user
      await createNotification({
        userId: otherUser.id,
        type: NotificationType.TODO_ASSIGNED,
        message: 'Other user notification',
      });

      await markAllNotificationsRead();

      // Other user's notification should still be unread
      const otherUnread = await prisma.notification.count({
        where: { userId: otherUser.id, isRead: false },
      });
      expect(otherUnread).toBe(1);
    });

    test('succeeds even when no unread notifications exist', async () => {
      const result = await markAllNotificationsRead();

      expect(result.success).toBe(true);
    });
  });
});
