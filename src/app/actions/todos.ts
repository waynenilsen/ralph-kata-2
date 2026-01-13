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
