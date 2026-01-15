import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { prisma } from '@/lib/prisma';

describe('Notification model', () => {
  const testTenantId = `tenant-notification-${Date.now()}`;
  const testUserId = `user-notification-${Date.now()}`;
  const testTodoId = `todo-notification-${Date.now()}`;

  beforeEach(async () => {
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `notification-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    await prisma.todo.create({
      data: {
        id: testTodoId,
        title: 'Test Todo',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  describe('creation', () => {
    test('can create notification with TODO_ASSIGNED type', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'You have been assigned to a todo',
          todoId: testTodoId,
        },
      });

      expect(notification.id).toBeDefined();
      expect(notification.type).toBe('TODO_ASSIGNED');
      expect(notification.message).toBe('You have been assigned to a todo');
      expect(notification.todoId).toBe(testTodoId);
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    test('can create notification with TODO_COMMENTED type', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_COMMENTED',
          message: 'Someone commented on your todo',
          todoId: testTodoId,
        },
      });

      expect(notification.type).toBe('TODO_COMMENTED');
    });

    test('can create notification without todoId (nullable)', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'General notification',
        },
      });

      expect(notification.todoId).toBeNull();
    });

    test('isRead defaults to false', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
        },
      });

      expect(notification.isRead).toBe(false);
    });
  });

  describe('relations', () => {
    test('notification includes user relation', async () => {
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
        },
      });

      const notification = await prisma.notification.findFirst({
        where: { userId: testUserId },
        include: { user: true },
      });

      expect(notification?.user).toBeDefined();
      expect(notification?.user.id).toBe(testUserId);
    });

    test('notification includes todo relation', async () => {
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
          todoId: testTodoId,
        },
      });

      const notification = await prisma.notification.findFirst({
        where: { userId: testUserId },
        include: { todo: true },
      });

      expect(notification?.todo).toBeDefined();
      expect(notification?.todo?.id).toBe(testTodoId);
    });

    test('user includes notifications relation', async () => {
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        include: { notifications: true },
      });

      expect(user?.notifications).toBeDefined();
      expect(user?.notifications.length).toBe(1);
    });

    test('todo includes notifications relation', async () => {
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
          todoId: testTodoId,
        },
      });

      const todo = await prisma.todo.findUnique({
        where: { id: testTodoId },
        include: { notifications: true },
      });

      expect(todo?.notifications).toBeDefined();
      expect(todo?.notifications.length).toBe(1);
    });
  });

  describe('cascade delete behavior', () => {
    test('deleting user cascades to notifications', async () => {
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
        },
      });

      // Verify notification exists
      const beforeDelete = await prisma.notification.findFirst({
        where: { userId: testUserId },
      });
      expect(beforeDelete).not.toBeNull();

      // Delete user (need to clean up other relations first)
      await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.user.delete({ where: { id: testUserId } });

      // Verify notification was cascade deleted
      const afterDelete = await prisma.notification.findFirst({
        where: { userId: testUserId },
      });
      expect(afterDelete).toBeNull();

      // Recreate user for cleanup in afterEach
      await prisma.user.create({
        data: {
          id: testUserId,
          email: `notification-recreate-${Date.now()}@example.com`,
          passwordHash: 'hashed',
          role: 'ADMIN',
          tenantId: testTenantId,
        },
      });
    });

    test('deleting todo sets notification todoId to null', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Test message',
          todoId: testTodoId,
        },
      });

      // Verify todoId is set
      expect(notification.todoId).toBe(testTodoId);

      // Delete todo
      await prisma.todo.delete({ where: { id: testTodoId } });

      // Verify notification still exists but todoId is null
      const afterDelete = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(afterDelete).not.toBeNull();
      expect(afterDelete?.todoId).toBeNull();

      // Recreate todo for cleanup in afterEach
      await prisma.todo.create({
        data: {
          id: testTodoId,
          title: 'Test Todo',
          tenantId: testTenantId,
          createdById: testUserId,
        },
      });
    });
  });

  describe('indexes', () => {
    test('can efficiently query unread notifications for user', async () => {
      // Create multiple notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'TODO_ASSIGNED',
            message: 'Unread 1',
            isRead: false,
          },
          {
            userId: testUserId,
            type: 'TODO_COMMENTED',
            message: 'Read 1',
            isRead: true,
          },
          {
            userId: testUserId,
            type: 'TODO_ASSIGNED',
            message: 'Unread 2',
            isRead: false,
          },
        ],
      });

      // Query uses index on (userId, isRead)
      const unreadNotifications = await prisma.notification.findMany({
        where: {
          userId: testUserId,
          isRead: false,
        },
      });

      expect(unreadNotifications.length).toBe(2);
    });

    test('can efficiently query notifications ordered by createdAt', async () => {
      // Create notifications with slight time differences
      const n1 = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'First',
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      const n2 = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'TODO_ASSIGNED',
          message: 'Second',
        },
      });

      // Query uses index on (userId, createdAt)
      const notifications = await prisma.notification.findMany({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' },
      });

      expect(notifications.length).toBe(2);
      expect(notifications[0].id).toBe(n2.id);
      expect(notifications[1].id).toBe(n1.id);
    });
  });
});
