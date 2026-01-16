import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
  useTransition: () => [false, (cb: () => void) => cb()],
}));

mock.module('@/app/actions/todos', () => ({
  unarchiveTodo: mock(() => Promise.resolve()),
  softDeleteTodo: mock(() => Promise.resolve()),
}));

// Import after mocking
const { ArchiveTodoList } = await import('./archive-todo-list');

const baseArchivedTodo = {
  id: '1',
  title: 'Archived Todo',
  description: 'Test description',
  status: 'COMPLETED',
  dueDate: null,
  archivedAt: new Date('2026-01-15T10:00:00Z'),
  createdAt: new Date('2026-01-10T10:00:00Z'),
  assignee: null,
  labels: [],
  _count: { comments: 0 },
};

describe('ArchiveTodoList', () => {
  describe('basic rendering', () => {
    test('renders a list of archived todos', () => {
      const todos = [
        { ...baseArchivedTodo, id: '1', title: 'Todo 1' },
        { ...baseArchivedTodo, id: '2', title: 'Todo 2' },
      ];

      const result = ArchiveTodoList({ todos });

      // Should render a container div with space-y-3 class
      expect(result?.props?.className).toContain('space-y-3');
      // Should have two children (one Card per todo)
      expect(result?.props?.children).toHaveLength(2);
    });

    test('renders Card component for each todo', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      // First child should be a Card
      const card = result?.props?.children?.[0];
      expect(card?.type?.displayName || card?.type?.name).toBe('Card');
    });

    test('displays todo title', () => {
      const todos = [{ ...baseArchivedTodo, title: 'My Archived Todo' }];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const titleElement = infoSection?.props?.children?.[0];

      expect(titleElement?.props?.children).toBe('My Archived Todo');
    });

    test('displays todo description when provided', () => {
      const todos = [
        { ...baseArchivedTodo, description: 'Archived todo description' },
      ];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement?.props?.children).toBe(
        'Archived todo description',
      );
    });

    test('does not render description when null', () => {
      const todos = [{ ...baseArchivedTodo, description: null }];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement).toBeFalsy();
    });

    test('displays archive date formatted with date-fns', () => {
      const todos = [
        {
          ...baseArchivedTodo,
          archivedAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const dateElement = infoSection?.props?.children?.[2];

      // Should contain "Archived" and use formatDistanceToNow
      expect(dateElement?.props?.children?.[0]).toBe('Archived');
      expect(dateElement?.props?.children?.[1]).toBe(' ');
      expect(dateElement?.props?.className).toContain('text-xs');
      expect(dateElement?.props?.className).toContain('text-muted-foreground');
    });
  });

  describe('action buttons', () => {
    test('renders restore button with RotateCcw icon', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
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

    test('renders delete button with Trash2 icon', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const deleteButton = buttonsSection?.props?.children?.[1];

      expect(deleteButton?.type?.displayName || deleteButton?.type?.name).toBe(
        'Button',
      );
      expect(deleteButton?.props?.title).toBe('Move to trash');

      // Check for Trash2 icon
      const icon = deleteButton?.props?.children;
      expect(icon?.type?.displayName || icon?.type?.name).toBe('Trash2');
    });

    test('restore button uses ghost variant and sm size', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const restoreButton = buttonsSection?.props?.children?.[0];

      expect(restoreButton?.props?.variant).toBe('ghost');
      expect(restoreButton?.props?.size).toBe('sm');
    });

    test('delete button uses ghost variant and sm size', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];
      const deleteButton = buttonsSection?.props?.children?.[1];

      expect(deleteButton?.props?.variant).toBe('ghost');
      expect(deleteButton?.props?.size).toBe('sm');
    });
  });

  describe('multiple todos', () => {
    test('renders correct number of cards for multiple todos', () => {
      const todos = [
        { ...baseArchivedTodo, id: '1', title: 'Todo 1' },
        { ...baseArchivedTodo, id: '2', title: 'Todo 2' },
        { ...baseArchivedTodo, id: '3', title: 'Todo 3' },
      ];

      const result = ArchiveTodoList({ todos });

      expect(result?.props?.children).toHaveLength(3);
    });

    test('each card has unique key from todo id', () => {
      const todos = [
        { ...baseArchivedTodo, id: 'unique-id-1', title: 'Todo 1' },
        { ...baseArchivedTodo, id: 'unique-id-2', title: 'Todo 2' },
      ];

      const result = ArchiveTodoList({ todos });

      const cards = result?.props?.children;
      expect(cards?.[0]?.key).toBe('unique-id-1');
      expect(cards?.[1]?.key).toBe('unique-id-2');
    });
  });

  describe('empty state', () => {
    test('renders empty container when no todos', () => {
      const result = ArchiveTodoList({ todos: [] });

      expect(result?.props?.className).toContain('space-y-3');
      expect(result?.props?.children).toHaveLength(0);
    });
  });

  describe('styling', () => {
    test('card content has p-4 padding', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;

      expect(cardContent?.props?.className).toContain('p-4');
    });

    test('content layout uses flex with items-start and justify-between', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;

      expect(contentDiv?.props?.className).toContain('flex');
      expect(contentDiv?.props?.className).toContain('items-start');
      expect(contentDiv?.props?.className).toContain('justify-between');
    });

    test('title has font-medium class', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const titleElement = infoSection?.props?.children?.[0];

      expect(titleElement?.props?.className).toContain('font-medium');
    });

    test('description has text-sm and text-muted-foreground classes', () => {
      const todos = [{ ...baseArchivedTodo, description: 'Test description' }];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
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
      const todos = [{ ...baseArchivedTodo, description: 'Test description' }];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const infoSection = contentDiv?.props?.children?.[0];
      const descriptionElement = infoSection?.props?.children?.[1];

      expect(descriptionElement?.props?.className).toContain('line-clamp-2');
    });

    test('buttons section has gap-2 and ml-4', () => {
      const todos = [baseArchivedTodo];

      const result = ArchiveTodoList({ todos });

      const card = result?.props?.children?.[0];
      const cardContent = card?.props?.children;
      const contentDiv = cardContent?.props?.children;
      const buttonsSection = contentDiv?.props?.children?.[1];

      expect(buttonsSection?.props?.className).toContain('gap-2');
      expect(buttonsSection?.props?.className).toContain('ml-4');
    });
  });
});
