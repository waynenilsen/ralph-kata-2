import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { prisma } from '@/lib/prisma';
import type { LabelState } from './labels';

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
const { createLabel, updateLabel, deleteLabel } = await import('./labels');

describe('createLabel', () => {
  let testTenant: { id: string };
  let adminUser: { id: string };
  let memberUser: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Labels' },
    });
    adminUser = await prisma.user.create({
      data: {
        email: `label-admin-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'ADMIN',
      },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `label-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: adminUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.label.deleteMany({
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

  test('returns error when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const formData = new FormData();
    formData.set('name', 'Bug');
    formData.set('color', '#ef4444');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when user is not admin', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );

    const formData = new FormData();
    formData.set('name', 'Bug');
    formData.set('color', '#ef4444');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Only admins can create labels');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name is empty', async () => {
    const formData = new FormData();
    formData.set('name', '');
    formData.set('color', '#ef4444');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Label name is required');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name is only whitespace', async () => {
    const formData = new FormData();
    formData.set('name', '   ');
    formData.set('color', '#ef4444');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Label name is required');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name exceeds 30 characters', async () => {
    const formData = new FormData();
    formData.set('name', 'a'.repeat(31));
    formData.set('color', '#ef4444');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Label name must be 30 characters or less');
    expect(result.success).toBeUndefined();
  });

  test('returns error when color is missing', async () => {
    const formData = new FormData();
    formData.set('name', 'Bug');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Invalid color format');
    expect(result.success).toBeUndefined();
  });

  test('returns error when color format is invalid', async () => {
    const formData = new FormData();
    formData.set('name', 'Bug');
    formData.set('color', 'red');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Invalid color format');
    expect(result.success).toBeUndefined();
  });

  test('returns error when color hex is too short', async () => {
    const formData = new FormData();
    formData.set('name', 'Bug');
    formData.set('color', '#ef44');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('Invalid color format');
    expect(result.success).toBeUndefined();
  });

  test('returns error when duplicate name exists (case-insensitive)', async () => {
    // Create existing label
    await prisma.label.create({
      data: {
        name: 'Bug',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });

    const formData = new FormData();
    formData.set('name', 'BUG');
    formData.set('color', '#3b82f6');

    const result = await createLabel({} as LabelState, formData);

    expect(result.error).toBe('A label with this name already exists');
    expect(result.success).toBeUndefined();
  });

  test('creates label successfully', async () => {
    const formData = new FormData();
    formData.set('name', 'Bug');
    formData.set('color', '#ef4444');

    const result = await createLabel({} as LabelState, formData);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const label = await prisma.label.findFirst({
      where: { tenantId: testTenant.id, name: 'Bug' },
    });
    expect(label).toBeDefined();
    expect(label?.color).toBe('#ef4444');
  });

  test('trims whitespace from name', async () => {
    const formData = new FormData();
    formData.set('name', '  Feature  ');
    formData.set('color', '#22c55e');

    const result = await createLabel({} as LabelState, formData);

    expect(result.success).toBe(true);

    const label = await prisma.label.findFirst({
      where: { tenantId: testTenant.id },
    });
    expect(label?.name).toBe('Feature');
  });

  test('allows 30 character name', async () => {
    const formData = new FormData();
    formData.set('name', 'a'.repeat(30));
    formData.set('color', '#3b82f6');

    const result = await createLabel({} as LabelState, formData);

    expect(result.success).toBe(true);
  });

  test('accepts lowercase hex color', async () => {
    const formData = new FormData();
    formData.set('name', 'Lowercase');
    formData.set('color', '#abcdef');

    const result = await createLabel({} as LabelState, formData);

    expect(result.success).toBe(true);
  });

  test('accepts uppercase hex color', async () => {
    const formData = new FormData();
    formData.set('name', 'Uppercase');
    formData.set('color', '#ABCDEF');

    const result = await createLabel({} as LabelState, formData);

    expect(result.success).toBe(true);
  });
});

describe('updateLabel', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let adminUser: { id: string };
  let memberUser: { id: string };
  let testLabel: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Update Labels' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Update Labels' },
    });
    adminUser = await prisma.user.create({
      data: {
        email: `update-label-admin-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'ADMIN',
      },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `update-label-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    testLabel = await prisma.label.create({
      data: {
        name: 'Original',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: adminUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.label.deleteMany({
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
    formData.set('name', 'Updated');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when user is not admin', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );

    const formData = new FormData();
    formData.set('name', 'Updated');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('Only admins can update labels');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label belongs to different tenant', async () => {
    const otherLabel = await prisma.label.create({
      data: {
        name: 'Other Label',
        color: '#22c55e',
        tenantId: otherTenant.id,
      },
    });

    const formData = new FormData();
    formData.set('name', 'Hacked');
    formData.set('color', '#ef4444');

    const result = await updateLabel(otherLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label does not exist', async () => {
    const formData = new FormData();
    formData.set('name', 'Updated');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(
      'nonexistent-id',
      {} as LabelState,
      formData,
    );

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name is empty', async () => {
    const formData = new FormData();
    formData.set('name', '');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('Label name is required');
    expect(result.success).toBeUndefined();
  });

  test('returns error when name exceeds 30 characters', async () => {
    const formData = new FormData();
    formData.set('name', 'a'.repeat(31));
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('Label name must be 30 characters or less');
    expect(result.success).toBeUndefined();
  });

  test('returns error when color format is invalid', async () => {
    const formData = new FormData();
    formData.set('name', 'Updated');
    formData.set('color', 'invalid');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('Invalid color format');
    expect(result.success).toBeUndefined();
  });

  test('returns error when duplicate name exists (case-insensitive)', async () => {
    await prisma.label.create({
      data: {
        name: 'Existing',
        color: '#22c55e',
        tenantId: testTenant.id,
      },
    });

    const formData = new FormData();
    formData.set('name', 'EXISTING');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.error).toBe('A label with this name already exists');
    expect(result.success).toBeUndefined();
  });

  test('allows updating to same name (case-insensitive)', async () => {
    const formData = new FormData();
    formData.set('name', 'ORIGINAL');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('updates label successfully', async () => {
    const formData = new FormData();
    formData.set('name', 'Updated');
    formData.set('color', '#3b82f6');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const label = await prisma.label.findUnique({
      where: { id: testLabel.id },
    });
    expect(label?.name).toBe('Updated');
    expect(label?.color).toBe('#3b82f6');
  });

  test('trims whitespace from name', async () => {
    const formData = new FormData();
    formData.set('name', '  Trimmed  ');
    formData.set('color', '#22c55e');

    const result = await updateLabel(testLabel.id, {} as LabelState, formData);

    expect(result.success).toBe(true);

    const label = await prisma.label.findUnique({
      where: { id: testLabel.id },
    });
    expect(label?.name).toBe('Trimmed');
  });
});

describe('deleteLabel', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let adminUser: { id: string };
  let memberUser: { id: string };
  let testLabel: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for Delete Labels' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for Delete Labels' },
    });
    adminUser = await prisma.user.create({
      data: {
        email: `delete-label-admin-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'ADMIN',
      },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `delete-label-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    testLabel = await prisma.label.create({
      data: {
        name: 'ToDelete',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: adminUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.todoLabel.deleteMany({
      where: { label: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
    });
    await prisma.label.deleteMany({
      where: { tenantId: { in: [testTenant.id, otherTenant.id] } },
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

    const result = await deleteLabel(testLabel.id);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when user is not admin', async () => {
    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );

    const result = await deleteLabel(testLabel.id);

    expect(result.error).toBe('Only admins can delete labels');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label belongs to different tenant', async () => {
    const otherLabel = await prisma.label.create({
      data: {
        name: 'Other Label',
        color: '#22c55e',
        tenantId: otherTenant.id,
      },
    });

    const result = await deleteLabel(otherLabel.id);

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label does not exist', async () => {
    const result = await deleteLabel('nonexistent-id');

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('deletes label successfully', async () => {
    const result = await deleteLabel(testLabel.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const label = await prisma.label.findUnique({
      where: { id: testLabel.id },
    });
    expect(label).toBeNull();
  });

  test('deletes label and removes from todos (cascade)', async () => {
    // Create a todo with the label
    const todo = await prisma.todo.create({
      data: {
        title: 'Test Todo',
        tenantId: testTenant.id,
        createdById: adminUser.id,
      },
    });
    await prisma.todoLabel.create({
      data: {
        todoId: todo.id,
        labelId: testLabel.id,
      },
    });

    const result = await deleteLabel(testLabel.id);

    expect(result.success).toBe(true);

    // Verify TodoLabel was deleted
    const todoLabel = await prisma.todoLabel.findFirst({
      where: { labelId: testLabel.id },
    });
    expect(todoLabel).toBeNull();

    // Verify todo still exists
    const existingTodo = await prisma.todo.findUnique({
      where: { id: todo.id },
    });
    expect(existingTodo).not.toBeNull();
  });
});
