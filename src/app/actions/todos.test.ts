import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { CreateTodoState, UpdateTodoState } from './todos';

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
  createTodo,
  toggleTodo,
  updateTodo,
  deleteTodo,
  updateTodoAssignee,
  updateTodoRecurrence,
  archiveTodo,
} = await import('./todos');

describe('createTodo', () => {
  const testTenantId = `tenant-${Date.now()}`;
  const testUserId = `user-${Date.now()}`;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates todo with title and tenantId from session', async () => {
    const formData = new FormData();
    formData.set('title', 'My first todo');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'My first todo' },
    });

    expect(todo).not.toBeNull();
    expect(todo?.title).toBe('My first todo');
    expect(todo?.tenantId).toBe(testTenantId);
    expect(todo?.createdById).toBe(testUserId);
    expect(todo?.status).toBe('PENDING');
  });

  test('creates todo with optional description', async () => {
    const formData = new FormData();
    formData.set('title', 'Todo with description');
    formData.set('description', 'This is a detailed description');

    await createTodo({} as CreateTodoState, formData);

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with description' },
    });

    expect(todo?.description).toBe('This is a detailed description');
  });

  test('creates todo with optional due date', async () => {
    const dueDate = '2025-12-31';
    const formData = new FormData();
    formData.set('title', 'Todo with due date');
    formData.set('dueDate', dueDate);

    await createTodo({} as CreateTodoState, formData);

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with due date' },
    });

    expect(todo?.dueDate).toBeInstanceOf(Date);
    expect(todo?.dueDate?.toISOString().slice(0, 10)).toBe(dueDate);
  });

  test('returns validation error for missing title', async () => {
    const formData = new FormData();
    formData.set('title', '');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors?.title).toBeDefined();
    expect(result.errors?.title?.[0]).toContain('required');
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('title', 'Unauthenticated todo');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('authenticated');
  });

  test('creates todo with valid assignee from same tenant', async () => {
    // Create another user in the same tenant for assignment
    const assigneeId = `assignee-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const formData = new FormData();
    formData.set('title', 'Todo with assignee');
    formData.set('assigneeId', assigneeId);

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with assignee' },
    });

    expect(todo?.assigneeId).toBe(assigneeId);
  });

  test('returns error for assignee from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a user
    const otherTenantId = `tenant-other-create-${Date.now()}`;
    const otherUserId = `user-other-create-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-create-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const formData = new FormData();
    formData.set('title', 'Todo with invalid assignee');
    formData.set('assigneeId', otherUserId);

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors?.assigneeId).toBeDefined();
    expect(result.errors?.assigneeId?.[0]).toContain('Invalid assignee');

    // Verify todo was not created
    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with invalid assignee' },
    });
    expect(todo).toBeNull();

    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('creates todo without assignee (defaults to null)', async () => {
    const formData = new FormData();
    formData.set('title', 'Todo without assignee');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo without assignee' },
    });

    expect(todo?.assigneeId).toBeNull();
  });

  test('creates CREATED activity when todo is created', async () => {
    const formData = new FormData();
    formData.set('title', 'Todo with activity');

    const result = await createTodo({} as CreateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findFirst({
      where: { tenantId: testTenantId, title: 'Todo with activity' },
    });

    expect(todo).not.toBeNull();

    // Verify CREATED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: todo?.id },
    });

    expect(activity).not.toBeNull();
    expect(activity?.action).toBe('CREATED');
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBeNull();
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });
});

