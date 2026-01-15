ERD: 0019
Title: Todo Templates
Author: Engineering
Status: Draft
PRD: [PRD-0019](../prd/0019-todo-templates.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding todo templates. Users can create reusable templates with pre-defined title, description, labels, and subtasks, then instantiate new todos from these templates.

---

## Background

- PRD-0019 defines the product requirements for todo templates
- PRD-0001 established the multi-tenant todo system
- PRD-0012 added labels which can be pre-selected in templates
- PRD-0014 added subtasks which can be pre-defined in templates
- Users need a way to quickly create todos with consistent structures

---

## Goals and Non-Goals

**Goals:**
- Add TodoTemplate model to store reusable todo structures
- Add TemplateSubtask model for template subtasks
- Add TemplateLabel junction table for template labels
- Templates page for viewing and managing templates
- Create/edit/delete template dialogs
- Create todo from template action
- Templates scoped to tenant (visible to all team members)

**Non-Goals:**
- Template versioning or history
- Template variables or dynamic fields
- Template scheduling
- Template categories or folders
- Import/export functionality
- Converting existing todos to templates
- Template analytics

---

## Constraints Checklist

- [x] Uses SQLite (not Postgres, MySQL, etc.)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Create Todo    │────▶│  Copy Template  │────▶│   New Todo      │
│  from Template  │     │  Properties     │     │   Created       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐       ┌─────▼─────┐
              │  Labels   │       │ Subtasks  │
              │  Copied   │       │  Copied   │
              └───────────┘       └───────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| TodoTemplate model | Store template metadata (name, description) |
| TemplateSubtask model | Store template subtasks |
| TemplateLabel junction | Associate templates with labels |
| createTemplate action | Create new template |
| updateTemplate action | Edit existing template |
| deleteTemplate action | Remove template |
| getTemplates action | List tenant templates |
| createTodoFromTemplate action | Create todo with template data |
| TemplatesPage | Templates list view |
| TemplateCard | Display single template |
| TemplateDialog | Create/edit template form |
| TemplateSelector | Choose template when creating todo |

**Data Flow**

1. User creates a template:
   a. createTemplate action creates TodoTemplate record
   b. TemplateSubtask records created for each subtask
   c. TemplateLabel records created for each selected label
   d. Template appears in templates list

2. User creates todo from template:
   a. createTodoFromTemplate action reads template data
   b. New Todo record created with template title, description
   c. TodoLabel records created for each template label
   d. Subtask records created for each template subtask
   e. Todo edit dialog opens with pre-filled data
   f. User modifies and saves todo

3. User edits a template:
   a. updateTemplate action updates TodoTemplate record
   b. Subtasks replaced (delete all, recreate)
   c. Labels replaced (delete all, recreate)
   d. Changes only affect future todos

4. User deletes a template:
   a. deleteTemplate action removes TodoTemplate
   b. Cascade deletes TemplateSubtask and TemplateLabel records
   c. Existing todos created from template are NOT affected

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | TodoTemplate model shall have id, name, description, tenantId, createdById, timestamps | Must |
| REQ-002 | TemplateSubtask model shall have id, title, order, templateId | Must |
| REQ-003 | TemplateLabel junction shall have templateId and labelId | Must |
| REQ-004 | Templates shall be scoped to tenant (visible to all members) | Must |
| REQ-005 | createTemplate action shall create template with subtasks and labels | Must |
| REQ-006 | updateTemplate action shall update template, replace subtasks and labels | Must |
| REQ-007 | deleteTemplate action shall remove template with cascade | Must |
| REQ-008 | getTemplates action shall return all templates for user's tenant | Must |
| REQ-009 | createTodoFromTemplate shall create todo with template properties | Must |
| REQ-010 | Created todo shall have title, description, labels, subtasks from template | Must |
| REQ-011 | Maximum 50 templates per tenant shall be enforced | Should |
| REQ-012 | Maximum 20 subtasks per template shall be enforced | Should |
| REQ-013 | Template name shall be required, max 100 characters | Should |
| REQ-014 | Template description shall be optional, max 2000 characters | Should |
| REQ-015 | Templates page shall show all templates with name, description, counts | Should |
| REQ-016 | TodoTemplate table shall be indexed on tenantId | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/templates.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type TemplateActionState = {
  success?: boolean;
  error?: string;
  templateId?: string;
};

export type CreateTemplateInput = {
  name: string;
  description?: string;
  labelIds: string[];
  subtasks: { title: string }[];
};

// Create a new template
export async function createTemplate(input: CreateTemplateInput): Promise<TemplateActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (!input.name || input.name.trim().length === 0) {
    return { error: 'Template name is required' };
  }

  if (input.name.length > 100) {
    return { error: 'Template name must be 100 characters or less' };
  }

  if (input.description && input.description.length > 2000) {
    return { error: 'Description must be 2000 characters or less' };
  }

  if (input.subtasks.length > 20) {
    return { error: 'Maximum 20 subtasks per template' };
  }

  // Check template limit
  const templateCount = await prisma.todoTemplate.count({
    where: { tenantId: session.user.tenantId },
  });

  if (templateCount >= 50) {
    return { error: 'Maximum 50 templates per tenant reached' };
  }

  // Verify labels belong to tenant
  if (input.labelIds.length > 0) {
    const validLabels = await prisma.label.count({
      where: {
        id: { in: input.labelIds },
        tenantId: session.user.tenantId,
      },
    });

    if (validLabels !== input.labelIds.length) {
      return { error: 'Invalid label selection' };
    }
  }

  const template = await prisma.todoTemplate.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      tenantId: session.user.tenantId,
      createdById: session.user.id,
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

// Update an existing template
export async function updateTemplate(input: UpdateTemplateInput): Promise<TemplateActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const template = await prisma.todoTemplate.findUnique({
    where: { id: input.id },
    select: { tenantId: true },
  });

  if (!template || template.tenantId !== session.user.tenantId) {
    return { error: 'Template not found' };
  }

  if (!input.name || input.name.trim().length === 0) {
    return { error: 'Template name is required' };
  }

  if (input.name.length > 100) {
    return { error: 'Template name must be 100 characters or less' };
  }

  if (input.description && input.description.length > 2000) {
    return { error: 'Description must be 2000 characters or less' };
  }

  if (input.subtasks.length > 20) {
    return { error: 'Maximum 20 subtasks per template' };
  }

  // Verify labels belong to tenant
  if (input.labelIds.length > 0) {
    const validLabels = await prisma.label.count({
      where: {
        id: { in: input.labelIds },
        tenantId: session.user.tenantId,
      },
    });

    if (validLabels !== input.labelIds.length) {
      return { error: 'Invalid label selection' };
    }
  }

  // Delete existing subtasks and labels, then recreate
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
        name: input.name.trim(),
        description: input.description?.trim() || null,
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

// Delete a template
export async function deleteTemplate(templateId: string): Promise<TemplateActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const template = await prisma.todoTemplate.findUnique({
    where: { id: templateId },
    select: { tenantId: true },
  });

  if (!template || template.tenantId !== session.user.tenantId) {
    return { error: 'Template not found' };
  }

  // Cascade deletes subtasks and labels
  await prisma.todoTemplate.delete({
    where: { id: templateId },
  });

  revalidatePath('/templates');
  return { success: true };
}

