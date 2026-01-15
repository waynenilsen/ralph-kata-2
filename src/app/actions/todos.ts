'use server';

import type { RecurrenceType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateNextRecurringTodo } from '@/lib/recurrence';
import { getSession } from '@/lib/session';
import { createTodoActivity } from './activities';
import { createNotification } from './notifications';

const recurrenceTypeEnum = z.enum([
  'NONE',
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'YEARLY',
]);

const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  labelIds: z.string().optional(),
  recurrenceType: recurrenceTypeEnum.optional().default('NONE'),
});

const updateTodoSchema = z.object({
  id: z.string().min(1, 'Todo ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export type CreateTodoState = {
  errors?: {
    title?: string[];
    description?: string[];
    dueDate?: string[];
    assigneeId?: string[];
    _form?: string[];
  };
};

export type UpdateTodoState = {
  errors?: {
    id?: string[];
    title?: string[];
    description?: string[];
    dueDate?: string[];
    assigneeId?: string[];
    _form?: string[];
  };
  success?: boolean;
};

export async function createTodo(
  _prevState: CreateTodoState,
  formData: FormData,
): Promise<CreateTodoState> {
  const session = await getSession();

  if (!session) {
    return {
      errors: {
        _form: ['You must be authenticated to create a todo'],
      },
    };
  }

  const rawData = {
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    dueDate: formData.get('dueDate') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
    labelIds: formData.get('labelIds') || undefined,
    recurrenceType: formData.get('recurrenceType') || undefined,
  };

  const result = createTodoSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { title, description, dueDate, assigneeId, labelIds, recurrenceType } =
    result.data;

  // Validate assignee belongs to same tenant (IDOR prevention)
  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, tenantId: session.tenantId },
    });
    if (!assignee) {
      return {
        errors: {
          assigneeId: ['Invalid assignee'],
        },
      };
    }
  }

  // Parse and validate label IDs
  const parsedLabelIds = labelIds
    ? labelIds.split(',').filter((id) => id.trim())
    : [];

  if (parsedLabelIds.length > 0) {
    const validLabels = await prisma.label.findMany({
      where: {
        id: { in: parsedLabelIds },
        tenantId: session.tenantId,
      },
    });
    if (validLabels.length !== parsedLabelIds.length) {
      return {
        errors: {
          _form: ['Invalid labels'],
        },
      };
    }
  }

  const todo = await prisma.todo.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assigneeId: assigneeId || undefined,
      tenantId: session.tenantId,
      createdById: session.userId,
      recurrenceType: dueDate ? recurrenceType : 'NONE',
      labels:
        parsedLabelIds.length > 0
          ? {
              create: parsedLabelIds.map((labelId) => ({
                labelId,
              })),
            }
          : undefined,
    },
  });

  // REQ-003: Create activity for todo creation
  await createTodoActivity({
    todoId: todo.id,
    actorId: session.userId,
    action: 'CREATED',
  });

  revalidatePath('/todos');

  return {};
}

export type ToggleTodoResult = {
  success?: boolean;
  error?: string;
};

/**
 * Toggles the status of a todo between PENDING and COMPLETED.
 * When completing a recurring todo, generates the next instance.
 * @param todoId - The ID of the todo to toggle
 * @returns The result of the toggle operation
 */
export async function toggleTodo(todoId: string): Promise<ToggleTodoResult> {
  const session = await getSession();

  if (!session) {
    return {
      error: 'You must be authenticated to toggle a todo',
    };
  }

  // First, get the current status and recurrence info of the todo (only if it belongs to the tenant)
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    select: { status: true, recurrenceType: true, dueDate: true },
  });

  if (!todo) {
    return {
      error: 'Todo not found or you do not have permission to update it',
    };
  }

  const newStatus = todo.status === 'PENDING' ? 'COMPLETED' : 'PENDING';

  // Use updateMany with tenantId filter to prevent IDOR attacks
  await prisma.todo.updateMany({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    data: {
      status: newStatus,
    },
  });

  // REQ-004: Create activity for status change
  await createTodoActivity({
    todoId,
    actorId: session.userId,
    action: 'STATUS_CHANGED',
    field: 'status',
    oldValue: todo.status,
    newValue: newStatus,
  });

  // Generate next recurring instance when completing a recurring todo
  if (
    newStatus === 'COMPLETED' &&
    todo.recurrenceType !== 'NONE' &&
    todo.dueDate
  ) {
    await generateNextRecurringTodo(todoId);
  }

  revalidatePath('/todos');

  return { success: true };
}