describe('toggleTodo', () => {
  const testTenantId = `tenant-toggle-${Date.now()}`;
  const testUserId = `user-toggle-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-toggle-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo with PENDING status
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo to toggle',
        status: 'PENDING',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('toggles todo from PENDING to COMPLETED', async () => {
    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.status).toBe('COMPLETED');
  });

  test('toggles todo from COMPLETED to PENDING', async () => {
    // First set status to COMPLETED
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { status: 'COMPLETED' },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.status).toBe('PENDING');
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await toggleTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');
  });

  test('does not toggle todo when tenantId does not match (IDOR protection)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-toggle-other-${Date.now()}`;
    const otherUserId = `user-toggle-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `toggle-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        status: 'PENDING',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to toggle the other tenant's todo with our session
    const result = await toggleTodo(otherTodo.id);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify the todo was not toggled
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.status).toBe('PENDING');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('generates next instance when completing a recurring todo', async () => {
    // Update the test todo to be recurring
    await prisma.todo.update({
      where: { id: testTodoId },
      data: {
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
      },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify original todo is COMPLETED
    const originalTodo = await prisma.todo.findUnique({
      where: { id: testTodoId },
    });
    expect(originalTodo?.status).toBe('COMPLETED');

    // Verify new todo was created
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
      orderBy: { createdAt: 'desc' },
    });
    expect(todos).toHaveLength(2);

    const newTodo = todos.find((t) => t.id !== testTodoId);
    expect(newTodo).not.toBeNull();
    expect(newTodo?.status).toBe('PENDING');
    expect(newTodo?.title).toBe('Todo to toggle');
    expect(newTodo?.dueDate).toEqual(new Date('2026-01-22'));
    expect(newTodo?.recurrenceType).toBe('WEEKLY');
  });

  test('does not generate next instance for non-recurring todo', async () => {
    // Original todo has NONE recurrence by default
    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify only one todo exists
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
    });
    expect(todos).toHaveLength(1);
  });

  test('does not generate next instance when uncompleting a recurring todo', async () => {
    // Update the test todo to be recurring and COMPLETED
    await prisma.todo.update({
      where: { id: testTodoId },
      data: {
        status: 'COMPLETED',
        dueDate: new Date('2026-01-15'),
        recurrenceType: 'WEEKLY',
      },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify todo is now PENDING
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.status).toBe('PENDING');

    // Verify no new todo was created
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
    });
    expect(todos).toHaveLength(1);
  });

  test('does not generate next instance when recurring todo has no dueDate', async () => {
    // Update the test todo to be recurring but without dueDate
    await prisma.todo.update({
      where: { id: testTodoId },
      data: {
        recurrenceType: 'WEEKLY',
        dueDate: null,
      },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify only one todo exists
    const todos = await prisma.todo.findMany({
      where: { tenantId: testTenantId },
    });
    expect(todos).toHaveLength(1);
  });
});

describe('updateTodo', () => {
  const testTenantId = `tenant-update-${Date.now()}`;
  const testUserId = `user-update-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-update-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Original title',
        description: 'Original description',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('updates todo title when tenantId matches session', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.title).toBe('Updated title');
  });

  test('updates todo description', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');
    formData.set('description', 'Updated description');

    await updateTodo({} as UpdateTodoState, formData);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.description).toBe('Updated description');
  });

  test('updates todo due date', async () => {
    const dueDate = '2026-06-15';
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');
    formData.set('dueDate', dueDate);

    await updateTodo({} as UpdateTodoState, formData);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.dueDate?.toISOString().slice(0, 10)).toBe(dueDate);
  });

  test('returns validation error for missing title', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', '');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?.title).toBeDefined();
    expect(result.errors?.title?.[0]).toContain('required');
  });

  test('returns validation error for missing id', async () => {
    const formData = new FormData();
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?.id).toBeDefined();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('authenticated');
  });

  test('does not update todo when tenantId does not match (IDOR protection)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-other-${Date.now()}`;
    const otherUserId = `user-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to update the other tenant's todo with our session
    const formData = new FormData();
    formData.set('id', otherTodo.id);
    formData.set('title', 'Hacked title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?._form).toBeDefined();
    expect(result.errors?._form?.[0]).toContain('not found');

    // Verify the todo was not updated
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.title).toBe('Other tenant todo');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('updates todo with valid assignee from same tenant', async () => {
    // Create another user in the same tenant for assignment
    const assigneeId = `assignee-update-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-update-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title with assignee');
    formData.set('assigneeId', assigneeId);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors).toBeUndefined();
    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBe(assigneeId);
  });

  test('returns error for assignee from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a user
    const otherTenantIdAssign = `tenant-other-assign-${Date.now()}`;
    const otherUserIdAssign = `user-other-assign-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantIdAssign,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserIdAssign,
            email: `other-assign-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');
    formData.set('assigneeId', otherUserIdAssign);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors?.assigneeId).toBeDefined();
    expect(result.errors?.assigneeId?.[0]).toContain('Invalid assignee');

    // Verify todo was not updated with invalid assignee
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();

    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId: otherTenantIdAssign } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantIdAssign } });
  });

  test('clears assignee when assigneeId not provided', async () => {
    // First, assign someone to the todo
    const assigneeId = `assignee-clear-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-clear-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    // Now update without assigneeId to clear it
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.errors).toBeUndefined();
    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();
  });
});

describe('deleteTodo', () => {
  const testTenantId = `tenant-delete-${Date.now()}`;
  const testUserId = `user-delete-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-delete-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo to delete',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('deletes todo when tenantId matches session', async () => {
    const result = await deleteTodo(testTodoId);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo).toBeNull();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await deleteTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');

    // Verify todo was NOT deleted
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo).not.toBeNull();
  });

  test('returns error when todo does not exist', async () => {
    const result = await deleteTodo('non-existent-id');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  test('does not delete todo when tenantId does not match (IDOR protection)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-delete-other-${Date.now()}`;
    const otherUserId = `user-delete-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `delete-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to delete the other tenant's todo with our session
    const result = await deleteTodo(otherTodo.id);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify the todo was NOT deleted
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo).not.toBeNull();

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });
});

