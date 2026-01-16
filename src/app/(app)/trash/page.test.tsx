import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as todosModule from '@/app/actions/todos';

const mockGetTrashedTodos = mock(() =>
  Promise.resolve({ todos: [], error: undefined }),
);

// We need to mock getTrashedTodos for this test
// Spread the actual module and override only getTrashedTodos
mock.module('@/app/actions/todos', () => ({
  ...todosModule,
  getTrashedTodos: mockGetTrashedTodos,
}));

const MockTrashTodoList = ({ todos }: { todos: unknown[] }) => ({
  type: 'TrashTodoList',
  props: { todos },
});
MockTrashTodoList.displayName = 'TrashTodoList';

mock.module('@/components/trash-todo-list', () => ({
  TrashTodoList: MockTrashTodoList,
}));

const MockCard = ({ children }: { children: React.ReactNode }) => ({
  type: 'Card',
  props: { children },
});
MockCard.displayName = 'Card';

const MockCardContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => ({
  type: 'CardContent',
  props: { children, className },
});
MockCardContent.displayName = 'CardContent';

mock.module('@/components/ui/card', () => ({
  Card: MockCard,
  CardContent: MockCardContent,
}));

// Import after mocking
const { default: TrashPage } = await import('./page');

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

describe('TrashPage', () => {
  beforeEach(() => {
    mockGetTrashedTodos.mockClear();
    mockGetTrashedTodos.mockImplementation(() =>
      Promise.resolve({ todos: [], error: undefined }),
    );
  });

  describe('basic rendering', () => {
    test('renders page with Trash heading', async () => {
      const result = await TrashPage();

      const heading = result?.props?.children?.find?.(
        (child: { type?: string }) => child?.type === 'h1',
      );

      expect(heading).toBeDefined();
      expect(heading?.props?.children).toBe('Trash');
    });

    test('renders container with correct classes', async () => {
      const result = await TrashPage();

      expect(result?.props?.className).toContain('container');
      expect(result?.props?.className).toContain('mx-auto');
      expect(result?.props?.className).toContain('py-8');
      expect(result?.props?.className).toContain('px-4');
    });

    test('heading has correct styling classes', async () => {
      const result = await TrashPage();

      const heading = result?.props?.children?.find?.(
        (child: { type?: string }) => child?.type === 'h1',
      );

      expect(heading?.props?.className).toContain('text-2xl');
      expect(heading?.props?.className).toContain('font-semibold');
      expect(heading?.props?.className).toContain('mb-6');
    });
  });

  describe('data fetching', () => {
    test('calls getTrashedTodos on render', async () => {
      await TrashPage();

      expect(mockGetTrashedTodos).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    test('displays empty state Card when no trashed todos', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;

      expect(cardElement?.props?.children?.type?.displayName).toBe(
        'CardContent',
      );
    });

    test('empty state shows "No trashed todos" message', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;
      const cardContent = cardElement?.props?.children;
      const paragraph = cardContent?.props?.children;

      expect(paragraph?.props?.children).toBe('No trashed todos');
    });

    test('empty state message has muted foreground styling', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;
      const cardContent = cardElement?.props?.children;
      const paragraph = cardContent?.props?.children;

      expect(paragraph?.props?.className).toContain('text-center');
      expect(paragraph?.props?.className).toContain('text-muted-foreground');
    });

    test('empty state CardContent has py-8 padding', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;
      const cardContent = cardElement?.props?.children;

      expect(cardContent?.props?.className).toContain('py-8');
    });
  });

  describe('with trashed todos', () => {
    test('renders TrashTodoList when todos exist', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: [baseTrashedTodo],
          error: undefined,
        }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const trashTodoListElement = Array.isArray(children) ? children[1] : null;

      expect(trashTodoListElement?.type?.displayName).toBe('TrashTodoList');
    });

    test('passes todos to TrashTodoList', async () => {
      const todos = [
        { ...baseTrashedTodo, id: '1', title: 'Todo 1' },
        { ...baseTrashedTodo, id: '2', title: 'Todo 2' },
      ];

      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({ todos, error: undefined }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const trashTodoListElement = Array.isArray(children) ? children[1] : null;

      expect(trashTodoListElement?.props?.todos).toEqual(todos);
    });

    test('does not render empty state Card when todos exist', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: [baseTrashedTodo],
          error: undefined,
        }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const secondChild = Array.isArray(children) ? children[1] : null;

      expect(secondChild?.type?.displayName).toBe('TrashTodoList');
    });
  });

  describe('error state', () => {
    test('displays error message when getTrashedTodos returns error', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: 'You must be authenticated to view trashed todos',
        }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const errorParagraph = Array.isArray(children)
        ? children.find(
            (child: { type?: string; props?: { className?: string } }) =>
              child?.type === 'p' &&
              child?.props?.className?.includes('text-destructive'),
          )
        : null;

      expect(errorParagraph).toBeDefined();
      expect(errorParagraph?.props?.children).toBe(
        'You must be authenticated to view trashed todos',
      );
    });

    test('error message has destructive text styling', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: 'Some error',
        }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const errorParagraph = Array.isArray(children)
        ? children.find(
            (child: { type?: string; props?: { className?: string } }) =>
              child?.type === 'p' &&
              child?.props?.className?.includes('text-destructive'),
          )
        : null;

      expect(errorParagraph?.props?.className).toContain('text-destructive');
    });

    test('error state still shows Trash heading', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: 'Some error',
        }),
      );

      const result = await TrashPage();

      const heading = result?.props?.children?.find?.(
        (child: { type?: string }) => child?.type === 'h1',
      );

      expect(heading).toBeDefined();
      expect(heading?.props?.children).toBe('Trash');
    });
  });

  describe('undefined todos handling', () => {
    test('shows empty state when todos is undefined', async () => {
      mockGetTrashedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: undefined,
        }),
      );

      const result = await TrashPage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;

      expect(cardElement?.props?.children?.type?.displayName).toBe(
        'CardContent',
      );
    });
  });
});
