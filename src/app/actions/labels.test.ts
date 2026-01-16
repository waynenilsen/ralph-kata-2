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
const {
  createLabel,
  updateLabel,
  deleteLabel,
  updateTodoLabels,
  addLabelToTodo,
  removeLabelFromTodo,
  getLabels,
} = await import('./labels');

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

describe('updateTodoLabels', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let memberUser: { id: string };
  let testTodo: { id: string };
  let label1: { id: string };
  let label2: { id: string };
  let label3: { id: string };
  let otherTenantLabel: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for UpdateTodoLabels' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for UpdateTodoLabels' },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `update-todo-labels-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo',
        tenantId: testTenant.id,
        createdById: memberUser.id,
      },
    });
    label1 = await prisma.label.create({
      data: {
        name: 'Bug',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });
    label2 = await prisma.label.create({
      data: {
        name: 'Feature',
        color: '#22c55e',
        tenantId: testTenant.id,
      },
    });
    label3 = await prisma.label.create({
      data: {
        name: 'Urgent',
        color: '#f97316',
        tenantId: testTenant.id,
      },
    });
    otherTenantLabel = await prisma.label.create({
      data: {
        name: 'Other Label',
        color: '#3b82f6',
        tenantId: otherTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.todoLabel.deleteMany({
      where: { todo: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
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

    const result = await updateTodoLabels(testTodo.id, [label1.id]);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo belongs to different tenant', async () => {
    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo',
        tenantId: otherTenant.id,
        createdById: memberUser.id, // wrong, but just for testing
      },
    });

    const result = await updateTodoLabels(otherTodo.id, [label1.id]);

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo does not exist', async () => {
    const result = await updateTodoLabels('nonexistent-id', [label1.id]);

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when any label belongs to different tenant', async () => {
    const result = await updateTodoLabels(testTodo.id, [
      label1.id,
      otherTenantLabel.id,
    ]);

    expect(result.error).toBe('Invalid labels');
    expect(result.success).toBeUndefined();
  });

  test('returns error when any label does not exist', async () => {
    const result = await updateTodoLabels(testTodo.id, [
      label1.id,
      'nonexistent-label',
    ]);

    expect(result.error).toBe('Invalid labels');
    expect(result.success).toBeUndefined();
  });

  test('adds labels to todo successfully', async () => {
    const result = await updateTodoLabels(testTodo.id, [label1.id, label2.id]);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(2);
    expect(todoLabels.map((tl) => tl.labelId).sort()).toEqual(
      [label1.id, label2.id].sort(),
    );
  });

  test('replaces existing labels with new ones', async () => {
    // Add initial labels
    await prisma.todoLabel.createMany({
      data: [
        { todoId: testTodo.id, labelId: label1.id },
        { todoId: testTodo.id, labelId: label2.id },
      ],
    });

    // Update to different labels
    const result = await updateTodoLabels(testTodo.id, [label3.id]);

    expect(result.success).toBe(true);

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(1);
    expect(todoLabels[0].labelId).toBe(label3.id);
  });

  test('removes all labels when empty array provided', async () => {
    // Add initial labels
    await prisma.todoLabel.createMany({
      data: [
        { todoId: testTodo.id, labelId: label1.id },
        { todoId: testTodo.id, labelId: label2.id },
      ],
    });

    const result = await updateTodoLabels(testTodo.id, []);

    expect(result.success).toBe(true);

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(0);
  });

  test('allows any tenant member (not just admin) to update labels', async () => {
    // memberUser has MEMBER role, not ADMIN
    const result = await updateTodoLabels(testTodo.id, [label1.id]);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('handles duplicate label ids in input', async () => {
    // Pass same label id twice
    const result = await updateTodoLabels(testTodo.id, [label1.id, label1.id]);

    expect(result.success).toBe(true);

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    // Should only have one entry for label1
    expect(todoLabels).toHaveLength(1);
    expect(todoLabels[0].labelId).toBe(label1.id);
  });
});

describe('addLabelToTodo', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let memberUser: { id: string };
  let testTodo: { id: string };
  let label1: { id: string; name: string };
  let label2: { id: string; name: string };
  let otherTenantLabel: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for AddLabelToTodo' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for AddLabelToTodo' },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `add-label-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo',
        tenantId: testTenant.id,
        createdById: memberUser.id,
      },
    });
    label1 = await prisma.label.create({
      data: {
        name: 'Bug',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });
    label2 = await prisma.label.create({
      data: {
        name: 'Feature',
        color: '#22c55e',
        tenantId: testTenant.id,
      },
    });
    otherTenantLabel = await prisma.label.create({
      data: {
        name: 'Other Label',
        color: '#3b82f6',
        tenantId: otherTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
    });
    await prisma.todoLabel.deleteMany({
      where: { todo: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
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

    const result = await addLabelToTodo(testTodo.id, label1.id);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo belongs to different tenant', async () => {
    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo',
        tenantId: otherTenant.id,
        createdById: memberUser.id,
      },
    });

    const result = await addLabelToTodo(otherTodo.id, label1.id);

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo does not exist', async () => {
    const result = await addLabelToTodo('nonexistent-id', label1.id);

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label belongs to different tenant', async () => {
    const result = await addLabelToTodo(testTodo.id, otherTenantLabel.id);

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label does not exist', async () => {
    const result = await addLabelToTodo(testTodo.id, 'nonexistent-label');

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('adds label to todo successfully', async () => {
    const result = await addLabelToTodo(testTodo.id, label1.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(1);
    expect(todoLabels[0].labelId).toBe(label1.id);
  });

  test('creates LABELS_CHANGED activity with label name as newValue', async () => {
    await addLabelToTodo(testTodo.id, label1.id);

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id, action: 'LABELS_CHANGED' },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('LABELS_CHANGED');
    expect(activity?.actorId).toBe(memberUser.id);
    expect(activity?.field).toBe('labels');
    expect(activity?.oldValue).toBeNull();
    expect(activity?.newValue).toBe('Bug');
  });

  test('returns success without creating duplicate when label already on todo', async () => {
    // Add label first time
    await prisma.todoLabel.create({
      data: { todoId: testTodo.id, labelId: label1.id },
    });

    // Try to add again
    const result = await addLabelToTodo(testTodo.id, label1.id);

    expect(result.success).toBe(true);

    // Should still have only one entry
    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(1);
  });

  test('does not create activity when label already on todo', async () => {
    // Add label first time
    await prisma.todoLabel.create({
      data: { todoId: testTodo.id, labelId: label1.id },
    });

    // Try to add again
    await addLabelToTodo(testTodo.id, label1.id);

    // Should have no activities (no duplicate add activity)
    const activities = await prisma.todoActivity.findMany({
      where: { todoId: testTodo.id, action: 'LABELS_CHANGED' },
    });
    expect(activities).toHaveLength(0);
  });

  test('allows adding multiple labels to same todo', async () => {
    await addLabelToTodo(testTodo.id, label1.id);
    await addLabelToTodo(testTodo.id, label2.id);

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(2);
    expect(todoLabels.map((tl) => tl.labelId).sort()).toEqual(
      [label1.id, label2.id].sort(),
    );
  });

  test('creates separate activity for each label added', async () => {
    await addLabelToTodo(testTodo.id, label1.id);
    await addLabelToTodo(testTodo.id, label2.id);

    const activities = await prisma.todoActivity.findMany({
      where: { todoId: testTodo.id, action: 'LABELS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });

    expect(activities).toHaveLength(2);
    expect(activities[0].newValue).toBe('Bug');
    expect(activities[1].newValue).toBe('Feature');
  });

  test('allows any tenant member (not just admin) to add labels', async () => {
    // memberUser has MEMBER role, not ADMIN
    const result = await addLabelToTodo(testTodo.id, label1.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe('removeLabelFromTodo', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let memberUser: { id: string };
  let testTodo: { id: string };
  let label1: { id: string; name: string };
  let label2: { id: string; name: string };
  let otherTenantLabel: { id: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for RemoveLabelFromTodo' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for RemoveLabelFromTodo' },
    });
    memberUser = await prisma.user.create({
      data: {
        email: `remove-label-member-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    testTodo = await prisma.todo.create({
      data: {
        title: 'Test Todo',
        tenantId: testTenant.id,
        createdById: memberUser.id,
      },
    });
    label1 = await prisma.label.create({
      data: {
        name: 'Bug',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });
    label2 = await prisma.label.create({
      data: {
        name: 'Feature',
        color: '#22c55e',
        tenantId: testTenant.id,
      },
    });
    otherTenantLabel = await prisma.label.create({
      data: {
        name: 'Other Label',
        color: '#3b82f6',
        tenantId: otherTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: memberUser.id, tenantId: testTenant.id }),
    );
  });

  afterEach(async () => {
    await prisma.todoActivity.deleteMany({
      where: { todo: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
    });
    await prisma.todoLabel.deleteMany({
      where: { todo: { tenantId: { in: [testTenant.id, otherTenant.id] } } },
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

    const result = await removeLabelFromTodo(testTodo.id, label1.id);

    expect(result.error).toBe('Not authenticated');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo belongs to different tenant', async () => {
    const otherTodo = await prisma.todo.create({
      data: {
        title: 'Other Todo',
        tenantId: otherTenant.id,
        createdById: memberUser.id,
      },
    });

    const result = await removeLabelFromTodo(otherTodo.id, label1.id);

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when todo does not exist', async () => {
    const result = await removeLabelFromTodo('nonexistent-id', label1.id);

    expect(result.error).toBe('Todo not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label belongs to different tenant', async () => {
    const result = await removeLabelFromTodo(testTodo.id, otherTenantLabel.id);

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('returns error when label does not exist', async () => {
    const result = await removeLabelFromTodo(testTodo.id, 'nonexistent-label');

    expect(result.error).toBe('Label not found');
    expect(result.success).toBeUndefined();
  });

  test('removes label from todo successfully', async () => {
    // Add label first
    await prisma.todoLabel.create({
      data: { todoId: testTodo.id, labelId: label1.id },
    });

    const result = await removeLabelFromTodo(testTodo.id, label1.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(0);
  });

  test('creates LABELS_CHANGED activity with label name as oldValue', async () => {
    // Add label first
    await prisma.todoLabel.create({
      data: { todoId: testTodo.id, labelId: label1.id },
    });

    await removeLabelFromTodo(testTodo.id, label1.id);

    const activity = await prisma.todoActivity.findFirst({
      where: { todoId: testTodo.id, action: 'LABELS_CHANGED' },
    });

    expect(activity).toBeDefined();
    expect(activity?.action).toBe('LABELS_CHANGED');
    expect(activity?.actorId).toBe(memberUser.id);
    expect(activity?.field).toBe('labels');
    expect(activity?.oldValue).toBe('Bug');
    expect(activity?.newValue).toBeNull();
  });

  test('returns success when label not on todo (no-op)', async () => {
    // Label is not attached to todo
    const result = await removeLabelFromTodo(testTodo.id, label1.id);

    expect(result.success).toBe(true);
  });

  test('does not create activity when label not on todo', async () => {
    // Label is not attached to todo
    await removeLabelFromTodo(testTodo.id, label1.id);

    const activities = await prisma.todoActivity.findMany({
      where: { todoId: testTodo.id, action: 'LABELS_CHANGED' },
    });
    expect(activities).toHaveLength(0);
  });

  test('only removes specified label, leaves others intact', async () => {
    // Add two labels
    await prisma.todoLabel.createMany({
      data: [
        { todoId: testTodo.id, labelId: label1.id },
        { todoId: testTodo.id, labelId: label2.id },
      ],
    });

    await removeLabelFromTodo(testTodo.id, label1.id);

    const todoLabels = await prisma.todoLabel.findMany({
      where: { todoId: testTodo.id },
    });
    expect(todoLabels).toHaveLength(1);
    expect(todoLabels[0].labelId).toBe(label2.id);
  });

  test('creates separate activity for each label removed', async () => {
    // Add two labels
    await prisma.todoLabel.createMany({
      data: [
        { todoId: testTodo.id, labelId: label1.id },
        { todoId: testTodo.id, labelId: label2.id },
      ],
    });

    await removeLabelFromTodo(testTodo.id, label1.id);
    await removeLabelFromTodo(testTodo.id, label2.id);

    const activities = await prisma.todoActivity.findMany({
      where: { todoId: testTodo.id, action: 'LABELS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });

    expect(activities).toHaveLength(2);
    expect(activities[0].oldValue).toBe('Bug');
    expect(activities[1].oldValue).toBe('Feature');
  });

  test('allows any tenant member (not just admin) to remove labels', async () => {
    // Add label first
    await prisma.todoLabel.create({
      data: { todoId: testTodo.id, labelId: label1.id },
    });

    // memberUser has MEMBER role, not ADMIN
    const result = await removeLabelFromTodo(testTodo.id, label1.id);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe('getLabels', () => {
  let testTenant: { id: string };
  let otherTenant: { id: string };
  let testUser: { id: string };
  let label1: { id: string; name: string; color: string };

  beforeEach(async () => {
    testTenant = await prisma.tenant.create({
      data: { name: 'Test Tenant for getLabels' },
    });
    otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant for getLabels' },
    });
    testUser = await prisma.user.create({
      data: {
        email: `getlabels-user-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        tenantId: testTenant.id,
        role: 'MEMBER',
      },
    });
    label1 = await prisma.label.create({
      data: {
        name: 'Alpha',
        color: '#ef4444',
        tenantId: testTenant.id,
      },
    });
    // Create second label for testing ordering
    await prisma.label.create({
      data: {
        name: 'Beta',
        color: '#22c55e',
        tenantId: testTenant.id,
      },
    });
    // Create label in other tenant to test isolation
    await prisma.label.create({
      data: {
        name: 'Other Tenant Label',
        color: '#3b82f6',
        tenantId: otherTenant.id,
      },
    });

    mockGetSession.mockImplementation(() =>
      Promise.resolve({ userId: testUser.id, tenantId: testTenant.id }),
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

  test('returns empty array when not authenticated', async () => {
    mockGetSession.mockImplementation(() => Promise.resolve(null));

    const result = await getLabels();

    expect(result).toEqual([]);
  });

  test('returns labels for current tenant', async () => {
    const result = await getLabels();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Beta');
  });

  test('returns labels ordered by name ascending', async () => {
    const result = await getLabels();

    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Beta');
  });

  test('returns only id, name, and color fields', async () => {
    const result = await getLabels();

    expect(result[0]).toEqual({
      id: label1.id,
      name: 'Alpha',
      color: '#ef4444',
    });
  });

  test('does not return labels from other tenants', async () => {
    const result = await getLabels();

    // Should only have 2 labels from testTenant
    expect(result).toHaveLength(2);
    expect(result.find((l) => l.name === 'Other Tenant Label')).toBeUndefined();
  });

  test('returns empty array when tenant has no labels', async () => {
    // Delete all labels in test tenant
    await prisma.label.deleteMany({
      where: { tenantId: testTenant.id },
    });

    const result = await getLabels();

    expect(result).toEqual([]);
  });
});