describe('updateTodoAssignee', () => {
  const testTenantId = `tenant-assignee-${Date.now()}`;
  const testUserId = `user-assignee-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-assignee-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for assignee test',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('assigns valid user from same tenant', async () => {
    // Create another user in the same tenant
    const assigneeId = `assignee-quick-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-quick-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const result = await updateTodoAssignee(testTodoId, assigneeId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBe(assigneeId);
  });

  test('unassigns todo when assigneeId is null', async () => {
    // First assign someone
    const assigneeId = `assignee-unassign-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-unassign-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    // Now unassign
    const result = await updateTodoAssignee(testTodoId, null);

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await updateTodoAssignee(testTodoId, 'some-user-id');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');
  });

  test('returns error for assignee from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a user
    const otherTenantId = `tenant-other-quick-${Date.now()}`;
    const otherUserId = `user-other-quick-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-quick-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
          },
        },
      },
    });

    const result = await updateTodoAssignee(testTodoId, otherUserId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid assignee');

    // Verify todo was not updated
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.assigneeId).toBeNull();

    // Cleanup
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for todo from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-other-todo-${Date.now()}`;
    const otherUserId = `user-other-todo-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `other-todo-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to assign someone to the other tenant's todo
    const result = await updateTodoAssignee(otherTodo.id, testUserId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for non-existent todo', async () => {
    const result = await updateTodoAssignee('non-existent-todo', testUserId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  test('creates notification when assigning to another user', async () => {
    // Create another user in the same tenant
    const assigneeId = `assignee-notify-${Date.now()}`;
    const assigneeEmail = `assignee-notify-${Date.now()}@example.com`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: assigneeEmail,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const result = await updateTodoAssignee(testTodoId, assigneeId);

    expect(result.success).toBe(true);

    // Verify notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        userId: assigneeId,
        todoId: testTodoId,
        type: 'TODO_ASSIGNED',
      },
    });

    expect(notification).not.toBeNull();
    expect(notification?.message).toContain('assigned you to');
    expect(notification?.message).toContain('Todo for assignee test');
    expect(notification?.isRead).toBe(false);

    // Cleanup notification
    await prisma.notification.deleteMany({ where: { userId: assigneeId } });
  });

  test('does not create notification for self-assignment', async () => {
    // Assign the todo to the current user (self-assignment)
    const result = await updateTodoAssignee(testTodoId, testUserId);

    expect(result.success).toBe(true);

    // Verify no notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        userId: testUserId,
        todoId: testTodoId,
        type: 'TODO_ASSIGNED',
      },
    });

    expect(notification).toBeNull();
  });

  test('does not create notification when assignee unchanged', async () => {
    // Create another user and assign them first
    const assigneeId = `assignee-unchanged-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-unchanged-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    // First assignment - should create notification
    await updateTodoAssignee(testTodoId, assigneeId);

    // Count notifications
    const countBefore = await prisma.notification.count({
      where: { userId: assigneeId, todoId: testTodoId },
    });

    // Assign same user again - should not create another notification
    const result = await updateTodoAssignee(testTodoId, assigneeId);

    expect(result.success).toBe(true);

    const countAfter = await prisma.notification.count({
      where: { userId: assigneeId, todoId: testTodoId },
    });

    expect(countAfter).toBe(countBefore);

    // Cleanup notification
    await prisma.notification.deleteMany({ where: { userId: assigneeId } });
  });

  test('notification includes assigner email and todo title', async () => {
    // Get the assigner's email
    const assigner = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { email: true },
    });

    // Create another user
    const assigneeId = `assignee-message-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-message-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    await updateTodoAssignee(testTodoId, assigneeId);

    const notification = await prisma.notification.findFirst({
      where: {
        userId: assigneeId,
        todoId: testTodoId,
        type: 'TODO_ASSIGNED',
      },
    });

    expect(notification?.message).toBe(
      `${assigner?.email} assigned you to "Todo for assignee test"`,
    );

    // Cleanup notification
    await prisma.notification.deleteMany({ where: { userId: assigneeId } });
  });
});

describe('updateTodoRecurrence', () => {
  const testTenantId = `tenant-recurrence-${Date.now()}`;
  const testUserId = `user-recurrence-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-recurrence-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo with due date
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for recurrence test',
        dueDate: new Date('2026-01-15'),
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('updates recurrenceType when todo has due date', async () => {
    const result = await updateTodoRecurrence(testTodoId, 'WEEKLY');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.recurrenceType).toBe('WEEKLY');
  });

  test('updates recurrenceType to NONE', async () => {
    // First set to WEEKLY
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { recurrenceType: 'WEEKLY' },
    });

    const result = await updateTodoRecurrence(testTodoId, 'NONE');

    expect(result.success).toBe(true);

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.recurrenceType).toBe('NONE');
  });

  test('updates to all recurrence types', async () => {
    const recurrenceTypes = [
      'DAILY',
      'WEEKLY',
      'BIWEEKLY',
      'MONTHLY',
      'YEARLY',
    ] as const;

    for (const recurrenceType of recurrenceTypes) {
      const result = await updateTodoRecurrence(testTodoId, recurrenceType);
      expect(result.success).toBe(true);

      const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
      expect(todo?.recurrenceType).toBe(recurrenceType);
    }
  });

  test('returns error when setting recurrence without due date', async () => {
    // Remove due date from todo
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate: null },
    });

    const result = await updateTodoRecurrence(testTodoId, 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('due date');

    // Verify recurrence was not set
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.recurrenceType).toBe('NONE');
  });

  test('allows setting NONE even without due date', async () => {
    // Remove due date from todo
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate: null },
    });

    const result = await updateTodoRecurrence(testTodoId, 'NONE');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await updateTodoRecurrence(testTodoId, 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');
  });

  test('returns error for todo from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-recurrence-other-${Date.now()}`;
    const otherUserId = `user-recurrence-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `recurrence-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        dueDate: new Date('2026-01-15'),
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to update the other tenant's todo recurrence
    const result = await updateTodoRecurrence(otherTodo.id, 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify recurrence was not updated
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.recurrenceType).toBe('NONE');

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for non-existent todo', async () => {
    const result = await updateTodoRecurrence('non-existent-todo', 'WEEKLY');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });
});

