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
 * Props for the DueSoonEmail component.
 */
export interface DueSoonEmailProps {
  /** The title of the todo item that is due soon */
  todoTitle: string;
  /** The due date of the todo */
  dueDate: Date;
  /** The URL to the todos page in the app */
  appUrl: string;
}

/**
 * Formats a date as a human-readable string (e.g., "January 15, 2025").
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Email template for due soon reminders.
 * Renders a responsive HTML email reminding the user of an upcoming todo deadline.
 *
 * @example
 * ```tsx
 * <DueSoonEmail
 *   todoTitle="Complete project report"
 *   dueDate={new Date('2025-01-15T10:00:00Z')}
 *   appUrl="https://example.com/todos"
 * />
 * ```
 */
export function DueSoonEmail({
  todoTitle,
  dueDate,
  appUrl,
}: DueSoonEmailProps) {
  const formattedDate = formatDate(dueDate);

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Reminder</Heading>
          <Text style={textStyle}>
            Your todo <strong>{todoTitle}</strong> is due soon.
          </Text>
          <Text style={dateStyle}>Due date: {formattedDate}</Text>
          <Button href={appUrl} style={buttonStyle}>
            View Todos
          </Button>
          <Text style={linkTextStyle}>
            Or copy this link:{' '}
            <Link href={appUrl} style={linkStyle}>
              {appUrl}
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

const dateStyle = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '24px',
  fontWeight: '500',
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

export default DueSoonEmail;
