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
const { createTodo, toggleTodo, updateTodo, deleteTodo } = await import(
  './todos'
);

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
