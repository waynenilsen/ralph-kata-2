import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

// Track mock state
let mockFormState = {};
let mockIsPending = false;

// Mock react hooks
mock.module('react', () => ({
  ...React,
  useActionState: () => [mockFormState, mock(() => {}), mockIsPending],
  useTransition: () => [false, mock(() => {})],
  useState: (initial: unknown) => {
    // Return the initial value for all useState calls
    return [initial, () => {}];
  },
  useEffect: () => {},
}));

// Mock server actions
mock.module('@/app/actions/labels', () => ({
  updateTodoLabels: mock(() => Promise.resolve({ success: true })),
}));

mock.module('@/app/actions/todos', () => {
  const actual = require('@/app/actions/todos');
  return {
    ...actual,
    updateTodo: mock(() => Promise.resolve({ success: true })),
    updateTodoRecurrence: mock(() => Promise.resolve({ success: true })),
  };
});

mock.module('@/app/actions/activities', () => ({
  getTodoActivities: mock(() => Promise.resolve({ activities: [] })),
}));

// Import after mocking
const { EditTodoForm } = await import('./edit-todo-form');

describe('EditTodoForm', () => {
  const baseTodo = {
    id: 'todo-1',
    title: 'Test Todo',
    description: 'Test description',
    dueDate: null,
    assigneeId: null,
    recurrenceType: 'NONE' as const,
    comments: [],
    labels: [],
    subtasks: [],
  };

  const baseProps = {
    todo: baseTodo,
    members: [],
    labels: [],
    onCancel: mock(() => {}),
    onSuccess: mock(() => {}),
  };

  beforeEach(() => {
    mockFormState = {};
    mockIsPending = false;
  });

  describe('rendering structure', () => {
    test('renders form element', () => {
      const result = EditTodoForm(baseProps);
      // Result is a React.Fragment containing form and sections
      const children = result?.props?.children;
      const form = children?.[0];
      expect(form?.type).toBe('form');
    });

    test('renders SubtaskSection after form', () => {
      const result = EditTodoForm(baseProps);
      const children = result?.props?.children;
      const subtaskSection = children?.[1];
      expect(subtaskSection?.type?.name).toBe('SubtaskSection');
    });

    test('renders ActivitySection after SubtaskSection', () => {
      const result = EditTodoForm(baseProps);
      const children = result?.props?.children;
      const activitySection = children?.[2];
      expect(activitySection?.type?.name).toBe('ActivitySection');
    });

    test('renders CommentSection after ActivitySection', () => {
      const result = EditTodoForm(baseProps);
      const children = result?.props?.children;
      const commentSection = children?.[3];
      expect(commentSection?.type?.name).toBe('CommentSection');
    });

    test('passes todoId to ActivitySection', () => {
      const result = EditTodoForm(baseProps);
      const children = result?.props?.children;
      const activitySection = children?.[2];
      expect(activitySection?.props?.todoId).toBe('todo-1');
    });
  });

  describe('form fields', () => {
    test('renders title input with correct default value', () => {
      const result = EditTodoForm(baseProps);
      const children = result?.props?.children;
      const form = children?.[0];
      const formChildren = form?.props?.children;

      // Find the title input (should be in a div with label)
      const titleSection = formChildren?.find(
        (child: { props?: { children?: unknown[] } }) =>
          child?.props?.children?.some?.(
            (c: { props?: { htmlFor?: string } }) =>
              c?.props?.htmlFor?.includes?.('title'),
          ),
      );
      expect(titleSection).toBeDefined();
    });

    test('renders Save and Cancel buttons', () => {
      const result = EditTodoForm(baseProps);
      const children = result?.props?.children;
      const form = children?.[0];
      const formChildren = form?.props?.children;

      // Find button container (flex gap-2)
      const buttonContainer = formChildren?.find(
        (child: { props?: { className?: string } }) =>
          child?.props?.className?.includes?.('flex gap-2'),
      );
      expect(buttonContainer).toBeDefined();

      const buttons = buttonContainer?.props?.children;
      expect(buttons?.[0]?.props?.children).toMatch(/Sav(e|ing)/);
      expect(buttons?.[1]?.props?.children).toBe('Cancel');
    });
  });
});