export type DeleteTodoResult = {
  success?: boolean;
  error?: string;
};

/**
 * Deletes a todo by ID.
 * Uses deleteMany with tenantId filter to prevent IDOR attacks.
 * @param todoId - The ID of the todo to delete
 * @returns The result of the delete operation
 */
export async function deleteTodo(todoId: string): Promise<DeleteTodoResult> {
  const session = await getSession();

  if (!session) {
    return {
      error: 'You must be authenticated to delete a todo',
    };
  }

  // Use deleteMany with tenantId filter to prevent IDOR attacks
  const result = await prisma.todo.deleteMany({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
  });

  if (result.count === 0) {
    return {
      error: 'Todo not found or you do not have permission to delete it',
    };
  }

  revalidatePath('/todos');

  return { success: true };
}

export async function updateTodo(
  _prevState: UpdateTodoState,
  formData: FormData,
): Promise<UpdateTodoState> {
  const session = await getSession();

  if (!session) {
    return {
      errors: {
        _form: ['You must be authenticated to update a todo'],
      },
    };
  }

  const rawData = {
    id: formData.get('id'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    dueDate: formData.get('dueDate') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
  };

  const result = updateTodoSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { id, title, description, dueDate, assigneeId } = result.data;

  // Validate assignee belongs to same tenant (IDOR prevention)
  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, tenantId: session.tenantId },
    });
    if (!assignee) {
      return {
        errors: {
          assigneeId: ['Invalid assignee'],
        },
      };
    }
  }

  // Fetch current todo to check previous assignee and due date for activity tracking
  const currentTodo = await prisma.todo.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { assigneeId: true, dueDate: true, title: true },
  });

  if (!currentTodo) {
    return {
      errors: {
        _form: ['Todo not found or you do not have permission to update it'],
      },
    };
  }

  // Use updateMany with tenantId filter to prevent IDOR attacks
  const updateResult = await prisma.todo.updateMany({
    where: {
      id,
      tenantId: session.tenantId,
    },
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId: assigneeId ?? null,
    },
  });

  if (updateResult.count === 0) {
    return {
      errors: {
        _form: ['Todo not found or you do not have permission to update it'],
      },
    };
  }

  // REQ-004: Create activity for assignee change (only if actually changed)
  const newAssigneeId = assigneeId ?? null;
  if (newAssigneeId !== currentTodo.assigneeId) {
    await createTodoActivity({
      todoId: id,
      actorId: session.userId,
      action: 'ASSIGNEE_CHANGED',
      field: 'assigneeId',
      oldValue: currentTodo.assigneeId,
      newValue: newAssigneeId,
    });
  }

  // REQ-004: Create activity for due date change (only if actually changed)
  const newDueDate = dueDate ? new Date(dueDate) : null;
  const oldDueDateIso = currentTodo.dueDate?.toISOString() ?? null;
  const newDueDateIso = newDueDate?.toISOString() ?? null;
  if (oldDueDateIso !== newDueDateIso) {
    await createTodoActivity({
      todoId: id,
      actorId: session.userId,
      action: 'DUE_DATE_CHANGED',
      field: 'dueDate',
      oldValue: oldDueDateIso,
      newValue: newDueDateIso,
    });
  }

  // REQ-003: Create notification if assigning to someone else (not self-assignment)
  // and the assignee is different from the previous assignee
  if (
    assigneeId &&
    assigneeId !== session.userId &&
    assigneeId !== currentTodo.assigneeId
  ) {
    const assigner = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });

    await createNotification({
      userId: assigneeId,
      type: 'TODO_ASSIGNED',
      message: `${assigner?.email ?? 'Someone'} assigned you to "${title}"`,
      todoId: id,
    });
  }

  revalidatePath('/todos');

  return { success: true };
}

