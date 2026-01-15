'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

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

  revalidatePath('/todos');

  return { success: true };
}