export type Template = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; email: string };
  labels: { label: { id: string; name: string; color: string } }[];
  subtasks: { id: string; title: string; order: number }[];
  _count: { subtasks: number; labels: number };
};

// Get all templates for tenant
export async function getTemplates(): Promise<{
  templates: Template[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { templates: [], error: 'Not authenticated' };
  }

  const templates = await prisma.todoTemplate.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: 'asc' },
    include: {
      createdBy: { select: { id: true, email: true } },
      labels: { include: { label: true } },
      subtasks: { orderBy: { order: 'asc' } },
      _count: { select: { subtasks: true, labels: true } },
    },
  });

  return { templates };
}

// Get single template by ID
export async function getTemplate(templateId: string): Promise<{
  template: Template | null;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { template: null, error: 'Not authenticated' };
  }

  const template = await prisma.todoTemplate.findUnique({
    where: { id: templateId },
    include: {
      createdBy: { select: { id: true, email: true } },
      labels: { include: { label: true } },
      subtasks: { orderBy: { order: 'asc' } },
      _count: { select: { subtasks: true, labels: true } },
    },
  });

  if (!template || template.tenantId !== session.user.tenantId) {
    return { template: null, error: 'Template not found' };
  }

  return { template };
}
```

### Create Todo from Template Action

```typescript
// app/actions/todos.ts - add createTodoFromTemplate

