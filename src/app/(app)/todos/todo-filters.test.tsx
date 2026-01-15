import { beforeEach, describe, expect, mock, test } from 'bun:test';

const mockPush = mock(() => {});
let mockSearchParams = new URLSearchParams();

mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Import after mocking
const { TodoFilters } = await import('./todo-filters');

const testMembers = [
  { id: 'user-1', email: 'alice@example.com' },
  { id: 'user-2', email: 'bob@example.com' },
];

describe('TodoFilters', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  describe('rendering', () => {
    test('renders all three select dropdowns', () => {
      const result = TodoFilters({ members: testMembers });

      expect(result).not.toBeNull();
      // Should have a flex div with 3 Select children
      const children = result?.props?.children;
      expect(children).toHaveLength(3);
    });

    test('renders status dropdown with correct options', () => {
      const result = TodoFilters({ members: testMembers });

      const statusSelect = result?.props?.children?.[0];
      const selectContent = statusSelect?.props?.children?.[1];
      const options = selectContent?.props?.children;

      expect(options).toHaveLength(3);
      expect(options[0]?.props?.value).toBe('all');
      expect(options[1]?.props?.value).toBe('pending');
      expect(options[2]?.props?.value).toBe('completed');
    });

    test('renders assignee dropdown with static options and members', () => {
      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const selectContent = assigneeSelect?.props?.children?.[1];
      const children = selectContent?.props?.children;

      // First 3 are static options (All, My Todos, Unassigned)
      expect(children[0]?.props?.value).toBe('all');
      expect(children[0]?.props?.children).toBe('All');
      expect(children[1]?.props?.value).toBe('me');
      expect(children[1]?.props?.children).toBe('My Todos');
      expect(children[2]?.props?.value).toBe('unassigned');
      expect(children[2]?.props?.children).toBe('Unassigned');

      // Remaining are member options (mapped array)
      const memberOptions = children[3];
      expect(memberOptions).toHaveLength(2);
      expect(memberOptions[0]?.props?.value).toBe('user-1');
      expect(memberOptions[0]?.props?.children).toBe('alice@example.com');
      expect(memberOptions[1]?.props?.value).toBe('user-2');
      expect(memberOptions[1]?.props?.children).toBe('bob@example.com');
    });

    test('renders sort dropdown with correct options', () => {
      const result = TodoFilters({ members: testMembers });

      const sortSelect = result?.props?.children?.[2];
      const selectContent = sortSelect?.props?.children?.[1];
      const options = selectContent?.props?.children;

      expect(options).toHaveLength(4);
      expect(options[0]?.props?.value).toBe('created-desc');
      expect(options[1]?.props?.value).toBe('created-asc');
      expect(options[2]?.props?.value).toBe('due-asc');
      expect(options[3]?.props?.value).toBe('due-desc');
    });

    test('renders with empty members array', () => {
      const result = TodoFilters({ members: [] });

      const assigneeSelect = result?.props?.children?.[1];
      const selectContent = assigneeSelect?.props?.children?.[1];
      const children = selectContent?.props?.children;

      // Should still have static options
      expect(children[0]?.props?.value).toBe('all');
      expect(children[1]?.props?.value).toBe('me');
      expect(children[2]?.props?.value).toBe('unassigned');
      // Member options should be empty array
      expect(children[3]).toHaveLength(0);
    });
  });

  describe('current values from URL', () => {
    test('uses default values when URL has no params', () => {
      const result = TodoFilters({ members: testMembers });

      const statusSelect = result?.props?.children?.[0];
      const assigneeSelect = result?.props?.children?.[1];
      const sortSelect = result?.props?.children?.[2];

      expect(statusSelect?.props?.value).toBe('all');
      expect(assigneeSelect?.props?.value).toBe('all');
      expect(sortSelect?.props?.value).toBe('created-desc');
    });

    test('reads status from URL params', () => {
      mockSearchParams = new URLSearchParams('status=pending');

      const result = TodoFilters({ members: testMembers });

      const statusSelect = result?.props?.children?.[0];
      expect(statusSelect?.props?.value).toBe('pending');
    });

    test('reads assignee from URL params', () => {
      mockSearchParams = new URLSearchParams('assignee=me');

      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      expect(assigneeSelect?.props?.value).toBe('me');
    });

    test('reads user id assignee from URL params', () => {
      mockSearchParams = new URLSearchParams('assignee=user-1');

      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      expect(assigneeSelect?.props?.value).toBe('user-1');
    });

    test('reads sort from URL params', () => {
      mockSearchParams = new URLSearchParams('sort=due-asc');

      const result = TodoFilters({ members: testMembers });

      const sortSelect = result?.props?.children?.[2];
      expect(sortSelect?.props?.value).toBe('due-asc');
    });
  });

  describe('updateFilter behavior via onValueChange', () => {
    test('status change to pending updates URL', () => {
      const result = TodoFilters({ members: testMembers });

      const statusSelect = result?.props?.children?.[0];
      const onValueChange = statusSelect?.props?.onValueChange;
      onValueChange('pending');

      expect(mockPush).toHaveBeenCalledWith('/todos?status=pending');
    });

    test('status change to all removes status param', () => {
      mockSearchParams = new URLSearchParams('status=pending');

      const result = TodoFilters({ members: testMembers });

      const statusSelect = result?.props?.children?.[0];
      const onValueChange = statusSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('assignee change to me updates URL', () => {
      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('me');

      expect(mockPush).toHaveBeenCalledWith('/todos?assignee=me');
    });

    test('assignee change to unassigned updates URL', () => {
      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('unassigned');

      expect(mockPush).toHaveBeenCalledWith('/todos?assignee=unassigned');
    });

    test('assignee change to specific user id updates URL', () => {
      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('user-1');

      expect(mockPush).toHaveBeenCalledWith('/todos?assignee=user-1');
    });

    test('assignee change to all removes assignee param', () => {
      mockSearchParams = new URLSearchParams('assignee=me');

      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('sort change to due-asc updates URL', () => {
      const result = TodoFilters({ members: testMembers });

      const sortSelect = result?.props?.children?.[2];
      const onValueChange = sortSelect?.props?.onValueChange;
      onValueChange('due-asc');

      expect(mockPush).toHaveBeenCalledWith('/todos?sort=due-asc');
    });

    test('sort change to created-desc removes sort param', () => {
      mockSearchParams = new URLSearchParams('sort=due-asc');

      const result = TodoFilters({ members: testMembers });

      const sortSelect = result?.props?.children?.[2];
      const onValueChange = sortSelect?.props?.onValueChange;
      onValueChange('created-desc');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('preserves other params when updating', () => {
      mockSearchParams = new URLSearchParams('status=pending&sort=due-asc');

      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('me');

      expect(mockPush).toHaveBeenCalledWith(
        '/todos?status=pending&sort=due-asc&assignee=me',
      );
    });

    test('removes param correctly while preserving others', () => {
      mockSearchParams = new URLSearchParams(
        'status=pending&assignee=me&sort=due-asc',
      );

      const result = TodoFilters({ members: testMembers });

      const assigneeSelect = result?.props?.children?.[1];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith(
        '/todos?status=pending&sort=due-asc',
      );
    });
  });
});
