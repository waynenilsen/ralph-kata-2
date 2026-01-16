'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createTodoActivity } from './activities';

export type LabelState = {
  success?: boolean;
  error?: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
};

/**
 * Retrieves all labels for the current user's tenant.
 * Returns labels ordered by name ascending.
 *
 * @returns Array of labels or empty array if not authenticated
 */
export async function getLabels(): Promise<Label[]> {
  const session = await getSession();

  if (!session) {
    return [];
  }

  return prisma.label.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Creates a new label for the tenant.
 * Only ADMIN users can create labels.
 * Validates: non-empty name, max 30 chars, valid hex color, unique name.
 *
 * @param _prevState - Previous state for useActionState
 * @param formData - Form data containing name and color
 * @returns The result of the create operation
 */
export async function createLabel(
  _prevState: LabelState,
  formData: FormData,
): Promise<LabelState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Check if user is ADMIN
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    return { error: 'Only admins can create labels' };
  }

  const rawName = formData.get('name');
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const color = formData.get('color') as string;

  if (!name) {
    return { error: 'Label name is required' };
  }

  if (name.length > 30) {
    return { error: 'Label name must be 30 characters or less' };
  }

  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { error: 'Invalid color format' };
  }

  // Check for duplicate name (case-insensitive)
  // SQLite doesn't support case-insensitive mode, so we use raw SQL
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Label
    WHERE tenantId = ${session.tenantId}
    AND LOWER(name) = LOWER(${name})
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { error: 'A label with this name already exists' };
  }

  await prisma.label.create({
    data: {
      name,
      color,
      tenantId: session.tenantId,
    },
  });

  revalidatePath('/settings/labels');
  revalidatePath('/todos');

  return { success: true };
}

/**
 * Updates an existing label.
 * Only ADMIN users can update labels.
 * Validates: tenant ownership, non-empty name, max 30 chars, valid hex color, unique name.
 *
 * @param labelId - The ID of the label to update
 * @param _prevState - Previous state for useActionState
 * @param formData - Form data containing name and color
 * @returns The result of the update operation
 */
export async function updateLabel(
  labelId: string,
  _prevState: LabelState,
  formData: FormData,
): Promise<LabelState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Check if user is ADMIN
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    return { error: 'Only admins can update labels' };
  }

  const rawName = formData.get('name');
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const color = formData.get('color') as string;

  if (!name) {
    return { error: 'Label name is required' };
  }

  if (name.length > 30) {
    return { error: 'Label name must be 30 characters or less' };
  }

  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { error: 'Invalid color format' };
  }

  // Verify label belongs to user's tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true },
  });

  if (!label || label.tenantId !== session.tenantId) {
    return { error: 'Label not found' };
  }

  // Check for duplicate name (case-insensitive), excluding current label
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM Label
    WHERE tenantId = ${session.tenantId}
    AND LOWER(name) = LOWER(${name})
    AND id != ${labelId}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { error: 'A label with this name already exists' };
  }

  await prisma.label.update({
    where: { id: labelId },
    data: { name, color },
  });

  revalidatePath('/settings/labels');
  revalidatePath('/todos');

  return { success: true };
}

/**
 * Deletes a label.
 * Only ADMIN users can delete labels.
 * Cascade deletes TodoLabel entries but not the todos themselves.
 *
 * @param labelId - The ID of the label to delete
 * @returns The result of the delete operation
 */
export async function deleteLabel(labelId: string): Promise<LabelState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Check if user is ADMIN
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    return { error: 'Only admins can delete labels' };
  }

  // Verify label belongs to user's tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true },
  });

  if (!label || label.tenantId !== session.tenantId) {
    return { error: 'Label not found' };
  }

  // Delete label (cascade deletes TodoLabel entries via Prisma schema)
  await prisma.label.delete({
    where: { id: labelId },
  });

  revalidatePath('/settings/labels');
  revalidatePath('/todos');

  return { success: true };
}

