import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

// Mock React hooks to avoid state updates during synchronous rendering
mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
  useTransition: () => [false, mock(() => {})],
}));

// The cleanest approach is to use the actual component
// but just not invoke any state-changing functions.
// Since useState returns a noop setter, the component renders but state never changes.
const { TemplateCard } = await import('./template-card');

const baseTemplate = {
  id: 'template-1',
  name: 'Test Template',
  description: 'Test description for the template',
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  createdBy: { id: 'user-1', email: 'test@example.com' },
  labels: [],
  subtasks: [],
  _count: { subtasks: 0, labels: 0 },
};

// Helper to get the Card from the result (which is a Fragment)
function getCard(result: ReturnType<typeof TemplateCard>) {
  // Fragment children: [Card, editPlaceholder (falsy), AlertDialog]
  return result?.props?.children?.[0];
}

// Helper to get CardHeader from the Card
function getCardHeader(result: ReturnType<typeof TemplateCard>) {
  const card = getCard(result);
  return card?.props?.children?.[0];
}

// Helper to get CardContent from the Card
function getCardContent(result: ReturnType<typeof TemplateCard>) {
  const card = getCard(result);
  return card?.props?.children?.[1];
}

describe('TemplateCard', () => {
  describe('basic rendering', () => {
    test('renders template name', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      // CardHeader > div > CardTitle
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const cardTitle = titleAndDropdown?.[0];

      expect(cardTitle?.props?.children).toBe('Test Template');
    });

    test('CardTitle has font-semibold class', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const cardTitle = titleAndDropdown?.[0];

      expect(cardTitle?.props?.className).toContain('font-semibold');
    });

    test('renders description when provided', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, description: 'My template description' },
      });

      const cardContent = getCardContent(result);
      // CardContent children: [description?, countsDiv, labels?]
      const contentChildren = cardContent?.props?.children;
      const descriptionParagraph = contentChildren?.[0];

      expect(descriptionParagraph?.props?.children).toBe(
        'My template description',
      );
    });

    test('does not render description section when description is null', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, description: null },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const descriptionParagraph = contentChildren?.[0];

      // When description is null, the first child should be falsy
      expect(descriptionParagraph).toBeFalsy();
    });

    test('description has line-clamp-2 for truncation', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, description: 'A long description' },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const descriptionParagraph = contentChildren?.[0];

      expect(descriptionParagraph?.props?.className).toContain('line-clamp-2');
    });
  });

  describe('subtask count display', () => {
    test('does not show subtask count when count is 0', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 0, labels: 0 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      // countsDiv is at index 1 (after description which may be falsy)
      const countsDiv = contentChildren?.[1];
      const subtaskCount = countsDiv?.props?.children?.[0];

      expect(subtaskCount).toBeFalsy();
    });

    test('shows subtask count when count is greater than 0', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 5, labels: 0 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const subtaskCount = countsDiv?.props?.children?.[0];

      expect(subtaskCount).toBeTruthy();
    });

    test('shows CheckSquare icon with subtask count', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 3, labels: 0 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const subtaskCount = countsDiv?.props?.children?.[0];

      // First child should be CheckSquare icon
      const checkSquareIcon = subtaskCount?.props?.children?.[0];
      expect(checkSquareIcon).toBeTruthy();
      expect(
        checkSquareIcon?.type?.displayName || checkSquareIcon?.type?.name,
      ).toBe('SquareCheckBig');
    });

    test('shows correct subtask count text with plural', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 5, labels: 0 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const subtaskCount = countsDiv?.props?.children?.[0];
      // children: [icon, count, " ", text]
      const children = subtaskCount?.props?.children;

      expect(children?.[1]).toBe(5);
      expect(children?.[3]).toBe('subtasks');
    });

    test('shows correct subtask count text with singular', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 1, labels: 0 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const subtaskCount = countsDiv?.props?.children?.[0];
      const children = subtaskCount?.props?.children;

      expect(children?.[1]).toBe(1);
      expect(children?.[3]).toBe('subtask');
    });
  });

  describe('label count display', () => {
    test('does not show label count when count is 0', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 0, labels: 0 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const labelCount = countsDiv?.props?.children?.[1];

      expect(labelCount).toBeFalsy();
    });

    test('shows label count when count is greater than 0', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 0, labels: 3 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const labelCount = countsDiv?.props?.children?.[1];

      expect(labelCount).toBeTruthy();
    });

    test('shows Tag icon with label count', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 0, labels: 2 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const labelCount = countsDiv?.props?.children?.[1];

      // First child should be Tag icon
      const tagIcon = labelCount?.props?.children?.[0];
      expect(tagIcon).toBeTruthy();
      expect(tagIcon?.type?.displayName || tagIcon?.type?.name).toBe('Tag');
    });

    test('shows correct label count text with plural', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 0, labels: 4 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const labelCount = countsDiv?.props?.children?.[1];
      const children = labelCount?.props?.children;

      expect(children?.[1]).toBe(4);
      expect(children?.[3]).toBe('labels');
    });

    test('shows correct label count text with singular', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, _count: { subtasks: 0, labels: 1 } },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const countsDiv = contentChildren?.[1];
      const labelCount = countsDiv?.props?.children?.[1];
      const children = labelCount?.props?.children;

      expect(children?.[1]).toBe(1);
      expect(children?.[3]).toBe('label');
    });
  });

  describe('label badges display', () => {
    test('does not show labels section when labels array is empty', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, labels: [] },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      // Labels section would be at index 2 (after description, counts)
      const labelsDiv = contentChildren?.[2];

      expect(labelsDiv).toBeFalsy();
    });

    test('shows labels when labels array has items', () => {
      const result = TemplateCard({
        template: {
          ...baseTemplate,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
          ],
        },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const labelsDiv = contentChildren?.[2];

      expect(labelsDiv).toBeTruthy();
      expect(labelsDiv?.props?.className).toContain('flex');
    });

    test('shows maximum 3 label badges', () => {
      const result = TemplateCard({
        template: {
          ...baseTemplate,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
            { label: { id: 'l3', name: 'Urgent', color: '#0000ff' } },
            { label: { id: 'l4', name: 'Backend', color: '#ffff00' } },
            { label: { id: 'l5', name: 'Frontend', color: '#ff00ff' } },
          ],
        },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const labelsDiv = contentChildren?.[2];
      const labelChildren = labelsDiv?.props?.children;

      // First child is array of Badge components (max 3)
      const labelBadges = labelChildren?.[0];
      expect(labelBadges).toHaveLength(3);
    });

    test('shows +N badge when more than 3 labels', () => {
      const result = TemplateCard({
        template: {
          ...baseTemplate,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
            { label: { id: 'l3', name: 'Urgent', color: '#0000ff' } },
            { label: { id: 'l4', name: 'Backend', color: '#ffff00' } },
            { label: { id: 'l5', name: 'Frontend', color: '#ff00ff' } },
          ],
        },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const labelsDiv = contentChildren?.[2];
      const labelChildren = labelsDiv?.props?.children;

      // Second child is the "+N" badge
      const overflowBadge = labelChildren?.[1];
      expect(overflowBadge).toBeTruthy();
      // children: ["+", 2]
      const badgeChildren = overflowBadge?.props?.children;
      expect(badgeChildren?.[0]).toBe('+');
      expect(badgeChildren?.[1]).toBe(2);
    });

    test('does not show +N badge when 3 or fewer labels', () => {
      const result = TemplateCard({
        template: {
          ...baseTemplate,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
            { label: { id: 'l3', name: 'Urgent', color: '#0000ff' } },
          ],
        },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const labelsDiv = contentChildren?.[2];
      const labelChildren = labelsDiv?.props?.children;

      // Second child should be falsy (no "+N")
      const overflowBadge = labelChildren?.[1];
      expect(overflowBadge).toBeFalsy();
    });

    test('renders Badge with correct label name and color', () => {
      const result = TemplateCard({
        template: {
          ...baseTemplate,
          labels: [{ label: { id: 'l1', name: 'Bug', color: '#ff0000' } }],
        },
      });

      const cardContent = getCardContent(result);
      const contentChildren = cardContent?.props?.children;
      const labelsDiv = contentChildren?.[2];
      const labelChildren = labelsDiv?.props?.children;
      const labelBadges = labelChildren?.[0];
      const firstBadge = labelBadges?.[0];

      expect(firstBadge?.props?.children).toBe('Bug');
      expect(firstBadge?.props?.style?.backgroundColor).toContain('#ff0000');
    });
  });

  describe('dropdown menu', () => {
    test('renders dropdown menu', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const dropdownMenu = titleAndDropdown?.[1];

      expect(dropdownMenu?.type?.name).toBe('DropdownMenu');
    });

    test('dropdown menu contains Edit option', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const dropdownMenu = titleAndDropdown?.[1];

      const dropdownChildren = dropdownMenu?.props?.children;
      // [Trigger, Content]
      const dropdownContent = dropdownChildren?.[1];

      expect(dropdownContent?.type?.name).toBe('DropdownMenuContent');

      // DropdownMenuContent children: [EditItem, DeleteItem]
      const menuItems = dropdownContent?.props?.children;
      const editItem = menuItems?.[0];
      const editItemChildren = editItem?.props?.children;
      const hasEditText = editItemChildren?.some(
        (child: unknown) => child === 'Edit',
      );

      expect(hasEditText).toBe(true);
    });

    test('dropdown menu contains Delete option with destructive styling', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const dropdownMenu = titleAndDropdown?.[1];

      const dropdownChildren = dropdownMenu?.props?.children;
      const dropdownContent = dropdownChildren?.[1];
      const menuItems = dropdownContent?.props?.children;
      const deleteItem = menuItems?.[1];

      const deleteItemChildren = deleteItem?.props?.children;
      const hasDeleteText = deleteItemChildren?.some(
        (child: unknown) => child === 'Delete',
      );

      expect(hasDeleteText).toBe(true);
      expect(deleteItem?.props?.className).toContain('text-destructive');
    });

    test('Edit option shows Pencil icon', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const dropdownMenu = titleAndDropdown?.[1];

      const dropdownChildren = dropdownMenu?.props?.children;
      const dropdownContent = dropdownChildren?.[1];
      const menuItems = dropdownContent?.props?.children;
      const editItem = menuItems?.[0];
      const editItemChildren = editItem?.props?.children;

      const pencilIcon = editItemChildren?.find(
        (child: unknown) =>
          (child as { type?: { displayName?: string; name?: string } })?.type
            ?.displayName === 'Pencil' ||
          (child as { type?: { displayName?: string; name?: string } })?.type
            ?.name === 'Pencil',
      );

      expect(pencilIcon).toBeTruthy();
    });

    test('Delete option shows Trash2 icon', () => {
      const result = TemplateCard({ template: baseTemplate });

      const cardHeader = getCardHeader(result);
      const headerDiv = cardHeader?.props?.children;
      const titleAndDropdown = headerDiv?.props?.children;
      const dropdownMenu = titleAndDropdown?.[1];

      const dropdownChildren = dropdownMenu?.props?.children;
      const dropdownContent = dropdownChildren?.[1];
      const menuItems = dropdownContent?.props?.children;
      const deleteItem = menuItems?.[1];
      const deleteItemChildren = deleteItem?.props?.children;

      const trashIcon = deleteItemChildren?.find(
        (child: unknown) =>
          (child as { type?: { displayName?: string; name?: string } })?.type
            ?.displayName === 'Trash2' ||
          (child as { type?: { displayName?: string; name?: string } })?.type
            ?.name === 'Trash2',
      );

      expect(trashIcon).toBeTruthy();
    });
  });

  describe('delete confirmation dialog', () => {
    test('renders AlertDialog for delete confirmation', () => {
      const result = TemplateCard({ template: baseTemplate });

      // Fragment children: [Card, editPlaceholder, AlertDialog]
      const alertDialog = result?.props?.children?.[2];

      expect(alertDialog?.type?.name).toBe('AlertDialog');
    });

    test('AlertDialog shows template name in description', () => {
      const result = TemplateCard({
        template: { ...baseTemplate, name: 'My Custom Template' },
      });

      const alertDialog = result?.props?.children?.[2];
      // AlertDialog children: AlertDialogContent
      const alertContent = alertDialog?.props?.children;
      // AlertDialogContent children: [Header, Footer]
      const alertChildren = alertContent?.props?.children;
      const alertHeader = alertChildren?.[0];
      // AlertDialogHeader children: [Title, Description]
      const headerChildren = alertHeader?.props?.children;
      const description = headerChildren?.[1];
      // Description children should contain the template name
      const descText = JSON.stringify(description?.props?.children);

      expect(descText).toContain('My Custom Template');
    });
  });

  describe('Card component structure', () => {
    test('uses Card component from shadcn/ui', () => {
      const result = TemplateCard({ template: baseTemplate });

      const card = getCard(result);

      expect(card?.type?.name).toBe('Card');
    });

    test('Card has CardHeader and CardContent', () => {
      const result = TemplateCard({ template: baseTemplate });

      const card = getCard(result);
      const cardChildren = card?.props?.children;

      const cardHeader = cardChildren?.[0];
      const cardContent = cardChildren?.[1];

      expect(cardHeader?.type?.name).toBe('CardHeader');
      expect(cardContent?.type?.name).toBe('CardContent');
    });

    test('has data-testid for testing', () => {
      const result = TemplateCard({ template: baseTemplate });

      const card = getCard(result);

      expect(card?.props?.['data-testid']).toBe('template-card');
    });
  });
});
