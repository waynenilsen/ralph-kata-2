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

const testLabels = [
  { id: 'label-1', name: 'Bug', color: '#ff0000' },
  { id: 'label-2', name: 'Feature', color: '#00ff00' },
];

describe('TodoFilters', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  describe('rendering', () => {
    test('renders search input and four select dropdowns', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      expect(result).not.toBeNull();
      // Should have a flex div with 5 children (SearchInput + 4 Select)
      const children = result?.props?.children;
      expect(children).toHaveLength(5);
    });

    test('renders status dropdown with correct options', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const statusSelect = result?.props?.children?.[1];
      const selectContent = statusSelect?.props?.children?.[1];
      const options = selectContent?.props?.children;

      expect(options).toHaveLength(3);
      expect(options[0]?.props?.value).toBe('all');
      expect(options[1]?.props?.value).toBe('pending');
      expect(options[2]?.props?.value).toBe('completed');
    });

    test('renders assignee dropdown with static options and members', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
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

    test('renders label dropdown with all labels option and tenant labels', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const labelSelect = result?.props?.children?.[3];
      const selectContent = labelSelect?.props?.children?.[1];
      const children = selectContent?.props?.children;

      // First is "All labels" option
      expect(children[0]?.props?.value).toBe('all');
      expect(children[0]?.props?.children).toBe('All labels');

      // Remaining are label options (mapped array)
      const labelOptions = children[1];
      expect(labelOptions).toHaveLength(2);
      expect(labelOptions[0]?.props?.value).toBe('label-1');
      expect(labelOptions[1]?.props?.value).toBe('label-2');
    });

    test('renders sort dropdown with correct options', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const sortSelect = result?.props?.children?.[4];
      const selectContent = sortSelect?.props?.children?.[1];
      const options = selectContent?.props?.children;

      expect(options).toHaveLength(4);
      expect(options[0]?.props?.value).toBe('created-desc');
      expect(options[1]?.props?.value).toBe('created-asc');
      expect(options[2]?.props?.value).toBe('due-asc');
      expect(options[3]?.props?.value).toBe('due-desc');
    });

    test('renders with empty members array', () => {
      const result = TodoFilters({ members: [], labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      const selectContent = assigneeSelect?.props?.children?.[1];
      const children = selectContent?.props?.children;

      // Should still have static options
      expect(children[0]?.props?.value).toBe('all');
      expect(children[1]?.props?.value).toBe('me');
      expect(children[2]?.props?.value).toBe('unassigned');
      // Member options should be empty array
      expect(children[3]).toHaveLength(0);
    });

    test('renders with empty labels array', () => {
      const result = TodoFilters({ members: testMembers, labels: [] });

      const labelSelect = result?.props?.children?.[3];
      const selectContent = labelSelect?.props?.children?.[1];
      const children = selectContent?.props?.children;

      // Should still have "All labels" option
      expect(children[0]?.props?.value).toBe('all');
      // Label options should be empty array
      expect(children[1]).toHaveLength(0);
    });
  });

  describe('current values from URL', () => {
    test('uses default values when URL has no params', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const statusSelect = result?.props?.children?.[1];
      const assigneeSelect = result?.props?.children?.[2];
      const labelSelect = result?.props?.children?.[3];
      const sortSelect = result?.props?.children?.[4];

      expect(statusSelect?.props?.value).toBe('all');
      expect(assigneeSelect?.props?.value).toBe('all');
      expect(labelSelect?.props?.value).toBe('all');
      expect(sortSelect?.props?.value).toBe('created-desc');
    });

    test('reads status from URL params', () => {
      mockSearchParams = new URLSearchParams('status=pending');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const statusSelect = result?.props?.children?.[1];
      expect(statusSelect?.props?.value).toBe('pending');
    });

    test('reads assignee from URL params', () => {
      mockSearchParams = new URLSearchParams('assignee=me');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      expect(assigneeSelect?.props?.value).toBe('me');
    });

    test('reads user id assignee from URL params', () => {
      mockSearchParams = new URLSearchParams('assignee=user-1');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      expect(assigneeSelect?.props?.value).toBe('user-1');
    });

    test('reads label from URL params', () => {
      mockSearchParams = new URLSearchParams('label=label-1');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const labelSelect = result?.props?.children?.[3];
      expect(labelSelect?.props?.value).toBe('label-1');
    });

    test('reads sort from URL params', () => {
      mockSearchParams = new URLSearchParams('sort=due-asc');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const sortSelect = result?.props?.children?.[4];
      expect(sortSelect?.props?.value).toBe('due-asc');
    });
  });

  describe('updateFilter behavior via onValueChange', () => {
    test('status change to pending updates URL and resets page', () => {
      mockSearchParams = new URLSearchParams('page=2');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const statusSelect = result?.props?.children?.[1];
      const onValueChange = statusSelect?.props?.onValueChange;
      onValueChange('pending');

      expect(mockPush).toHaveBeenCalledWith('/todos?status=pending');
    });

    test('status change to all removes status param', () => {
      mockSearchParams = new URLSearchParams('status=pending');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const statusSelect = result?.props?.children?.[1];
      const onValueChange = statusSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('assignee change to me updates URL', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('me');

      expect(mockPush).toHaveBeenCalledWith('/todos?assignee=me');
    });

    test('assignee change to unassigned updates URL', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('unassigned');

      expect(mockPush).toHaveBeenCalledWith('/todos?assignee=unassigned');
    });

    test('assignee change to specific user id updates URL', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('user-1');

      expect(mockPush).toHaveBeenCalledWith('/todos?assignee=user-1');
    });

    test('assignee change to all removes assignee param', () => {
      mockSearchParams = new URLSearchParams('assignee=me');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const assigneeSelect = result?.props?.children?.[2];
      const onValueChange = assigneeSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('label change to specific label updates URL and resets page', () => {
      mockSearchParams = new URLSearchParams('page=2');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const labelSelect = result?.props?.children?.[3];
      const onValueChange = labelSelect?.props?.onValueChange;
      onValueChange('label-1');

      expect(mockPush).toHaveBeenCalledWith('/todos?label=label-1');
    });

    test('label change to all removes label param', () => {
      mockSearchParams = new URLSearchParams('label=label-1');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const labelSelect = result?.props?.children?.[3];
      const onValueChange = labelSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('sort change to due-asc updates URL', () => {
      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const sortSelect = result?.props?.children?.[4];
      const onValueChange = sortSelect?.props?.onValueChange;
      onValueChange('due-asc');

      expect(mockPush).toHaveBeenCalledWith('/todos?sort=due-asc');
    });

    test('sort change to created-desc removes sort param', () => {
      mockSearchParams = new URLSearchParams('sort=due-asc');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const sortSelect = result?.props?.children?.[4];
      const onValueChange = sortSelect?.props?.onValueChange;
      onValueChange('created-desc');

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('preserves other params when updating', () => {
      mockSearchParams = new URLSearchParams('status=pending&sort=due-asc');

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const labelSelect = result?.props?.children?.[3];
      const onValueChange = labelSelect?.props?.onValueChange;
      onValueChange('label-1');

      expect(mockPush).toHaveBeenCalledWith(
        '/todos?status=pending&sort=due-asc&label=label-1',
      );
    });

    test('removes param correctly while preserving others', () => {
      mockSearchParams = new URLSearchParams(
        'status=pending&label=label-1&sort=due-asc',
      );

      const result = TodoFilters({ members: testMembers, labels: testLabels });

      const labelSelect = result?.props?.children?.[3];
      const onValueChange = labelSelect?.props?.onValueChange;
      onValueChange('all');

      expect(mockPush).toHaveBeenCalledWith(
        '/todos?status=pending&sort=due-asc',
      );
    });
  });
});