export async function createTodoFromTemplate(templateId: string): Promise<{
  todo?: Todo;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const template = await prisma.todoTemplate.findUnique({
    where: { id: templateId },
    include: {
      labels: { select: { labelId: true } },
      subtasks: { orderBy: { order: 'asc' } },
    },
  });

  if (!template || template.tenantId !== session.user.tenantId) {
    return { error: 'Template not found' };
  }

  const todo = await prisma.todo.create({
    data: {
      title: template.name,
      description: template.description,
      status: 'PENDING',
      tenantId: session.user.tenantId,
      createdById: session.user.id,
      labels: {
        create: template.labels.map(({ labelId }) => ({
          labelId,
        })),
      },
      subtasks: {
        create: template.subtasks.map((subtask, index) => ({
          title: subtask.title,
          isComplete: false,
          order: index,
        })),
      },
    },
    include: {
      labels: { include: { label: true } },
      assignee: { select: { id: true, email: true } },
      subtasks: { orderBy: { order: 'asc' } },
      _count: { select: { subtasks: true, comments: true } },
    },
  });

  // Create activity for todo creation
  await prisma.todoActivity.create({
    data: {
      todoId: todo.id,
      actorId: session.user.id,
      action: 'CREATED',
    },
  });

  revalidatePath('/todos');
  return { todo };
}
```

---

## Data Model

### TodoTemplate Model

```prisma
// prisma/template.prisma
model TodoTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  tenantId    String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  subtasks    TemplateSubtask[]
  labels      TemplateLabel[]

  @@index([tenantId])
}

model TemplateSubtask {
  id         String       @id @default(cuid())
  title      String
  order      Int
  template   TodoTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  templateId String

  @@index([templateId])
}

model TemplateLabel {
  template   TodoTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  templateId String
  label      Label        @relation(fields: [labelId], references: [id], onDelete: Cascade)
  labelId    String

  @@id([templateId, labelId])
}
```

### Relation Updates

```prisma
// prisma/tenant.prisma - add relation
model Tenant {
  // ... existing fields
  templates TodoTemplate[]
}

// prisma/user.prisma - add relation
model User {
  // ... existing fields
  createdTemplates TodoTemplate[]
}

