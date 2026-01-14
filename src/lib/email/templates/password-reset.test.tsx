import { describe, expect, test } from 'bun:test';
import { render } from '@react-email/render';
import { PasswordResetEmail } from './password-reset';

describe('PasswordResetEmail', () => {
  const defaultProps = {
    resetUrl: 'https://example.com/reset/abc123',
    expiresInHours: 24,
  };

  test('renders valid HTML', async () => {
    const html = await render(<PasswordResetEmail {...defaultProps} />);

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test('includes reset URL in button href', async () => {
    const html = await render(<PasswordResetEmail {...defaultProps} />);

    expect(html).toContain('href="https://example.com/reset/abc123"');
  });

  test('includes reset URL as text for copy', async () => {
    const html = await render(<PasswordResetEmail {...defaultProps} />);

    // The URL should appear as visible text (not just in href)
    expect(html).toContain('>https://example.com/reset/abc123<');
  });

  test('includes heading with reset message', async () => {
    const html = await render(<PasswordResetEmail {...defaultProps} />);

    expect(html).toContain('Reset Your Password');
  });

  test('includes reset button text', async () => {
    const html = await render(<PasswordResetEmail {...defaultProps} />);

    expect(html).toContain('Reset Password');
  });

  test('includes expiration warning with hours', async () => {
    const html = await render(<PasswordResetEmail {...defaultProps} />);

    expect(html).toContain('24 hours');
  });

  test('renders with different reset URL', async () => {
    const differentUrl = 'https://other.com/reset/xyz789';
    const html = await render(
      <PasswordResetEmail
        resetUrl={differentUrl}
        expiresInHours={defaultProps.expiresInHours}
      />,
    );

    expect(html).toContain('href="https://other.com/reset/xyz789"');
    expect(html).toContain('>https://other.com/reset/xyz789<');
  });

  test('renders with different expiration time', async () => {
    const html = await render(
      <PasswordResetEmail
        resetUrl={defaultProps.resetUrl}
        expiresInHours={1}
      />,
    );

    expect(html).toContain('1 hour');
    expect(html).not.toContain('24 hours');
  });

  test('uses singular hour for 1 hour expiration', async () => {
    const html = await render(
      <PasswordResetEmail
        resetUrl={defaultProps.resetUrl}
        expiresInHours={1}
      />,
    );

    expect(html).toContain('1 hour');
    expect(html).not.toContain('1 hours');
  });

  test('uses plural hours for multiple hours', async () => {
    const html = await render(
      <PasswordResetEmail
        resetUrl={defaultProps.resetUrl}
        expiresInHours={2}
      />,
    );

    expect(html).toContain('2 hours');
  });
});
