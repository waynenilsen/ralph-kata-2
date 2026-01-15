'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createNotification } from './notifications';

export type CreateCommentState = {
  success?: boolean;
  error?: string;
};

/**
 * Creates a comment on a todo.
 * Validates that the user belongs to the same tenant as the todo (REQ-008).
 * Validates that comment content is not empty (REQ-006).
 *
 * @param todoId - The ID of the todo to comment on
 * @param _prevState - Previous state for useActionState
 * @param formData - Form data containing the comment content
 * @returns The result of the create operation
 */
export async function createComment(
  todoId: string,
  _prevState: CreateCommentState,
  formData: FormData,
): Promise<CreateCommentState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const rawContent = formData.get('content');
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';

  // REQ-006: Comment content shall not be empty
  if (!content) {
    return { error: 'Comment cannot be empty' };
  }

  // REQ-008: Verify user belongs to same tenant as todo
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    select: {
      id: true,
      title: true,
      createdById: true,
    },
  });

  if (!todo) {
    return { error: 'Todo not found' };
  }

  await prisma.comment.create({
    data: {
      content,
      todoId,
      authorId: session.userId,
    },
  });

  // REQ-004: Create notification if commenting on someone else's todo (not self-comment)
  if (todo.createdById !== session.userId) {
    const commenter = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });

    await createNotification({
      userId: todo.createdById,
      type: 'TODO_COMMENTED',
      message: `${commenter?.email ?? 'Someone'} commented on "${todo.title}"`,
      todoId,
    });
  }

  revalidatePath('/todos');

  return { success: true };
}