describe('updateTodo activity generation', () => {
  const testTenantId = `tenant-update-activity-${Date.now()}`;
  const testUserId = `user-update-activity-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-update-activity-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for update activity test',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates ASSIGNEE_CHANGED activity when assignee changes', async () => {
    // Create another user in the same tenant for assignment
    const assigneeId = `assignee-activity-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-activity-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for update activity test');
    formData.set('assigneeId', assigneeId);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify ASSIGNEE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('assigneeId');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBe(assigneeId);
  });

  test('creates ASSIGNEE_CHANGED activity when changing from one assignee to another', async () => {
    // Create two users in the same tenant
    const assignee1Id = `assignee1-activity-${Date.now()}`;
    const assignee2Id = `assignee2-activity-${Date.now()}`;
    await prisma.user.createMany({
      data: [
        {
          id: assignee1Id,
          email: `assignee1-activity-${Date.now()}@example.com`,
          passwordHash: 'hashed',
          role: 'MEMBER',
          tenantId: testTenantId,
        },
        {
          id: assignee2Id,
          email: `assignee2-activity-${Date.now()}@example.com`,
          passwordHash: 'hashed',
          role: 'MEMBER',
          tenantId: testTenantId,
        },
      ],
    });

    // First assign to assignee1
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId: assignee1Id },
    });

    // Now change to assignee2
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for update activity test');
    formData.set('assigneeId', assignee2Id);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify ASSIGNEE_CHANGED activity was created with old and new values
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('assigneeId');
    expect(activity?.oldValue).toBe(assignee1Id);
    expect(activity?.newValue).toBe(assignee2Id);
  });

  test('creates ASSIGNEE_CHANGED activity when unassigning', async () => {
    // Create a user and assign them first
    const assigneeId = `assignee-unassign-activity-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-unassign-activity-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    // Now unassign (no assigneeId in form data)
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for update activity test');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify ASSIGNEE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('assigneeId');
    expect(activity?.oldValue).toBe(assigneeId);
    expect(activity?.newValue).toBeNull();
  });

  test('does not create ASSIGNEE_CHANGED activity when assignee unchanged', async () => {
    // Create a user and assign them
    const assigneeId = `assignee-unchanged-activity-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-unchanged-activity-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    // Update with same assignee
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for update activity test');
    formData.set('assigneeId', assigneeId);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify no ASSIGNEE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).toBeNull();
  });
});

