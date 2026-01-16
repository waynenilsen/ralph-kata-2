import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

// Mock React hooks to avoid state updates during synchronous rendering
// This is necessary because TemplateCard uses useState internally
mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
  useTransition: () => [false, mock(() => {})],
}));

const { TemplateList } = await import('./template-list');

const baseTemplate = {
  id: 'template-1',
  name: 'Test Template 1',
  description: 'Test description',
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  createdBy: { id: 'user-1', email: 'test@example.com' },
  labels: [],
  subtasks: [],
  _count: { subtasks: 0, labels: 0 },
};

const createTemplates = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...baseTemplate,
    id: `template-${i + 1}`,
    name: `Template ${i + 1}`,
  }));

describe('TemplateList', () => {
  describe('basic rendering', () => {
    test('renders a grid container', () => {
      const result = TemplateList({ templates: [] });

      expect(result?.type).toBe('div');
    });

    test('has responsive grid classes', () => {
      const result = TemplateList({ templates: [] });

      expect(result?.props?.className).toContain('grid');
      // 1 column on mobile
      expect(result?.props?.className).toContain('grid-cols-1');
      // 2 columns on tablet (md breakpoint)
      expect(result?.props?.className).toContain('md:grid-cols-2');
      // 3 columns on desktop (lg breakpoint)
      expect(result?.props?.className).toContain('lg:grid-cols-3');
    });

    test('has gap-4 spacing', () => {
      const result = TemplateList({ templates: [] });

      expect(result?.props?.className).toContain('gap-4');
    });

    test('has data-testid for testing', () => {
      const result = TemplateList({ templates: [] });

      expect(result?.props?.['data-testid']).toBe('template-list');
    });
  });

  describe('template mapping', () => {
    test('renders no TemplateCards when templates array is empty', () => {
      const result = TemplateList({ templates: [] });

      const children = result?.props?.children;
      expect(children).toHaveLength(0);
    });

    test('renders one TemplateCard when templates has one item', () => {
      const templates = createTemplates(1);
      const result = TemplateList({ templates });

      const children = result?.props?.children;
      expect(children).toHaveLength(1);
    });

    test('renders multiple TemplateCards when templates has multiple items', () => {
      const templates = createTemplates(5);
      const result = TemplateList({ templates });

      const children = result?.props?.children;
      expect(children).toHaveLength(5);
    });

    test('passes template prop to each TemplateCard', () => {
      const templates = createTemplates(3);
      const result = TemplateList({ templates });

      const children = result?.props?.children;

      children.forEach(
        (
          child: React.ReactElement<{ template: typeof baseTemplate }>,
          index: number,
        ) => {
          expect(child?.props?.template).toBe(templates[index]);
        },
      );
    });

    test('each TemplateCard has unique key based on template id', () => {
      const templates = createTemplates(3);
      const result = TemplateList({ templates });

      const children = result?.props?.children;

      children.forEach((child: React.ReactElement, index: number) => {
        expect(child?.key).toBe(`template-${index + 1}`);
      });
    });
  });

  describe('renders TemplateCard component', () => {
    test('children are TemplateCard components', () => {
      const templates = createTemplates(2);
      const result = TemplateList({ templates });

      const children = result?.props?.children;

      children.forEach((child: React.ReactElement) => {
        // TemplateCard returns a Fragment, so check the type name
        expect(child?.type?.name).toBe('TemplateCard');
      });
    });
  });
});
