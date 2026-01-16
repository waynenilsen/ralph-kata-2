import { beforeEach, describe, expect, mock, test } from 'bun:test';

const mockGetArchivedTodos = mock(() =>
  Promise.resolve({ todos: [], error: undefined }),
);

mock.module('@/app/actions/todos', () => ({
  getArchivedTodos: mockGetArchivedTodos,
}));

const MockArchiveTodoList = ({ todos }: { todos: unknown[] }) => ({
  type: 'ArchiveTodoList',
  props: { todos },
});
MockArchiveTodoList.displayName = 'ArchiveTodoList';

mock.module('@/components/archive-todo-list', () => ({
  ArchiveTodoList: MockArchiveTodoList,
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
const { default: ArchivePage } = await import('./page');

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

describe('ArchivePage', () => {
  beforeEach(() => {
    mockGetArchivedTodos.mockClear();
    mockGetArchivedTodos.mockImplementation(() =>
      Promise.resolve({ todos: [], error: undefined }),
    );
  });

  describe('basic rendering', () => {
    test('renders page with Archive heading', async () => {
      const result = await ArchivePage();

      const heading = result?.props?.children?.find?.(
        (child: { type?: string }) => child?.type === 'h1',
      );

      expect(heading).toBeDefined();
      expect(heading?.props?.children).toBe('Archive');
    });

    test('renders container with correct classes', async () => {
      const result = await ArchivePage();

      expect(result?.props?.className).toContain('container');
      expect(result?.props?.className).toContain('mx-auto');
      expect(result?.props?.className).toContain('py-8');
      expect(result?.props?.className).toContain('px-4');
    });

    test('heading has correct styling classes', async () => {
      const result = await ArchivePage();

      const heading = result?.props?.children?.find?.(
        (child: { type?: string }) => child?.type === 'h1',
      );

      expect(heading?.props?.className).toContain('text-2xl');
      expect(heading?.props?.className).toContain('font-semibold');
      expect(heading?.props?.className).toContain('mb-6');
    });
  });

  describe('data fetching', () => {
    test('calls getArchivedTodos on render', async () => {
      await ArchivePage();

      expect(mockGetArchivedTodos).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    test('displays empty state Card when no archived todos', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await ArchivePage();

      // Second child is the Card (after h1)
      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;

      // The Card mock contains CardContent as child - check displayName
      expect(cardElement?.props?.children?.type?.displayName).toBe(
        'CardContent',
      );
    });

    test('empty state shows "No archived todos" message', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await ArchivePage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;
      const cardContent = cardElement?.props?.children;
      const paragraph = cardContent?.props?.children;

      expect(paragraph?.props?.children).toBe('No archived todos');
    });

    test('empty state message has muted foreground styling', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await ArchivePage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;
      const cardContent = cardElement?.props?.children;
      const paragraph = cardContent?.props?.children;

      expect(paragraph?.props?.className).toContain('text-center');
      expect(paragraph?.props?.className).toContain('text-muted-foreground');
    });

    test('empty state CardContent has py-8 padding', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({ todos: [], error: undefined }),
      );

      const result = await ArchivePage();

      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;
      const cardContent = cardElement?.props?.children;

      expect(cardContent?.props?.className).toContain('py-8');
    });
  });

  describe('with archived todos', () => {
    test('renders ArchiveTodoList when todos exist', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: [baseArchivedTodo],
          error: undefined,
        }),
      );

      const result = await ArchivePage();

      // Second child is the ArchiveTodoList (after h1)
      const children = result?.props?.children;
      const archiveTodoListElement = Array.isArray(children)
        ? children[1]
        : null;

      // Check displayName on the type function
      expect(archiveTodoListElement?.type?.displayName).toBe('ArchiveTodoList');
    });

    test('passes todos to ArchiveTodoList', async () => {
      const todos = [
        { ...baseArchivedTodo, id: '1', title: 'Todo 1' },
        { ...baseArchivedTodo, id: '2', title: 'Todo 2' },
      ];

      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({ todos, error: undefined }),
      );

      const result = await ArchivePage();

      const children = result?.props?.children;
      const archiveTodoListElement = Array.isArray(children)
        ? children[1]
        : null;

      expect(archiveTodoListElement?.props?.todos).toEqual(todos);
    });

    test('does not render empty state Card when todos exist', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: [baseArchivedTodo],
          error: undefined,
        }),
      );

      const result = await ArchivePage();

      // Second child should be ArchiveTodoList, not Card
      const children = result?.props?.children;
      const secondChild = Array.isArray(children) ? children[1] : null;

      // Verify it's ArchiveTodoList and not a Card
      expect(secondChild?.type?.displayName).toBe('ArchiveTodoList');
    });
  });

  describe('error state', () => {
    test('displays error message when getArchivedTodos returns error', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: 'You must be authenticated to view archived todos',
        }),
      );

      const result = await ArchivePage();

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
        'You must be authenticated to view archived todos',
      );
    });

    test('error message has destructive text styling', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: 'Some error',
        }),
      );

      const result = await ArchivePage();

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

    test('error state still shows Archive heading', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: 'Some error',
        }),
      );

      const result = await ArchivePage();

      const heading = result?.props?.children?.find?.(
        (child: { type?: string }) => child?.type === 'h1',
      );

      expect(heading).toBeDefined();
      expect(heading?.props?.children).toBe('Archive');
    });
  });

  describe('undefined todos handling', () => {
    test('shows empty state when todos is undefined', async () => {
      mockGetArchivedTodos.mockImplementation(() =>
        Promise.resolve({
          todos: undefined,
          error: undefined,
        }),
      );

      const result = await ArchivePage();

      // Second child should be the Card (empty state)
      const children = result?.props?.children;
      const cardElement = Array.isArray(children) ? children[1] : null;

      // The Card mock contains CardContent as child - check displayName
      expect(cardElement?.props?.children?.type?.displayName).toBe(
        'CardContent',
      );
    });
  });
});