/**
 * Updates labels on a todo (replaces all existing labels).
 * Any tenant member can update labels on todos in their tenant.
 * Uses a transaction for atomic delete + create operations.
 *
 * @param todoId - The ID of the todo to update labels for
 * @param labelIds - Array of label IDs to assign to the todo
 * @returns The result of the update operation
 */
export async function updateTodoLabels(
  todoId: string,
  labelIds: string[],
): Promise<LabelState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Verify todo belongs to user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });

  if (!todo || todo.tenantId !== session.tenantId) {
    return { error: 'Todo not found' };
  }

  // Deduplicate label IDs
  const uniqueLabelIds = [...new Set(labelIds)];

  // Verify all labels belong to the same tenant
  if (uniqueLabelIds.length > 0) {
    const labels = await prisma.label.findMany({
      where: {
        id: { in: uniqueLabelIds },
        tenantId: session.tenantId,
      },
    });

    if (labels.length !== uniqueLabelIds.length) {
      return { error: 'Invalid labels' };
    }
  }

  // Replace all labels on the todo using a transaction
  await prisma.$transaction([
    prisma.todoLabel.deleteMany({ where: { todoId } }),
    ...uniqueLabelIds.map((labelId) =>
      prisma.todoLabel.create({ data: { todoId, labelId } }),
    ),
  ]);

  revalidatePath('/todos');

  return { success: true };
}

/**
 * Adds a single label to a todo.
 * Any tenant member can add labels to todos in their tenant.
 * Creates a LABELS_CHANGED activity entry when the label is added.
 *
 * @param todoId - The ID of the todo to add the label to
 * @param labelId - The ID of the label to add
 * @returns The result of the add operation
 */
export async function addLabelToTodo(
  todoId: string,
  labelId: string,
): Promise<LabelState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Verify todo belongs to user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });

  if (!todo || todo.tenantId !== session.tenantId) {
    return { error: 'Todo not found' };
  }

  // Verify label belongs to user's tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true, name: true },
  });

  if (!label || label.tenantId !== session.tenantId) {
    return { error: 'Label not found' };
  }

  // Check if label is already attached to the todo
  const existingTodoLabel = await prisma.todoLabel.findUnique({
    where: {
      todoId_labelId: {
        todoId,
        labelId,
      },
    },
  });

  if (existingTodoLabel) {
    // Already attached, no-op
    return { success: true };
  }

  // Add the label to the todo
  await prisma.todoLabel.create({
    data: { todoId, labelId },
  });

  // REQ-004: Create activity for label addition
  await createTodoActivity({
    todoId,
    actorId: session.userId,
    action: 'LABELS_CHANGED',
    field: 'labels',
    oldValue: null,
    newValue: label.name,
  });

  revalidatePath('/todos');

  return { success: true };
}

/**
 * Removes a single label from a todo.
 * Any tenant member can remove labels from todos in their tenant.
 * Creates a LABELS_CHANGED activity entry when the label is removed.
 *
 * @param todoId - The ID of the todo to remove the label from
 * @param labelId - The ID of the label to remove
 * @returns The result of the remove operation
 */
export async function removeLabelFromTodo(
  todoId: string,
  labelId: string,
): Promise<LabelState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Verify todo belongs to user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });

  if (!todo || todo.tenantId !== session.tenantId) {
    return { error: 'Todo not found' };
  }

  // Verify label belongs to user's tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true, name: true },
  });

  if (!label || label.tenantId !== session.tenantId) {
    return { error: 'Label not found' };
  }

  // Check if label is attached to the todo
  const existingTodoLabel = await prisma.todoLabel.findUnique({
    where: {
      todoId_labelId: {
        todoId,
        labelId,
      },
    },
  });

  if (!existingTodoLabel) {
    // Not attached, no-op
    return { success: true };
  }

  // Remove the label from the todo
  await prisma.todoLabel.delete({
    where: {
      todoId_labelId: {
        todoId,
        labelId,
      },
    },
  });

  // REQ-004: Create activity for label removal
  await createTodoActivity({
    todoId,
    actorId: session.userId,
    action: 'LABELS_CHANGED',
    field: 'labels',
    oldValue: label.name,
    newValue: null,
  });

  revalidatePath('/todos');

  return { success: true };
}
