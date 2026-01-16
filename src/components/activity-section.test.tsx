import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import type { Activity } from '@/app/actions/activities';

// Track mock state - these control what the component renders
let mockActivities: Activity[] = [];
let mockIsLoading = true;
let mockIsOpen = false;

// Mock React hooks to control component state
mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => {
    if (initial === true) {
      // isLoading state
      return [mockIsLoading, () => {}];
    }
    if (initial === false) {
      // isOpen state
      return [mockIsOpen, () => {}];
    }
    if (Array.isArray(initial)) {
      // activities state
      return [mockActivities, () => {}];
    }
    return [initial, () => {}];
  },
  useEffect: () => {}, // No-op - don't actually fetch
}));

// Import after mocking - we don't mock @/app/actions/activities
// because useEffect is mocked to do nothing, so getTodoActivities never gets called
const { ActivitySection } = await import('./activity-section');

function createActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'test-id',
    actorId: 'actor-1',
    actorEmail: 'alice@example.com',
    action: 'CREATED',
    field: null,
    oldValue: null,
    newValue: null,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

describe('ActivitySection', () => {
  beforeEach(() => {
    mockActivities = [];
    mockIsLoading = true;
    mockIsOpen = false;
  });

  describe('rendering', () => {
    test('renders as a div with correct structure', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      expect(result?.type).toBe('div');
    });

    test('has border-t and padding styling like other sections', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const className = result?.props?.className;
      expect(className).toContain('border-t');
      expect(className).toContain('pt-4');
      expect(className).toContain('mt-4');
    });

    test('uses Collapsible component', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      expect(collapsible?.type?.name).toBe('Collapsible');
    });

    test('has collapsible trigger as first child', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      expect(trigger?.type?.name).toBe('CollapsibleTrigger');
    });

    test('has collapsible content as second child', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const content = collapsible?.props?.children?.[1];
      expect(content?.type?.name).toBe('CollapsibleContent');
    });
  });

  describe('collapsed state', () => {
    test('is collapsed by default (defaultOpen=false)', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      expect(collapsible?.props?.defaultOpen).toBe(false);
    });
  });

  describe('header display', () => {
    test('displays loading indicator in count when loading', () => {
      mockIsLoading = true;
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      const span = trigger?.props?.children?.[0];
      expect(span?.props?.children).toContain('...');
    });

    test('displays activity count when not loading', () => {
      mockIsLoading = false;
      mockActivities = [
        createActivity({ id: '1' }),
        createActivity({ id: '2' }),
      ];
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      const span = trigger?.props?.children?.[0];
      // Should contain "Activity (2)" - children is an array
      const children = span?.props?.children;
      expect(Array.isArray(children)).toBe(true);
      expect(children[0]).toContain('Activity');
      expect(children[1]).toBe(2);
    });
  });

  describe('content states', () => {
    test('displays loading message when loading', () => {
      mockIsLoading = true;
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const content = collapsible?.props?.children?.[1];
      const contentChildren = content?.props?.children;
      // Should show Loading...
      expect(contentChildren?.props?.children).toBe('Loading...');
    });

    test('displays empty state when no activities', () => {
      mockIsLoading = false;
      mockActivities = [];
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const content = collapsible?.props?.children?.[1];
      const contentChildren = content?.props?.children;
      expect(contentChildren?.props?.children).toBe('No activity yet');
    });

    test('renders ActivityItem for each activity', () => {
      mockIsLoading = false;
      mockActivities = [
        createActivity({ id: '1', actorEmail: 'alice@example.com' }),
        createActivity({ id: '2', actorEmail: 'bob@example.com' }),
      ];
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const content = collapsible?.props?.children?.[1];
      const contentChildren = content?.props?.children;
      // Should be a div with activity items
      expect(contentChildren?.type).toBe('div');
      expect(contentChildren?.props?.children).toHaveLength(2);
    });
  });

  describe('chevron icon', () => {
    test('has chevron icon in trigger', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      const chevron = trigger?.props?.children?.[1];
      expect(chevron).toBeDefined();
    });

    test('chevron rotates when open', () => {
      mockIsOpen = true;
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      const chevron = trigger?.props?.children?.[1];
      expect(chevron?.props?.className).toContain('rotate-180');
    });

    test('chevron not rotated when closed', () => {
      mockIsOpen = false;
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      const chevron = trigger?.props?.children?.[1];
      expect(chevron?.props?.className).not.toContain('rotate-180');
    });
  });

  describe('styling', () => {
    test('trigger has full width and flex styling', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const trigger = collapsible?.props?.children?.[0];
      expect(trigger?.props?.className).toContain('w-full');
      expect(trigger?.props?.className).toContain('flex');
    });

    test('content has padding', () => {
      const result = ActivitySection({ todoId: 'todo-1' });
      const collapsible = result?.props?.children;
      const content = collapsible?.props?.children?.[1];
      expect(content?.props?.className).toContain('pt-');
    });
  });
});
