import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
  useTransition: () => [false, (cb: () => void) => cb()],
}));

mock.module('@/app/actions/todos', () => ({
  restoreFromTrash: mock(() => Promise.resolve()),
  permanentDeleteTodo: mock(() => Promise.resolve()),
}));

// Import after mocking
const { TrashTodoList } = await import('./trash-todo-list');

const baseTrashedTodo = {
  id: '1',
  title: 'Trashed Todo',
  description: 'Test description',
  status: 'PENDING',
  dueDate: null,
  deletedAt: new Date('2026-01-15T10:00:00Z'),
  createdAt: new Date('2026-01-10T10:00:00Z'),
  assignee: null,
  labels: [],
  _count: { comments: 0 },
};

describe('TrashTodoList', () => {
  describe('basic rendering', () => {
    test('renders a fragment with todo list and dialog', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      // Should render a fragment with two children (list container and AlertDialog)
      expect(result?.props?.children).toHaveLength(2);
    });

    test('renders a list container with space-y-3 class', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      // First child is the list container
      const listContainer = result?.props?.children?.[0];
      expect(listContainer?.props?.className).toContain('space-y-3');
    });

    test('renders Card component for each todo', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      expect(card?.type?.displayName || card?.type?.name).toBe('Card');
    });

    test('displays todo title', () => {
      const todos = [{ ...baseTrashedTodo, title: 'My Trashed Todo' }];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const titleElement = infoSection?.props?.children?.[0];

      expect(titleElement?.props?.children).toBe('My Trashed Todo');
    });

    test('displays todo description when provided', () => {
      const todos = [
        { ...baseTrashedTodo, description: 'Trashed todo description' },
      ];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement?.props?.children).toBe(
        'Trashed todo description',
      );
    });

    test('does not render description when null', () => {
      const todos = [{ ...baseTrashedTodo, description: null }];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement).toBeFalsy();
    });

    test('displays delete date formatted with date-fns', () => {
      const todos = [
        {
          ...baseTrashedTodo,
          deletedAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const dateElement = infoSection?.props?.children?.[2];

      // Should contain "Deleted" and use formatDistanceToNow
      expect(dateElement?.props?.children?.[0]).toBe('Deleted');
      expect(dateElement?.props?.children?.[1]).toBe(' ');
      expect(dateElement?.props?.className).toContain('text-xs');
      expect(dateElement?.props?.className).toContain('text-muted-foreground');
    });
  });

  describe('action buttons', () => {
    test('renders restore button with RotateCcw icon', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const restoreButton = buttonsSection?.props?.children?.[0];

      expect(
        restoreButton?.type?.displayName || restoreButton?.type?.name,
      ).toBe('Button');
      expect(restoreButton?.props?.title).toBe('Restore');

      // Check for RotateCcw icon
      const icon = restoreButton?.props?.children;
      expect(icon?.type?.displayName || icon?.type?.name).toBe('RotateCcw');
    });

    test('renders permanent delete button with Trash2 icon', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const deleteButton = buttonsSection?.props?.children?.[1];

      expect(deleteButton?.type?.displayName || deleteButton?.type?.name).toBe(
        'Button',
      );
      expect(deleteButton?.props?.title).toBe('Delete permanently');

      // Check for Trash2 icon
      const icon = deleteButton?.props?.children;
      expect(icon?.type?.displayName || icon?.type?.name).toBe('Trash2');
    });

    test('restore button uses ghost variant and sm size', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const restoreButton = buttonsSection?.props?.children?.[0];

      expect(restoreButton?.props?.variant).toBe('ghost');
      expect(restoreButton?.props?.size).toBe('sm');
    });

    test('delete button uses ghost variant and sm size with destructive color', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const deleteButton = buttonsSection?.props?.children?.[1];

      expect(deleteButton?.props?.variant).toBe('ghost');
      expect(deleteButton?.props?.size).toBe('sm');
      expect(deleteButton?.props?.className).toContain('text-destructive');
    });
  });

  describe('confirmation dialog', () => {
    test('renders AlertDialog component', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      // Second child is the AlertDialog
      const alertDialog = result?.props?.children?.[1];
      expect(alertDialog?.type?.displayName || alertDialog?.type?.name).toBe(
        'AlertDialog',
      );
    });

    test('AlertDialog has title asking for confirmation', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const alertDialog = result?.props?.children?.[1];
      const dialogContent = alertDialog?.props?.children;
      const dialogHeader = dialogContent?.props?.children?.[0];
      const dialogTitle = dialogHeader?.props?.children?.[0];

      expect(dialogTitle?.props?.children).toBe('Permanently delete todo?');
    });

    test('AlertDialog has description warning about irreversible action', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const alertDialog = result?.props?.children?.[1];
      const dialogContent = alertDialog?.props?.children;
      const dialogHeader = dialogContent?.props?.children?.[0];
      const dialogDescription = dialogHeader?.props?.children?.[1];

      expect(dialogDescription?.props?.children).toContain('cannot be undone');
    });

    test('AlertDialog has Cancel and Delete buttons', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const alertDialog = result?.props?.children?.[1];
      const dialogContent = alertDialog?.props?.children;
      const dialogFooter = dialogContent?.props?.children?.[1];
      const cancelButton = dialogFooter?.props?.children?.[0];
      const deleteButton = dialogFooter?.props?.children?.[1];

      expect(cancelButton?.props?.children).toBe('Cancel');
      expect(deleteButton?.props?.children).toBe('Delete permanently');
    });

    test('Delete button has destructive styling', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const alertDialog = result?.props?.children?.[1];
      const dialogContent = alertDialog?.props?.children;
      const dialogFooter = dialogContent?.props?.children?.[1];
      const deleteButton = dialogFooter?.props?.children?.[1];

      expect(deleteButton?.props?.className).toContain('bg-destructive');
    });
  });

  describe('multiple todos', () => {
    test('renders correct number of cards for multiple todos', () => {
      const todos = [
        { ...baseTrashedTodo, id: '1', title: 'Todo 1' },
        { ...baseTrashedTodo, id: '2', title: 'Todo 2' },
        { ...baseTrashedTodo, id: '3', title: 'Todo 3' },
      ];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      expect(listContainer?.props?.children).toHaveLength(3);
    });

    test('each card has unique key from todo id', () => {
      const todos = [
        { ...baseTrashedTodo, id: 'unique-id-1', title: 'Todo 1' },
        { ...baseTrashedTodo, id: 'unique-id-2', title: 'Todo 2' },
      ];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const cards = listContainer?.props?.children;
      expect(cards?.[0]?.key).toBe('unique-id-1');
      expect(cards?.[1]?.key).toBe('unique-id-2');
    });
  });

  describe('empty state', () => {
    test('renders empty container when no todos', () => {
      const result = TrashTodoList({ todos: [] });

      const listContainer = result?.props?.children?.[0];
      expect(listContainer?.props?.className).toContain('space-y-3');
      expect(listContainer?.props?.children).toHaveLength(0);
    });
  });

  describe('styling', () => {
    test('card content has p-4 padding', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;

      expect(cardContent?.props?.className).toContain('p-4');
    });

    test('content layout uses flex with items-start and justify-between', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;

      expect(contentDiv?.props?.className).toContain('flex');
      expect(contentDiv?.props?.className).toContain('items-start');
      expect(contentDiv?.props?.className).toContain('justify-between');
    });

    test('title has font-medium class', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const titleElement = infoSection?.props?.children?.[0];

      expect(titleElement?.props?.className).toContain('font-medium');
    });

    test('description has text-sm and text-muted-foreground classes', () => {
      const todos = [{ ...baseTrashedTodo, description: 'Test description' }];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement?.props?.className).toContain('text-sm');
      expect(descriptionElement?.props?.className).toContain(
        'text-muted-foreground',
      );
    });

    test('description has line-clamp-2 for truncation', () => {
      const todos = [{ ...baseTrashedTodo, description: 'Test description' }];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement?.props?.className).toContain('line-clamp-2');
    });

    test('buttons section has gap-2 and ml-4', () => {
      const todos = [baseTrashedTodo];

      const result = TrashTodoList({ todos });

      const listContainer = result?.props?.children?.[0];
      const card = listContainer?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];

      expect(buttonsSection?.props?.className).toContain('gap-2');
      expect(buttonsSection?.props?.className).toContain('ml-4');
    });
  });
});
