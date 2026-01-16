'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export type TemplateActionState = {
  success?: boolean;
  error?: string;
  templateId?: string;
};

/**
 * Retrieves all templates for the current user's tenant.
 * Returns templates with subtasks (ordered by order), labels with details,
 * counts, and createdBy user info. Ordered by name ascending.
 *
 * @returns Array of templates or empty array if not authenticated
 */
export async function getTemplates() {
  const session = await getSession();

  if (!session) {
    return [];
  }

  return prisma.todoTemplate.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: 'asc' },
    include: {
      subtasks: {
        orderBy: { order: 'asc' },
      },
      labels: {
        include: {
          label: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          email: true,
        },
      },
      _count: {
        select: {
          subtasks: true,
          labels: true,
        },
      },
    },
  });
}

export type CreateTemplateInput = {
  name: string;
  description?: string;
  labelIds: string[];
  subtasks: { title: string }[];
};

/**
 * Creates a new template for the tenant.
 * Any tenant member can create templates.
 * Validates: non-empty name, max 100 chars, max 2000 char description,
 * max 20 subtasks, max 50 templates per tenant, labels belong to tenant.
 *
 * @param input - The template data
 * @returns The result of the create operation with templateId on success
 */
export async function createTemplate(
  input: CreateTemplateInput,
): Promise<TemplateActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const name = input.name?.trim() || '';

  if (!name) {
    return { error: 'Template name is required' };
  }

  if (name.length > 100) {
    return { error: 'Template name must be 100 characters or less' };
  }

  const description = input.description?.trim() || null;

  if (input.description && input.description.length > 2000) {
    return { error: 'Description must be 2000 characters or less' };
  }

  if (input.subtasks.length > 20) {
    return { error: 'Maximum 20 subtasks per template' };
  }

  // Check template limit per tenant
  const templateCount = await prisma.todoTemplate.count({
    where: { tenantId: session.tenantId },
  });

  if (templateCount >= 50) {
    return { error: 'Maximum 50 templates per tenant reached' };
  }

  // Verify all labels belong to user's tenant
  if (input.labelIds.length > 0) {
    const validLabels = await prisma.label.count({
      where: {
        id: { in: input.labelIds },
        tenantId: session.tenantId,
      },
    });

    if (validLabels !== input.labelIds.length) {
      return { error: 'Invalid label selection' };
    }
  }

  const template = await prisma.todoTemplate.create({
    data: {
      name,
      description,
      tenantId: session.tenantId,
      createdById: session.userId,
      subtasks: {
        create: input.subtasks.map((subtask, index) => ({
          title: subtask.title.trim(),
          order: index,
        })),
      },
      labels: {
        create: input.labelIds.map((labelId) => ({
          labelId,
        })),
      },
    },
  });

  revalidatePath('/templates');
  return { success: true, templateId: template.id };
}

export type UpdateTemplateInput = {
  id: string;
  name: string;
  description?: string;
  labelIds: string[];
  subtasks: { title: string }[];
};

/**
 * Updates an existing template.
 * Validates: template belongs to tenant, non-empty name, max 100 chars,
 * max 2000 char description, max 20 subtasks, labels belong to tenant.
 * Deletes existing subtasks/labels and recreates them (atomic transaction).
 *
 * @param input - The template data including id
 * @returns The result of the update operation
 */
export async function updateTemplate(
  input: UpdateTemplateInput,
): Promise<TemplateActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Verify template exists and belongs to user's tenant
  const template = await prisma.todoTemplate.findUnique({
    where: { id: input.id },
    select: { tenantId: true },
  });

  if (!template || template.tenantId !== session.tenantId) {
    return { error: 'Template not found' };
  }

  const name = input.name?.trim() || '';

  if (!name) {
    return { error: 'Template name is required' };
  }

  if (name.length > 100) {
    return { error: 'Template name must be 100 characters or less' };
  }

  const description = input.description?.trim() || null;

  if (input.description && input.description.length > 2000) {
    return { error: 'Description must be 2000 characters or less' };
  }

  if (input.subtasks.length > 20) {
    return { error: 'Maximum 20 subtasks per template' };
  }

  // Verify all labels belong to user's tenant
  if (input.labelIds.length > 0) {
    const validLabels = await prisma.label.count({
      where: {
        id: { in: input.labelIds },
        tenantId: session.tenantId,
      },
    });

    if (validLabels !== input.labelIds.length) {
      return { error: 'Invalid label selection' };
    }
  }

  // Delete existing subtasks and labels, then recreate (atomic transaction)
  await prisma.$transaction([
    prisma.templateSubtask.deleteMany({
      where: { templateId: input.id },
    }),
    prisma.templateLabel.deleteMany({
      where: { templateId: input.id },
    }),
    prisma.todoTemplate.update({
      where: { id: input.id },
      data: {
        name,
        description,
        subtasks: {
          create: input.subtasks.map((subtask, index) => ({
            title: subtask.title.trim(),
            order: index,
          })),
        },
        labels: {
          create: input.labelIds.map((labelId) => ({
            labelId,
          })),
        },
      },
    }),
  ]);

  revalidatePath('/templates');
  return { success: true };
}

/**
 * Retrieves a single template by ID for the current user's tenant.
 * Returns the template with subtasks (ordered by order), labels with details,
 * counts, and createdBy user info.
 *
 * @param templateId - The ID of the template to retrieve
 * @returns Object containing template or null with error
 */
export async function getTemplate(templateId: string) {
  const session = await getSession();

  if (!session) {
    return { template: null, error: 'Not authenticated' };
  }

  const template = await prisma.todoTemplate.findUnique({
    where: { id: templateId },
    include: {
      subtasks: {
        orderBy: { order: 'asc' },
      },
      labels: {
        include: {
          label: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          email: true,
        },
      },
      _count: {
        select: {
          subtasks: true,
          labels: true,
        },
      },
    },
  });

  if (!template || template.tenantId !== session.tenantId) {
    return { template: null, error: 'Template not found' };
  }

  return { template };
}

/**
 * Deletes a template and its associated subtasks and labels.
 * Validates: template belongs to user's tenant.
 * Cascade delete handles subtasks and labels via Prisma schema.
 *
 * @param templateId - The ID of the template to delete
 * @returns The result of the delete operation
 */
export async function deleteTemplate(
  templateId: string,
): Promise<TemplateActionState> {
  const session = await getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Verify template exists and belongs to user's tenant
  const template = await prisma.todoTemplate.findUnique({
    where: { id: templateId },
    select: { tenantId: true },
  });

  if (!template || template.tenantId !== session.tenantId) {
    return { error: 'Template not found' };
  }

  await prisma.todoTemplate.delete({
    where: { id: templateId },
  });

  revalidatePath('/templates');
  return { success: true };
}
