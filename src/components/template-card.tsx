'use client';

import { CheckSquare, MoreHorizontal, Pencil, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteTemplate } from '@/app/actions/templates';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Template = {
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
      <Card data-testid="template-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg font-semibold">
              {template.name}
            </CardTitle>
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
                {template._count.subtasks}{' '}
                {template._count.subtasks === 1 ? 'subtask' : 'subtasks'}
              </span>
            )}
            {template._count.labels > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {template._count.labels}{' '}
                {template._count.labels === 1 ? 'label' : 'labels'}
              </span>
            )}
          </div>
          {template.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {template.labels.slice(0, 3).map(({ label }) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color,
                  }}
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

      {/* EditTemplateDialog is out of scope for this ticket */}
      {editDialogOpen && <div data-testid="edit-template-dialog-placeholder" />}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template &quot;{template.name}
              &quot;. Todos already created from this template will not be
              affected.
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
