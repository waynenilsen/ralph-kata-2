import { describe, expect, test } from 'bun:test';
import type { Activity } from '@/app/actions/activities';
import { ActivityItem, getActivityMessage } from './activity-item';

function createActivity(overrides: Partial<Activity>): Activity {
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

describe('getActivityMessage', () => {
  test('returns correct message for CREATED action', () => {
    const activity = createActivity({ action: 'CREATED' });
    expect(getActivityMessage(activity)).toBe('alice created this todo');
  });

  test('returns correct message for STATUS_CHANGED action', () => {
    const activity = createActivity({
      action: 'STATUS_CHANGED',
      oldValue: 'PENDING',
      newValue: 'COMPLETED',
    });
    expect(getActivityMessage(activity)).toBe(
      'alice changed status from PENDING to COMPLETED',
    );
  });

  test('returns correct message for ASSIGNEE_CHANGED when assigning', () => {
    const activity = createActivity({
      action: 'ASSIGNEE_CHANGED',
      oldValue: null,
      newValue: 'user-123',
    });
    expect(getActivityMessage(activity)).toBe('alice assigned this todo');
  });

  test('returns correct message for ASSIGNEE_CHANGED when removing assignee', () => {
    const activity = createActivity({
      action: 'ASSIGNEE_CHANGED',
      oldValue: 'user-123',
      newValue: null,
    });
    expect(getActivityMessage(activity)).toBe('alice removed assignee');
  });

  test('returns correct message for ASSIGNEE_CHANGED when changing assignee', () => {
    const activity = createActivity({
      action: 'ASSIGNEE_CHANGED',
      oldValue: 'user-123',
      newValue: 'user-456',
    });
    expect(getActivityMessage(activity)).toBe('alice changed assignee');
  });

  test('returns correct message for DUE_DATE_CHANGED when setting due date', () => {
    const activity = createActivity({
      action: 'DUE_DATE_CHANGED',
      oldValue: null,
      newValue: '2026-01-20',
    });
    expect(getActivityMessage(activity)).toBe('alice set due date');
  });

  test('returns correct message for DUE_DATE_CHANGED when removing due date', () => {
    const activity = createActivity({
      action: 'DUE_DATE_CHANGED',
      oldValue: '2026-01-20',
      newValue: null,
    });
    expect(getActivityMessage(activity)).toBe('alice removed due date');
  });

  test('returns correct message for DUE_DATE_CHANGED when modifying due date', () => {
    const activity = createActivity({
      action: 'DUE_DATE_CHANGED',
      oldValue: '2026-01-15',
      newValue: '2026-01-20',
    });
    expect(getActivityMessage(activity)).toBe('alice changed due date');
  });

  test('returns correct message for LABELS_CHANGED when adding label', () => {
    const activity = createActivity({
      action: 'LABELS_CHANGED',
      oldValue: null,
      newValue: 'urgent',
    });
    expect(getActivityMessage(activity)).toBe('alice added label "urgent"');
  });

  test('returns correct message for LABELS_CHANGED when removing label', () => {
    const activity = createActivity({
      action: 'LABELS_CHANGED',
      oldValue: 'urgent',
      newValue: null,
    });
    expect(getActivityMessage(activity)).toBe('alice removed label "urgent"');
  });

  test('returns correct message for LABELS_CHANGED edge case', () => {
    const activity = createActivity({
      action: 'LABELS_CHANGED',
      oldValue: 'old-label',
      newValue: 'new-label',
    });
    expect(getActivityMessage(activity)).toBe('alice changed labels');
  });

  test('returns correct message for DESCRIPTION_CHANGED action', () => {
    const activity = createActivity({ action: 'DESCRIPTION_CHANGED' });
    expect(getActivityMessage(activity)).toBe('alice updated the description');
  });

  test('uses username part of email for brevity', () => {
    const activity = createActivity({
      action: 'CREATED',
      actorEmail: 'john.doe@company.com',
    });
    expect(getActivityMessage(activity)).toBe('john.doe created this todo');
  });
});

describe('ActivityItem', () => {
  test('renders actor initials in avatar', () => {
    const activity = createActivity({ actorEmail: 'alice@example.com' });
    const result = ActivityItem({ activity });

    // Find the avatar div
    const avatarDiv = result?.props?.children?.[0];
    expect(avatarDiv?.props?.children).toBe('A');
  });

  test('renders message correctly', () => {
    const activity = createActivity({ action: 'CREATED' });
    const result = ActivityItem({ activity });

    // Find the message paragraph
    const contentDiv = result?.props?.children?.[1];
    const messageParagraph = contentDiv?.props?.children?.[0];
    expect(messageParagraph?.props?.children).toBe('alice created this todo');
  });

  test('renders relative timestamp', () => {
    const activity = createActivity({
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });
    const result = ActivityItem({ activity });

    // Find the timestamp paragraph
    const contentDiv = result?.props?.children?.[1];
    const timestampParagraph = contentDiv?.props?.children?.[1];
    // Should contain "ago" for relative time
    expect(timestampParagraph?.props?.children).toContain('ago');
  });

  test('renders as a div element with proper structure', () => {
    const activity = createActivity({});
    const result = ActivityItem({ activity });
    expect(result?.type).toBe('div');
  });

  test('has correct styling classes', () => {
    const activity = createActivity({});
    const result = ActivityItem({ activity });
    const className = result?.props?.className;
    expect(className).toContain('flex');
    expect(className).toContain('items-start');
    expect(className).toContain('gap-2');
  });

  test('avatar has correct styling', () => {
    const activity = createActivity({});
    const result = ActivityItem({ activity });
    const avatarDiv = result?.props?.children?.[0];
    const className = avatarDiv?.props?.className;
    expect(className).toContain('rounded-full');
    expect(className).toContain('bg-muted');
  });

  test('renders uppercase initial from email', () => {
    const activity = createActivity({ actorEmail: 'bob@test.com' });
    const result = ActivityItem({ activity });
    const avatarDiv = result?.props?.children?.[0];
    expect(avatarDiv?.props?.children).toBe('B');
  });
});
