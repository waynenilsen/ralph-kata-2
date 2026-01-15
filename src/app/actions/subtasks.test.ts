import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { SubtaskActionState } from './subtasks';

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
const { createSubtask, updateSubtask, toggleSubtask, deleteSubtask } =
  await import('./subtasks');

describe('createSubtask', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let otherTenant: { id: string };
  let otherUser: { id: string };
  let testTodo: { id: string };
  let otherTodo: { id: string };

  beforeEach(async () => {
    // Create test tenant and user
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Subtasks' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Subtasks',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });

    // Create other tenant to test isolation
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Subtasks' },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `other-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: otherTenant.id,
      },
    });
    otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo for Subtasks',
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
    // Clean up in order (respect FK constraints)
    await prisma.subtask.deleteMany({
      where: {
        todo: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
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

    const formData = new FormData();
    formData.set('title', 'Test subtask');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when title is empty', async () => {
    const formData = new FormData();
    formData.set('title', '');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask title cannot be empty');
    expect(result.success).toBeUndefined();
  });

  test('returns error when title is only whitespace', async () => {
    const formData = new FormData();
    formData.set('title', '   \n\t  ');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask title cannot be empty');
    expect(result.success).toBeUndefined();
  });

  test('returns error when title exceeds 200 characters', async () => {
    const formData = new FormData();
    formData.set('title', 'a'.repeat(201));

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask title must be 200 characters or less');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo belongs to different tenant', async () => {
    const formData = new FormData();
    formData.set('title', 'Trying to add subtask to another tenant todo');

    const result = await createSubtask(
      otherTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo does not exist', async () => {
    const formData = new FormData();
    formData.set('title', 'Subtask on nonexistent todo');

    const result = await createSubtask(
      'nonexistent-todo-id',
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when max subtask limit reached', async () => {
    // Create 20 subtasks
    for (let i = 0; i < 20; i++) {
      await prisma.subtask.create({
        data: {
          title: `Subtask ${i}`,
          todoId: testTodo.id,
          order: i,
        },
      });
    }

    const formData = new FormData();
    formData.set('title', 'One more subtask');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Maximum 20 subtasks allowed per todo');
    expect(result.success).toBeUndefined();
  });

  test('creates subtask successfully', async () => {
    const formData = new FormData();
    formData.set('title', 'Valid subtask title');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify subtask was created
    const subtask = await prisma.subtask.findFirst({
      where: { todoId: testTodo.id },
    });
    expect(subtask).toBeDefined();
    expect(subtask?.title).toBe('Valid subtask title');
    expect(subtask?.isComplete).toBe(false);
    expect(subtask?.order).toBe(0);
  });

  test('trims whitespace from title', async () => {
    const formData = new FormData();
    formData.set('title', '  Title with whitespace  \n');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.success).toBe(true);

    const subtask = await prisma.subtask.findFirst({
      where: { todoId: testTodo.id },
    });
    expect(subtask?.title).toBe('Title with whitespace');
  });

  test('appends new subtask with correct order', async () => {
    // Create two subtasks first
    await prisma.subtask.create({
      data: { title: 'First', todoId: testTodo.id, order: 0 },
    });
    await prisma.subtask.create({
      data: { title: 'Second', todoId: testTodo.id, order: 1 },
    });

    const formData = new FormData();
    formData.set('title', 'Third');

    const result = await createSubtask(
      testTodo.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.success).toBe(true);

    const subtask = await prisma.subtask.findFirst({
      where: { todoId: testTodo.id, title: 'Third' },
    });
    expect(subtask?.order).toBe(2);
  });
});

describe('updateSubtask', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let otherTenant: { id: string };
  let otherUser: { id: string };
  let testTodo: { id: string };
  let otherTodo: { id: string };
  let testSubtask: { id: string };
  let otherSubtask: { id: string };

  beforeEach(async () => {
    // Create test tenant and user
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Update Subtask' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `update-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Update Subtask',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });
    testSubtask = await prisma.subtask.create({
      data: {
        title: 'Test Subtask',
        todoId: testTodo.id,
        order: 0,
      },
    });

    // Create other tenant to test isolation
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Update Subtask' },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `other-update-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: otherTenant.id,
      },
    });
    otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo for Update Subtask',
        tenantId: otherTenant.id,
        createdById: otherUser.id,
      },
    });
    otherSubtask = await prisma.subtask.create({
      data: {
        title: 'Other Subtask',
        todoId: otherTodo.id,
        order: 0,
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.subtask.deleteMany({
      where: {
        todo: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
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

    const formData = new FormData();
    formData.set('title', 'Updated title');

    const result = await updateSubtask(
      testSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when title is empty', async () => {
    const formData = new FormData();
    formData.set('title', '');

    const result = await updateSubtask(
      testSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask title cannot be empty');
    expect(result.success).toBeUndefined();
  });

  test('returns error when title is only whitespace', async () => {
    const formData = new FormData();
    formData.set('title', '   \n\t  ');

    const result = await updateSubtask(
      testSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask title cannot be empty');
    expect(result.success).toBeUndefined();
  });

  test('returns error when title exceeds 200 characters', async () => {
    const formData = new FormData();
    formData.set('title', 'a'.repeat(201));

    const result = await updateSubtask(
      testSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask title must be 200 characters or less');
    expect(result.success).toBeUndefined();
  });

  test('returns error when subtask belongs to different tenant', async () => {
    const formData = new FormData();
    formData.set('title', 'Trying to update another tenant subtask');

    const result = await updateSubtask(
      otherSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when subtask does not exist', async () => {
    const formData = new FormData();
    formData.set('title', 'Update nonexistent subtask');

    const result = await updateSubtask(
      'nonexistent-subtask-id',
      {} as SubtaskActionState,
      formData,
    );

    expect(result.error).toBe('Subtask not found');
    expect(result.success).toBeUndefined();
  });

  test('updates subtask successfully', async () => {
    const formData = new FormData();
    formData.set('title', 'Updated title');

    const result = await updateSubtask(
      testSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify subtask was updated
    const subtask = await prisma.subtask.findUnique({
      where: { id: testSubtask.id },
    });
    expect(subtask?.title).toBe('Updated title');
  });

  test('trims whitespace from title', async () => {
    const formData = new FormData();
    formData.set('title', '  Updated with whitespace  \n');

    const result = await updateSubtask(
      testSubtask.id,
      {} as SubtaskActionState,
      formData,
    );

    expect(result.success).toBe(true);

    const subtask = await prisma.subtask.findUnique({
      where: { id: testSubtask.id },
    });
    expect(subtask?.title).toBe('Updated with whitespace');
  });
});

describe('toggleSubtask', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let otherTenant: { id: string };
  let otherUser: { id: string };
  let testTodo: { id: string };
  let otherTodo: { id: string };
  let testSubtask: { id: string };
  let otherSubtask: { id: string };

  beforeEach(async () => {
    // Create test tenant and user
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Toggle Subtask' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `toggle-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Toggle Subtask',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });
    testSubtask = await prisma.subtask.create({
      data: {
        title: 'Test Subtask',
        todoId: testTodo.id,
        order: 0,
        isComplete: false,
      },
    });

    // Create other tenant to test isolation
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Toggle Subtask' },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `other-toggle-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: otherTenant.id,
      },
    });
    otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo for Toggle Subtask',
        tenantId: otherTenant.id,
        createdById: otherUser.id,
      },
    });
    otherSubtask = await prisma.subtask.create({
      data: {
        title: 'Other Subtask',
        todoId: otherTodo.id,
        order: 0,
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.subtask.deleteMany({
      where: {
        todo: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
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

    const result = await toggleSubtask(testSubtask.id);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when subtask belongs to different tenant', async () => {
    const result = await toggleSubtask(otherSubtask.id);

    expect(result.error).toBe('Subtask not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when subtask does not exist', async () => {
    const result = await toggleSubtask('nonexistent-subtask-id');

    expect(result.error).toBe('Subtask not found');
    expect(result.success).toBeUndefined();
  });

  test('toggles subtask from incomplete to complete', async () => {
    const result = await toggleSubtask(testSubtask.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const subtask = await prisma.subtask.findUnique({
      where: { id: testSubtask.id },
    });
    expect(subtask?.isComplete).toBe(true);
  });

  test('toggles subtask from complete to incomplete', async () => {
    // First set it to complete
    await prisma.subtask.update({
      where: { id: testSubtask.id },
      data: { isComplete: true },
    });

    const result = await toggleSubtask(testSubtask.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const subtask = await prisma.subtask.findUnique({
      where: { id: testSubtask.id },
    });
    expect(subtask?.isComplete).toBe(false);
  });
});

describe('deleteSubtask', () => {
  let testTenant: { id: string };
  let testUser: { id: string };
  let otherTenant: { id: string };
  let otherUser: { id: string };
  let testTodo: { id: string };
  let otherTodo: { id: string };
  let testSubtask: { id: string };
  let otherSubtask: { id: string };

  beforeEach(async () => {
    // Create test tenant and user
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Delete Subtask' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `delete-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo for Delete Subtask',
        tenantId: testTenant.id,
        createdById: testUser.id,
      },
    });
    testSubtask = await prisma.subtask.create({
      data: {
        title: 'Test Subtask',
        todoId: testTodo.id,
        order: 0,
      },
    });

    // Create other tenant to test isolation
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Delete Subtask' },
    });
    otherUser = await prisma.user.create({
      data: {
        email: `other-delete-subtask-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: otherTenant.id,
      },
    });
    otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo for Delete Subtask',
        tenantId: otherTenant.id,
        createdById: otherUser.id,
      },
    });
    otherSubtask = await prisma.subtask.create({
      data: {
        title: 'Other Subtask',
        todoId: otherTodo.id,
        order: 0,
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.subtask.deleteMany({
      where: {
        todo: { tenantId: { in: [testTenant.id, otherTenant.id] } },
      },
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

    const result = await deleteSubtask(testSubtask.id);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when subtask belongs to different tenant', async () => {
    const result = await deleteSubtask(otherSubtask.id);

    expect(result.error).toBe('Subtask not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when subtask does not exist', async () => {
    const result = await deleteSubtask('nonexistent-subtask-id');

    expect(result.error).toBe('Subtask not found');
    expect(result.success).toBeUndefined();
  });

  test('deletes subtask successfully', async () => {
    const result = await deleteSubtask(testSubtask.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify subtask was deleted
    const subtask = await prisma.subtask.findUnique({
      where: { id: testSubtask.id },
    });
    expect(subtask).toBeNull();
  });
});
