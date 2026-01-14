import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Text,
} from '@react-email/components';

/**
 * Props for the InviteEmail component.
 */
export interface InviteEmailProps {
  /** The full URL for accepting the invitation */
  inviteUrl: string;
  /** The name of the tenant the user is being invited to */
  tenantName: string;
}

/**
 * Email template for tenant invitations.
 * Renders a responsive HTML email with an invitation to join a tenant.
 *
 * @example
 * ```tsx
 * <InviteEmail
 *   inviteUrl="https://example.com/invite/abc123"
 *   tenantName="Acme Corp"
 * />
 * ```
 */
export function InviteEmail({ inviteUrl, tenantName }: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>You've been invited!</Heading>
          <Text style={textStyle}>
            You've been invited to join <strong>{tenantName}</strong>.
          </Text>
          <Button href={inviteUrl} style={buttonStyle}>
            Accept Invitation
          </Button>
          <Text style={linkTextStyle}>
            Or copy this link:{' '}
            <Link href={inviteUrl} style={linkStyle}>
              {inviteUrl}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const containerStyle = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '580px',
  borderRadius: '4px',
};

const headingStyle = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.25',
  marginBottom: '24px',
};

const textStyle = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '24px',
};

const buttonStyle = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '12px 24px',
  textDecoration: 'none',
};

const linkTextStyle = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  marginTop: '24px',
};

const linkStyle = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export default InviteEmail;
