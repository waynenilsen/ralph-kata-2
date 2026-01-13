'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

const updateTodoSchema = z.object({
  id: z.string().min(1, 'Todo ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

export type CreateTodoState = {
  errors?: {
    title?: string[];
    description?: string[];
    dueDate?: string[];
    _form?: string[];
  };
};

export type UpdateTodoState = {
  errors?: {
    id?: string[];
    title?: string[];
    description?: string[];
    dueDate?: string[];
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
  };

  const result = createTodoSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { title, description, dueDate } = result.data;

  await prisma.todo.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tenantId: session.tenantId,
      createdById: session.userId,
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
  };

  const result = updateTodoSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { id, title, description, dueDate } = result.data;

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
