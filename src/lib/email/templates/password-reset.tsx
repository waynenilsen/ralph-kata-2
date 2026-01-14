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
 * Props for the PasswordResetEmail component.
 */
export interface PasswordResetEmailProps {
  /** The full URL for resetting the password */
  resetUrl: string;
  /** Number of hours until the reset link expires */
  expiresInHours: number;
}

/**
 * Email template for password reset requests.
 * Renders a responsive HTML email with a password reset link and expiration warning.
 *
 * @example
 * ```tsx
 * <PasswordResetEmail
 *   resetUrl="https://example.com/reset/abc123"
 *   expiresInHours={24}
 * />
 * ```
 */
export function PasswordResetEmail({
  resetUrl,
  expiresInHours,
}: PasswordResetEmailProps) {
  const hoursText = expiresInHours === 1 ? '1 hour' : `${expiresInHours} hours`;

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Reset Your Password</Heading>
          <Text style={textStyle}>
            We received a request to reset your password. Click the button below
            to create a new password.
          </Text>
          <Button href={resetUrl} style={buttonStyle}>
            Reset Password
          </Button>
          <Text style={linkTextStyle}>
            Or copy this link:{' '}
            <Link href={resetUrl} style={linkStyle}>
              {resetUrl}
            </Link>
          </Text>
          <Text style={warningStyle}>
            This link will expire in {hoursText}. If you didn't request a
            password reset, you can safely ignore this email.
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

const warningStyle = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  marginTop: '24px',
  borderTop: '1px solid #e5e7eb',
  paddingTop: '16px',
};

export default PasswordResetEmail;
