import { describe, expect, test } from 'bun:test';
import { render } from '@react-email/render';
import { InviteEmail } from './invite';

describe('InviteEmail', () => {
  const defaultProps = {
    inviteUrl: 'https://example.com/invite/abc123',
    tenantName: 'Acme Corp',
  };

  test('renders valid HTML', async () => {
    const html = await render(<InviteEmail {...defaultProps} />);

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test('includes tenant name in content', async () => {
    const html = await render(<InviteEmail {...defaultProps} />);

    expect(html).toContain('Acme Corp');
  });

  test('includes invite URL in button href', async () => {
    const html = await render(<InviteEmail {...defaultProps} />);

    expect(html).toContain('href="https://example.com/invite/abc123"');
  });

  test('includes invite URL as text for copy', async () => {
    const html = await render(<InviteEmail {...defaultProps} />);

    // The URL should appear as visible text (not just in href)
    expect(html).toContain('>https://example.com/invite/abc123<');
  });

  test('includes heading with invitation message', async () => {
    const html = await render(<InviteEmail {...defaultProps} />);

    // Apostrophe is HTML-encoded as &#x27;
    expect(html).toContain('You&#x27;ve been invited!');
  });

  test('includes accept invitation button text', async () => {
    const html = await render(<InviteEmail {...defaultProps} />);

    expect(html).toContain('Accept Invitation');
  });

  test('renders with different tenant name', async () => {
    const html = await render(
      <InviteEmail inviteUrl={defaultProps.inviteUrl} tenantName="Test Org" />,
    );

    expect(html).toContain('Test Org');
    expect(html).not.toContain('Acme Corp');
  });

  test('renders with different invite URL', async () => {
    const differentUrl = 'https://other.com/invite/xyz789';
    const html = await render(
      <InviteEmail
        inviteUrl={differentUrl}
        tenantName={defaultProps.tenantName}
      />,
    );

    expect(html).toContain('href="https://other.com/invite/xyz789"');
    expect(html).toContain('>https://other.com/invite/xyz789<');
  });
});
