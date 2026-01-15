import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
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
const { createTodoActivity, getTodoActivities } = await import('./activities');

describe('createTodoActivity', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let testTodo: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Activities' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `activity-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Activities',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });
  });

  afterEach(async () => {
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenant.id } },
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

  test('creates CREATED activity with correct fields', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'CREATED',
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('CREATED');
    expect(activity?.actorId).toBe(testUser.id);
    expect(activity?.todoId).toBe(testTodo.id);
    expect(activity?.field).toBeNull();
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });

  test('creates STATUS_CHANGED activity with old and new values', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'STATUS_CHANGED',
      field: 'status',
      oldValue: 'PENDING',
      newValue: 'COMPLETED',
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('STATUS_CHANGED');
    expect(activity?.field).toBe('status');
    expect(activity?.oldValue).toBe('PENDING');
    expect(activity?.newValue).toBe('COMPLETED');
  });

  test('creates ASSIGNEE_CHANGED activity', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'ASSIGNEE_CHANGED',
      field: 'assigneeId',
      oldValue: null,
      newValue: 'user-2',
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('ASSIGNEE_CHANGED');
    expect(activity?.field).toBe('assigneeId');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBe('user-2');
  });

  test('creates DUE_DATE_CHANGED activity', async () => {
    const oldDate = '2024-01-15T00:00:00.000Z';
    const newDate = '2024-01-20T00:00:00.000Z';

    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'DUE_DATE_CHANGED',
      field: 'dueDate',
      oldValue: oldDate,
      newValue: newDate,
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('DUE_DATE_CHANGED');
    expect(activity?.field).toBe('dueDate');
    expect(activity?.oldValue).toBe(oldDate);
    expect(activity?.newValue).toBe(newDate);
  });

  test('creates LABELS_CHANGED activity for adding label', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'LABELS_CHANGED',
      field: 'labels',
      oldValue: null,
      newValue: 'urgent',
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('LABELS_CHANGED');
    expect(activity?.field).toBe('labels');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBe('urgent');
  });

  test('creates LABELS_CHANGED activity for removing label', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'LABELS_CHANGED',
      field: 'labels',
      oldValue: 'urgent',
      newValue: null,
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('LABELS_CHANGED');
    expect(activity?.oldValue).toBe('urgent');
    expect(activity?.newValue).toBeNull();
  });

  test('creates DESCRIPTION_CHANGED activity without storing content', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'DESCRIPTION_CHANGED',
      field: 'description',
      oldValue: null,
      newValue: null,
    });

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('DESCRIPTION_CHANGED');
    expect(activity?.field).toBe('description');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });
});

describe('getTodoActivities', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let testTodo: { id: string };
  let otherTenant: { id: string };
  let otherUser: { id: string };
  let otherTodo: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Get Activities' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `get-activity-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Get Activities',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });

    // Create other tenant for isolation tests
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Get Activities' },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `other-get-activity-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: otherTenant.id,
      },
    });
    otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo for Get Activities',
        tenantId: otherTenant.id,
        createdById: otherUser.id,
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
    });
    await prisma.todo.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.session.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [testTenant.id, otherTenant.id] } },
    });
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await getTodoActivities(testTodo.id);

    expect(result.error).toBe('Not authenticated');
    expect(result.activities).toEqual([]);
  });

  test('returns error when todo belongs to different tenant', async () => {
    const result = await getTodoActivities(otherTodo.id);

    expect(result.error).toBe('Todo not found');
    expect(result.activities).toEqual([]);
  });

  test('returns error when todo does not exist', async () => {
    const result = await getTodoActivities('nonexistent-todo-id');

    expect(result.error).toBe('Todo not found');
    expect(result.activities).toEqual([]);
  });

  test('returns activities for todo with actor email', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'CREATED',
    });

    const result = await getTodoActivities(testTodo.id);

    expect(result.error).toBeUndefined();
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].action).toBe('CREATED');
    expect(result.activities[0].actorId).toBe(testUser.id);
    expect(result.activities[0].actorEmail).toContain('get-activity-test');
  });

  test('returns activities ordered by createdAt desc (newest first)', async () => {
    // Create activities with slight delays to ensure order
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'CREATED',
    });

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'STATUS_CHANGED',
      field: 'status',
      oldValue: 'PENDING',
      newValue: 'COMPLETED',
    });

    const result = await getTodoActivities(testTodo.id);

    expect(result.activities).toHaveLength(2);
    // Newest first
    expect(result.activities[0].action).toBe('STATUS_CHANGED');
    expect(result.activities[1].action).toBe('CREATED');
  });

  test('returns activities with all required fields', async () => {
    await createTodoActivity({
      todoId: testTodo.id,
      actorId: testUser.id,
      action: 'DUE_DATE_CHANGED',
      field: 'dueDate',
      oldValue: '2024-01-15',
      newValue: '2024-01-20',
    });

    const result = await getTodoActivities(testTodo.id);

    expect(result.activities).toHaveLength(1);
    const activity = result.activities[0];
    expect(activity.id).toBeDefined();
    expect(activity.actorId).toBe(testUser.id);
    expect(activity.actorEmail).toBeDefined();
    expect(activity.action).toBe('DUE_DATE_CHANGED');
    expect(activity.field).toBe('dueDate');
    expect(activity.oldValue).toBe('2024-01-15');
    expect(activity.newValue).toBe('2024-01-20');
    expect(activity.createdAt).toBeInstanceOf(Date);
  });

  test('returns empty array when todo has no activities', async () => {
    const result = await getTodoActivities(testTodo.id);

    expect(result.error).toBeUndefined();
    expect(result.activities).toEqual([]);
  });
});
