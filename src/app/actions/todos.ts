'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  labelIds: z.string().optional(),
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
  };

  const result = createTodoSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { title, description, dueDate, assigneeId, labelIds } = result.data;

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

  await prisma.todo.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assigneeId: assigneeId || undefined,
      tenantId: session.tenantId,
      createdById: session.userId,
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

  revalidatePath('/todos');

  return {};
}

export type ToggleTodoResult = {
  success?: boolean;
  error?: string;
};

/**
 * Toggles the status of a todo between PENDING and COMPLETED.
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

  // First, get the current status of the todo (only if it belongs to the tenant)
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
    select: { status: true },
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

  revalidatePath('/todos');

  return { success: true };
}

export type UpdateTodoAssigneeResult = {
  success?: boolean;
  error?: string;
};

/**
 * Updates the assignee of a todo for quick reassignment.
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

  revalidatePath('/todos');

  return { success: true };
}