describe('updateTodoAssignee activity generation', () => {
  const testTenantId = `tenant-assignee-activity-${Date.now()}`;
  const testUserId = `user-assignee-activity-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-assignee-activity-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for assignee activity test',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.notification.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates ASSIGNEE_CHANGED activity when assigning', async () => {
    // Create another user in the same tenant
    const assigneeId = `assignee-quick-activity-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-quick-activity-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });

    const result = await updateTodoAssignee(testTodoId, assigneeId);

    expect(result.success).toBe(true);

    // Verify ASSIGNEE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('assigneeId');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBe(assigneeId);
  });

  test('creates ASSIGNEE_CHANGED activity when unassigning', async () => {
    // Create a user and assign them first
    const assigneeId = `assignee-unassign-quick-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-unassign-quick-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    const result = await updateTodoAssignee(testTodoId, null);

    expect(result.success).toBe(true);

    // Verify ASSIGNEE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('assigneeId');
    expect(activity?.oldValue).toBe(assigneeId);
    expect(activity?.newValue).toBeNull();
  });

  test('does not create ASSIGNEE_CHANGED activity when assignee unchanged', async () => {
    // Create a user and assign them
    const assigneeId = `assignee-noop-activity-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: assigneeId,
        email: `assignee-noop-activity-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        role: 'MEMBER',
        tenantId: testTenantId,
      },
    });
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { assigneeId },
    });

    const result = await updateTodoAssignee(testTodoId, assigneeId);

    expect(result.success).toBe(true);

    // Verify no ASSIGNEE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ASSIGNEE_CHANGED' },
    });

    expect(activity).toBeNull();
  });
});

describe('toggleTodo activity generation', () => {
  const testTenantId = `tenant-toggle-activity-${Date.now()}`;
  const testUserId = `user-toggle-activity-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-toggle-activity-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo with PENDING status
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for activity test',
        status: 'PENDING',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates STATUS_CHANGED activity when toggling from PENDING to COMPLETED', async () => {
    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify STATUS_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'STATUS_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('status');
    expect(activity?.oldValue).toBe('PENDING');
    expect(activity?.newValue).toBe('COMPLETED');
  });

  test('creates STATUS_CHANGED activity when toggling from COMPLETED to PENDING', async () => {
    // First set status to COMPLETED
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { status: 'COMPLETED' },
    });

    const result = await toggleTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify STATUS_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'STATUS_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('status');
    expect(activity?.oldValue).toBe('COMPLETED');
    expect(activity?.newValue).toBe('PENDING');
  });
});

