import { describe, expect, test } from 'bun:test';
import { render } from '@react-email/render';
import { OverdueEmail } from './overdue';

describe('OverdueEmail', () => {
  const defaultProps = {
    todoTitle: 'Complete project report',
    dueDate: new Date('2025-01-15T10:00:00Z'),
    appUrl: 'https://example.com/todos',
  };

  test('renders valid HTML', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test('includes todo title in content', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('Complete project report');
  });

  test('includes formatted due date', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    // Date should be formatted in a human-readable way
    expect(html).toContain('January 15, 2025');
  });

  test('includes app URL in button href', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('href="https://example.com/todos"');
  });

  test('includes app URL as text for copy', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('>https://example.com/todos<');
  });

  test('includes overdue heading', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('Overdue');
  });

  test('includes view todos button text', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('View Todos');
  });

  test('indicates todo was due in the past', async () => {
    const html = await render(<OverdueEmail {...defaultProps} />);

    expect(html).toContain('was due');
  });

  test('renders with different todo title', async () => {
    const html = await render(
      <OverdueEmail
        todoTitle="Submit expense report"
        dueDate={defaultProps.dueDate}
        appUrl={defaultProps.appUrl}
      />,
    );

    expect(html).toContain('Submit expense report');
    expect(html).not.toContain('Complete project report');
  });

  test('renders with different due date', async () => {
    const html = await render(
      <OverdueEmail
        todoTitle={defaultProps.todoTitle}
        dueDate={new Date('2025-03-20T14:30:00Z')}
        appUrl={defaultProps.appUrl}
      />,
    );

    expect(html).toContain('March 20, 2025');
  });

  test('renders with different app URL', async () => {
    const differentUrl = 'https://other.com/todos';
    const html = await render(
      <OverdueEmail
        todoTitle={defaultProps.todoTitle}
        dueDate={defaultProps.dueDate}
        appUrl={differentUrl}
      />,
    );

    expect(html).toContain('href="https://other.com/todos"');
    expect(html).toContain('>https://other.com/todos<');
  });
});