// prisma/label.prisma - add relation
model Label {
  // ... existing fields
  templateLabels TemplateLabel[]
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### Templates Page

```typescript
// app/(app)/templates/page.tsx
import { getTemplates } from '@/app/actions/templates';
import { TemplateList } from '@/app/components/template-list';
import { CreateTemplateButton } from '@/app/components/create-template-button';

export default async function TemplatesPage() {
  const { templates, error } = await getTemplates();

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <CreateTemplateButton />
      </div>
      {templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No templates yet. Create your first template to get started.
          </p>
        </div>
      ) : (
        <TemplateList templates={templates} />
      )}
    </div>
  );
}
```

### Template List

```typescript
// app/components/template-list.tsx
'use client';

import { Template } from '@/app/actions/templates';
import { TemplateCard } from './template-card';

type TemplateListProps = {
  templates: Template[];
};

export function TemplateList({ templates }: TemplateListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}
```

### Template Card

```typescript
// app/components/template-card.tsx
'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, CheckSquare, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Template, deleteTemplate } from '@/app/actions/templates';
import { EditTemplateDialog } from './edit-template-dialog';

type TemplateCardProps = {
  template: Template;
};

export function TemplateCard({ template }: TemplateCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    await deleteTemplate(template.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {template.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {template._count.subtasks > 0 && (
              <span className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                {template._count.subtasks} subtask{template._count.subtasks !== 1 ? 's' : ''}
              </span>
            )}
            {template._count.labels > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {template._count.labels} label{template._count.labels !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {template.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {template.labels.slice(0, 3).map(({ label }) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  style={{ backgroundColor: label.color + '20', color: label.color }}
                  className="text-xs"
                >
                  {label.name}
                </Badge>
              ))}
              {template.labels.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.labels.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <EditTemplateDialog
        template={template}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template "{template.name}". Todos
              already created from this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Create Template Button

```typescript
// app/components/create-template-button.tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateTemplateDialog } from './create-template-dialog';

export function CreateTemplateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Template
      </Button>
      <CreateTemplateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
```

### Template Dialog (Create/Edit)

```typescript
// app/components/create-template-dialog.tsx
'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createTemplate, CreateTemplateInput } from '@/app/actions/templates';
import { useLabels } from '@/app/hooks/use-labels';

type CreateTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const { labels } = useLabels();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<{ title: string }[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubtask = () => {
    if (newSubtask.trim() && subtasks.length < 20) {
      setSubtasks([...subtasks, { title: newSubtask.trim() }]);
      setNewSubtask('');
    }
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    const input: CreateTemplateInput = {
      name,
      description: description || undefined,
      labelIds: selectedLabelIds,
      subtasks,
    };

    const result = await createTemplate(input);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    // Reset form and close
    setName('');
    setDescription('');
    setSelectedLabelIds([]);
    setSubtasks([]);
    setNewSubtask('');
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Template description (optional)"
              maxLength={2000}
              rows={3}
            />
          </div>

          {labels.length > 0 && (
            <div className="space-y-2">
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <label
                    key={label.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedLabelIds.includes(label.id)}
                      onCheckedChange={() => handleToggleLabel(label.id)}
                    />
                    <span
                      className="text-sm px-2 py-0.5 rounded"
                      style={{ backgroundColor: label.color + '20', color: label.color }}
                    >
                      {label.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Subtasks ({subtasks.length}/20)</Label>
            <div className="space-y-2">
              {subtasks.map((subtask, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{subtask.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveSubtask(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {subtasks.length < 20 && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add subtask"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    maxLength={200}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Template Selector for Todo Creation

```typescript
// app/components/template-selector.tsx
'use client';

import { useState, useEffect } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getTemplates, Template } from '@/app/actions/templates';
import { createTodoFromTemplate } from '@/app/actions/todos';

type TemplateSelectorProps = {
  onTodoCreated: (todoId: string) => void;
};

export function TemplateSelector({ onTodoCreated }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getTemplates().then(({ templates }) => {
      setTemplates(templates);
    });
  }, []);

  const handleSelectTemplate = async (templateId: string) => {
    setIsLoading(true);
    const result = await createTodoFromTemplate(templateId);
    setIsLoading(false);

    if (result.todo) {
      onTodoCreated(result.todo.id);
    }
  };

  if (templates.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isLoading}>
          <FileText className="h-4 w-4 mr-2" />
          From Template
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {templates.slice(0, 5).map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleSelectTemplate(template.id)}
          >
            <div className="flex flex-col">
              <span>{template.name}</span>
              {template._count.subtasks > 0 && (
                <span className="text-xs text-muted-foreground">
                  {template._count.subtasks} subtask{template._count.subtasks !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {templates.length > 5 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/templates">View all templates</a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Navigation Update

```typescript
// Add to sidebar navigation
import { FileText } from 'lucide-react';

// In navigation items:
<NavLink href="/templates" icon={FileText}>
  Templates
</NavLink>
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Store templates as JSON in user preferences | Simple | No sharing, hard to query | Templates should be shared within tenant |
| Use existing todos as templates (clone) | No new model | Confusing UX, templates mixed with todos | Clear separation is better |
| Template variables ({{date}}) | Dynamic | Complex parser, scope creep | Can add later if needed |
| Convert todo to template | Convenient | Complex state management | Can add later, create-only is simpler |

---

## Security Considerations

- **Authorization**: All actions verify template belongs to user's tenant
- **Input validation**: Name required, character limits enforced
- **Label validation**: Verify labels belong to tenant before associating
- **Rate limiting**: 50 templates per tenant prevents abuse
- **Cascade delete**: Template deletion removes subtasks and label associations

---

## Testing Strategy

**Unit Tests**
- createTemplate: creates template with name, description
- createTemplate: creates template with subtasks
- createTemplate: creates template with labels
- createTemplate: fails without name
- createTemplate: fails with invalid label
- createTemplate: fails when at 50 template limit
- updateTemplate: updates name, description
- updateTemplate: replaces subtasks
- updateTemplate: replaces labels
- updateTemplate: fails for non-existent template
- updateTemplate: fails for other tenant's template
- deleteTemplate: removes template
- deleteTemplate: cascades to subtasks and labels
- deleteTemplate: fails for other tenant's template
- getTemplates: returns tenant's templates
- getTemplates: does not return other tenant's templates
- createTodoFromTemplate: creates todo with template properties
- createTodoFromTemplate: copies labels to todo
- createTodoFromTemplate: copies subtasks to todo
- createTodoFromTemplate: fails for non-existent template

**E2E Tests**
- Creating template with name and description
- Creating template with labels
- Creating template with subtasks
- Editing template updates all fields
- Deleting template removes from list
- Deleting template shows confirmation
- Creating todo from template pre-fills fields
- Created todo has template labels attached
- Created todo has template subtasks created
- Templates page shows all tenant templates
- Templates page shows empty state when no templates
- Navigation includes templates link
- Maximum 50 templates enforced
- Maximum 20 subtasks per template enforced

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add TodoTemplate model**
   - Add TodoTemplate model with id, name, description, tenantId, createdById, timestamps
   - Add relation to Tenant and User models
   - Add index on tenantId
   - Run migration
   - Depends on: None

2. **feat(db): add TemplateSubtask model**
   - Add TemplateSubtask model with id, title, order, templateId
   - Add cascade delete from TodoTemplate
   - Add index on templateId
   - Run migration
   - Depends on: #1

3. **feat(db): add TemplateLabel junction table**
   - Add TemplateLabel model with templateId and labelId
   - Add composite primary key
   - Add cascade delete from TodoTemplate and Label
   - Add relation to Label model
   - Run migration
   - Depends on: #1

4. **feat(api): add createTemplate server action**
   - Implement createTemplate action
   - Create template with name, description
   - Create associated subtasks
   - Create associated label relations
   - Validate tenant authorization
   - Enforce 50 template limit per tenant
   - Enforce 20 subtask limit per template
   - Add unit tests
   - Depends on: #3

5. **feat(api): add updateTemplate server action**
   - Implement updateTemplate action
   - Update name and description
   - Replace subtasks (delete and recreate)
   - Replace labels (delete and recreate)
   - Validate tenant authorization
   - Add unit tests
   - Depends on: #3

6. **feat(api): add deleteTemplate server action**
   - Implement deleteTemplate action
   - Delete template with cascade to subtasks and labels
   - Validate tenant authorization
   - Add unit tests
   - Depends on: #1

7. **feat(api): add getTemplates server action**
   - Implement getTemplates action
   - Return all templates for user's tenant
   - Include subtasks, labels, counts
   - Order by name
   - Add unit tests
   - Depends on: #3

8. **feat(api): add getTemplate server action**
   - Implement getTemplate action
   - Return single template by ID
   - Include subtasks, labels, counts
   - Validate tenant authorization
   - Add unit tests
   - Depends on: #3

9. **feat(api): add createTodoFromTemplate server action**
   - Implement createTodoFromTemplate action
   - Create todo with template title, description
   - Copy labels to todo (create TodoLabel records)
   - Copy subtasks to todo (create Subtask records)
   - Create CREATED activity entry
   - Validate tenant authorization
   - Add unit tests
   - Depends on: #3

10. **feat(ui): add TemplateCard component**
    - Display template name, description preview
    - Show label and subtask counts
    - Display label badges (up to 3)
    - Add dropdown menu with Edit and Delete options
    - Add delete confirmation dialog
    - Depends on: #6

11. **feat(ui): add TemplateList component**
    - Display grid of TemplateCard components
    - Responsive layout (1/2/3 columns)
    - Depends on: #10

12. **feat(ui): add CreateTemplateDialog component**
    - Form with name, description fields
    - Label multi-select from tenant labels
    - Subtask list with add/remove
    - Save and Cancel buttons
    - Error handling and validation feedback
    - Depends on: #4

13. **feat(ui): add EditTemplateDialog component**
    - Pre-populate form with existing template data
    - Same fields as CreateTemplateDialog
    - Update on save
    - Depends on: #5, #12

14. **feat(ui): add CreateTemplateButton component**
    - Button to open CreateTemplateDialog
    - Plus icon with "New Template" text
    - Depends on: #12

15. **feat(ui): add templates page**
    - Create /templates route
    - Fetch templates with getTemplates
    - Display page header with CreateTemplateButton
    - Display TemplateList
    - Show empty state when no templates
    - Depends on: #7, #11, #14

16. **feat(ui): add TemplateSelector component**
    - Dropdown button "From Template"
    - List available templates (up to 5)
    - Click template to create todo
    - Link to templates page for more
    - Depends on: #9

17. **feat(ui): integrate TemplateSelector into todo creation**
    - Add TemplateSelector next to "New Todo" button
    - Open todo edit dialog with pre-filled data on template select
    - Depends on: #16

18. **feat(ui): add templates link to navigation**
    - Add Templates link with FileText icon
    - Position appropriately in sidebar
    - Depends on: #15

19. **test(e2e): add E2E tests for template management**
    - Test creating template with name and description
    - Test creating template with labels
    - Test creating template with subtasks
    - Test editing template
    - Test deleting template
    - Test template limits (50 templates, 20 subtasks)
    - Test empty state display
    - Depends on: #15

20. **test(e2e): add E2E tests for creating todos from templates**
    - Test creating todo from template
    - Test todo has template title and description
    - Test todo has template labels attached
    - Test todo has template subtasks created
    - Test template selector appears and works
    - Depends on: #17

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Card, Button, Dialog, Input, Textarea, Checkbox, Badge, DropdownMenu, AlertDialog)
- Uses lucide-react icons (Plus, X, MoreHorizontal, Pencil, Trash2, CheckSquare, Tag, FileText, ChevronDown)
