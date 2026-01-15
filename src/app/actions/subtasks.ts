'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const MAX_SUBTASKS = 20;
const MAX_TITLE_LENGTH = 200;

export type SubtaskActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Creates a subtask on a todo.
 * Validates that the user belongs to the same tenant as the todo.
 * Validates that subtask title is not empty and within length limit.
 * Enforces maximum 20 subtasks per todo.
 *
 * @param todoId - The ID of the todo to add subtask to
 * @param _prevState - Previous state for useActionState
 * @param formData - Form data containing the subtask title
 * @returns The result of the create operation
 */
export async function createSubtask(
  todoId: string,
  _prevState: SubtaskActionState,
  formData: FormData,
): Promise<SubtaskActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const rawTitle = formData.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';

  // REQ-005: Subtask title shall not be empty
  if (!title) {
    return { error: 'Subtask title cannot be empty' };
  }

  // REQ-006: Subtask title shall have max length of 200 characters
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      error: `Subtask title must be ${MAX_TITLE_LENGTH} characters or less`,
    };
  }

  // REQ-009: Verify user belongs to same tenant as todo
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
  });

  if (!todo) {
    return { error: 'Todo not found' };
  }

  // REQ-007: Maximum 20 subtasks per todo
  const subtaskCount = await prisma.subtask.count({ where: { todoId } });
  if (subtaskCount >= MAX_SUBTASKS) {
    return { error: `Maximum ${MAX_SUBTASKS} subtasks allowed per todo` };
  }

  // REQ-010: New subtasks should be appended at end (highest order + 1)
  const lastSubtask = await prisma.subtask.findFirst({
    where: { todoId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const nextOrder = (lastSubtask?.order ?? -1) + 1;

  await prisma.subtask.create({
    data: {
      title,
      todoId,
      order: nextOrder,
      isComplete: false,
    },
  });

  revalidatePath('/todos');
  return { success: true };
}

/**
 * Updates a subtask's title.
 * Validates that the user belongs to the same tenant as the todo.
 * Validates that subtask title is not empty and within length limit.
 *
 * @param subtaskId - The ID of the subtask to update
 * @param _prevState - Previous state for useActionState
 * @param formData - Form data containing the new title
 * @returns The result of the update operation
 */
export async function updateSubtask(
  subtaskId: string,
  _prevState: SubtaskActionState,
  formData: FormData,
): Promise<SubtaskActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const rawTitle = formData.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';

  // REQ-005: Subtask title shall not be empty
  if (!title) {
    return { error: 'Subtask title cannot be empty' };
  }

  // REQ-006: Subtask title shall have max length of 200 characters
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      error: `Subtask title must be ${MAX_TITLE_LENGTH} characters or less`,
    };
  }

  // REQ-009: Get subtask and verify user belongs to same tenant as todo
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { todo: { select: { tenantId: true } } },
  });

  if (!subtask || subtask.todo.tenantId !== session.tenantId) {
    return { error: 'Subtask not found' };
  }

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { title },
  });

  revalidatePath('/todos');
  return { success: true };
}

/**
 * Toggles a subtask's completion state.
 * Validates that the user belongs to the same tenant as the todo.
 *
 * @param subtaskId - The ID of the subtask to toggle
 * @returns The result of the toggle operation
 */
export async function toggleSubtask(
  subtaskId: string,
): Promise<SubtaskActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // REQ-009: Get subtask and verify user belongs to same tenant as todo
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { todo: { select: { tenantId: true } } },
  });

  if (!subtask || subtask.todo.tenantId !== session.tenantId) {
    return { error: 'Subtask not found' };
  }

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { isComplete: !subtask.isComplete },
  });

  revalidatePath('/todos');
  return { success: true };
}

/**
 * Deletes a subtask.
 * Validates that the user belongs to the same tenant as the todo.
 *
 * @param subtaskId - The ID of the subtask to delete
 * @returns The result of the delete operation
 */
export async function deleteSubtask(
  subtaskId: string,
): Promise<SubtaskActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // REQ-009: Get subtask and verify user belongs to same tenant as todo
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { todo: { select: { tenantId: true } } },
  });

  if (!subtask || subtask.todo.tenantId !== session.tenantId) {
    return { error: 'Subtask not found' };
  }

  await prisma.subtask.delete({
    where: { id: subtaskId },
  });

  revalidatePath('/todos');
  return { success: true };
}