export type UpdateTodoAssigneeResult = {
  success?: boolean;
  error?: string;
};

/**
 * Updates the assignee of a todo for quick reassignment.
 * Creates a notification when assigning to someone other than self.
 * @param todoId - The ID of the todo to update
 * @param assigneeId - The ID of the new assignee, or null to unassign
 * @returns The result of the update operation
 */
export async function updateTodoAssignee(
  todoId: string,
  assigneeId: string | null,
): Promise<UpdateTodoAssigneeResult> {
  const session = await getSession();

  if (!session) {
    return {
      error: 'You must be authenticated to update a todo assignee',
    };
  }

  // Validate assignee belongs to same tenant (IDOR prevention)
  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, tenantId: session.tenantId },
    });
    if (!assignee) {
      return {
        error: 'Invalid assignee',
      };
    }
  }

  // Fetch current todo to check previous assignee and get title for notification
  const todo = await prisma.todo.findFirst({
    where: { id: todoId, tenantId: session.tenantId },
    select: { assigneeId: true, title: true },
  });

  if (!todo) {
    return {
      error: 'Todo not found or you do not have permission to update it',
    };
  }

  // REQ-005: Skip if assignee unchanged (no-op)
  if (assigneeId === todo.assigneeId) {
    return { success: true };
  }

  // Use updateMany with tenantId filter to prevent IDOR attacks
  const updateResult = await prisma.todo.updateMany({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    data: {
      assigneeId: assigneeId,
    },
  });

  if (updateResult.count === 0) {
    return {
      error: 'Todo not found or you do not have permission to update it',
    };
  }

  // REQ-004: Create activity for assignee change
  await createTodoActivity({
    todoId,
    actorId: session.userId,
    action: 'ASSIGNEE_CHANGED',
    field: 'assigneeId',
    oldValue: todo.assigneeId,
    newValue: assigneeId,
  });

  // Create notification if assigning to someone else (not self-assignment)
  if (assigneeId && assigneeId !== session.userId) {
    const assigner = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });

    await createNotification({
      userId: assigneeId,
      type: 'TODO_ASSIGNED',
      message: `${assigner?.email ?? 'Someone'} assigned you to "${todo.title}"`,
      todoId,
    });
  }

  revalidatePath('/todos');

  return { success: true };
}

export type UpdateTodoRecurrenceResult = {
  success?: boolean;
  error?: string;
};

/**
 * Updates the recurrence setting of a todo.
 * Validates that recurrence can only be set when a due date is present.
 * @param todoId - The ID of the todo to update
 * @param recurrenceType - The new recurrence type
 * @returns The result of the update operation
 */
export async function updateTodoRecurrence(
  todoId: string,
  recurrenceType: RecurrenceType,
): Promise<UpdateTodoRecurrenceResult> {
  const session = await getSession();

  if (!session) {
    return {
      error: 'You must be authenticated to update todo recurrence',
    };
  }

  // Get the todo to verify tenant and check for due date
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    select: { dueDate: true },
  });

  if (!todo) {
    return {
      error: 'Todo not found or you do not have permission to update it',
    };
  }

  // Recurrence requires a due date (except when setting to NONE)
  if (recurrenceType !== 'NONE' && !todo.dueDate) {
    return {
      error: 'Cannot set recurrence without a due date',
    };
  }

  // Update the recurrence type
  await prisma.todo.updateMany({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    data: {
      recurrenceType,
    },
  });

  revalidatePath('/todos');

  return { success: true };
}