describe('updateTodo due date activity generation', () => {
  const testTenantId = `tenant-duedate-activity-${Date.now()}`;
  const testUserId = `user-duedate-activity-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-duedate-activity-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for due date activity test',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates DUE_DATE_CHANGED activity when setting due date from null', async () => {
    const dueDate = '2026-06-15';
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for due date activity test');
    formData.set('dueDate', dueDate);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify DUE_DATE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DUE_DATE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('dueDate');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBe(new Date(dueDate).toISOString());
  });

  test('creates DUE_DATE_CHANGED activity when clearing due date to null', async () => {
    // First set a due date
    const originalDueDate = new Date('2026-06-15');
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate: originalDueDate },
    });

    // Now clear the due date (no dueDate in form data)
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for due date activity test');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify DUE_DATE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DUE_DATE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('dueDate');
    expect(activity?.oldValue).toBe(originalDueDate.toISOString());
    expect(activity?.newValue).toBeNull();
  });

  test('creates DUE_DATE_CHANGED activity when changing from one date to another', async () => {
    // First set a due date
    const originalDueDate = new Date('2026-06-15');
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate: originalDueDate },
    });

    // Now change to a different date
    const newDueDate = '2026-07-20';
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for due date activity test');
    formData.set('dueDate', newDueDate);

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify DUE_DATE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DUE_DATE_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('dueDate');
    expect(activity?.oldValue).toBe(originalDueDate.toISOString());
    expect(activity?.newValue).toBe(new Date(newDueDate).toISOString());
  });

  test('does not create DUE_DATE_CHANGED activity when due date unchanged', async () => {
    // First set a due date
    const dueDate = new Date('2026-06-15');
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { dueDate },
    });

    // Update with same due date
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for due date activity test');
    formData.set('dueDate', '2026-06-15');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify no DUE_DATE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DUE_DATE_CHANGED' },
    });

    expect(activity).toBeNull();
  });

  test('does not create DUE_DATE_CHANGED activity when both old and new are null', async () => {
    // Todo already has no due date, update without due date
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify no DUE_DATE_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DUE_DATE_CHANGED' },
    });

    expect(activity).toBeNull();
  });
});

describe('updateTodo description activity generation', () => {
  const testTenantId = `tenant-desc-activity-${Date.now()}`;
  const testUserId = `user-desc-activity-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-desc-activity-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo for description activity test',
        description: 'Original description',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('creates DESCRIPTION_CHANGED activity when description changes', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for description activity test');
    formData.set('description', 'New description');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify DESCRIPTION_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DESCRIPTION_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('description');
    // REQ-005: No old/new values stored for description (privacy/storage reasons)
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });

  test('creates DESCRIPTION_CHANGED activity when setting description from null', async () => {
    // Create a todo without description
    const todoNoDesc = await prisma.todo.create({
      data: {
        title: 'Todo without description',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    const formData = new FormData();
    formData.set('id', todoNoDesc.id);
    formData.set('title', 'Todo without description');
    formData.set('description', 'New description added');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify DESCRIPTION_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: todoNoDesc.id, action: 'DESCRIPTION_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('description');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });

  test('creates DESCRIPTION_CHANGED activity when clearing description to null', async () => {
    // Todo already has a description from beforeEach
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for description activity test');
    // No description field means it clears to undefined

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify DESCRIPTION_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DESCRIPTION_CHANGED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBe('description');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });

  test('does not create DESCRIPTION_CHANGED activity when description unchanged', async () => {
    const formData = new FormData();
    formData.set('id', testTodoId);
    formData.set('title', 'Todo for description activity test');
    formData.set('description', 'Original description'); // Same as beforeEach

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify no DESCRIPTION_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'DESCRIPTION_CHANGED' },
    });

    expect(activity).toBeNull();
  });

  test('does not create DESCRIPTION_CHANGED activity when both old and new are null/undefined', async () => {
    // Create a todo without description
    const todoNoDesc = await prisma.todo.create({
      data: {
        title: 'Todo no description',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });

    // Update without providing description
    const formData = new FormData();
    formData.set('id', todoNoDesc.id);
    formData.set('title', 'Updated title');

    const result = await updateTodo({} as UpdateTodoState, formData);

    expect(result.success).toBe(true);

    // Verify no DESCRIPTION_CHANGED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: todoNoDesc.id, action: 'DESCRIPTION_CHANGED' },
    });

    expect(activity).toBeNull();
  });
});

