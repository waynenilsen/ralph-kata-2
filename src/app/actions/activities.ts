'use server';

import type { ActivityAction } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export type Activity = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: ActivityAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

/**
 * Creates an activity entry for a todo.
 * Internal helper function called by other server actions.
 *
 * @param data - Activity data including todoId, actorId, action, and optional field/values
 */
export async function createTodoActivity(data: {
  todoId: string;
  actorId: string;
  action: ActivityAction;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  await prisma.todoActivity.create({
    data: {
      todoId: data.todoId,
      actorId: data.actorId,
      action: data.action,
      field: data.field ?? null,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
    },
  });
}

/**
 * Gets activities for a todo.
 * Verifies the todo belongs to the current user's tenant (REQ-012).
 * Returns activities ordered by createdAt desc (newest first).
 *
 * @param todoId - The ID of the todo to get activities for
 * @returns Activities with actor email for display, or error
 */
export async function getTodoActivities(todoId: string): Promise<{
  activities: Activity[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { activities: [], error: 'Not authenticated' };
  }

  // REQ-012: Verify todo belongs to current user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });

  if (!todo || todo.tenantId !== session.tenantId) {
    return { activities: [], error: 'Todo not found' };
  }

  const activities = await prisma.todoActivity.findMany({
    where: { todoId },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: { email: true },
      },
    },
  });

  return {
    activities: activities.map((a) => ({
      id: a.id,
      actorId: a.actorId,
      actorEmail: a.actor.email,
      action: a.action,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      createdAt: a.createdAt,
    })),
  };
}