describe('archiveTodo', () => {
  const testTenantId = `tenant-archive-${Date.now()}`;
  const testUserId = `user-archive-${Date.now()}`;
  let testTodoId: string;

  beforeEach(async () => {
    // Create test tenant and user
    await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant',
        users: {
          create: {
            id: testUserId,
            email: `test-archive-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    // Create a test todo
    const todo = await prisma.todo.create({
      data: {
        title: 'Todo to archive',
        tenantId: testTenantId,
        createdById: testUserId,
      },
    });
    testTodoId = todo.id;

    // Reset mock to return test session
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUserId, tenantId: testTenantId }),
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: testTenantId } },
    });
    await prisma.todo.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  test('archives todo and sets archivedAt timestamp', async () => {
    const beforeArchive = new Date();
    const result = await archiveTodo(testTodoId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.archivedAt).not.toBeNull();
    expect(todo?.archivedAt?.getTime()).toBeGreaterThanOrEqual(
      beforeArchive.getTime(),
    );
  });

  test('creates ARCHIVED activity when archiving', async () => {
    const result = await archiveTodo(testTodoId);

    expect(result.success).toBe(true);

    // Verify ARCHIVED activity was created
    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodoId, action: 'ARCHIVED' },
    });

    expect(activity).not.toBeNull();
    expect(activity?.actorId).toBe(testUserId);
    expect(activity?.field).toBeNull();
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBeNull();
  });

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await archiveTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('authenticated');

    // Verify todo was not archived
    const todo = await prisma.todo.findUnique({ where: { id: testTodoId } });
    expect(todo?.archivedAt).toBeNull();
  });

  test('returns error when todo is already archived', async () => {
    // First archive the todo
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { archivedAt: new Date() },
    });

    const result = await archiveTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('already archived');
  });

  test('returns error when todo is deleted', async () => {
    // Mark the todo as deleted
    await prisma.todo.update({
      where: { id: testTodoId },
      data: { deletedAt: new Date() },
    });

    const result = await archiveTodo(testTodoId);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('deleted');
  });

  test('returns error for todo from different tenant (IDOR prevention)', async () => {
    // Create another tenant with a todo
    const otherTenantId = `tenant-archive-other-${Date.now()}`;
    const otherUserId = `user-archive-other-${Date.now()}`;
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'Other Tenant',
        users: {
          create: {
            id: otherUserId,
            email: `archive-other-${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'ADMIN',
          },
        },
      },
    });

    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other tenant todo',
        tenantId: otherTenantId,
        createdById: otherUserId,
      },
    });

    // Try to archive the other tenant's todo with our session
    const result = await archiveTodo(otherTodo.id);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify the todo was not archived
    const todo = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(todo?.archivedAt).toBeNull();

    // Cleanup
    await prisma.todo.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });

  test('returns error for non-existent todo', async () => {
    const result = await archiveTodo('non-existent-todo');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });
});
