import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { InviteEmail } from './templates/invite';

// Mock nodemailer
const mockSendMail = mock(() => Promise.resolve({ messageId: 'test-id' }));
const mockCreateTransport = mock(() => ({
  sendMail: mockSendMail,
}));

mock.module('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

// Import after mocking
const { sendEmail } = await import('./send');

describe('sendEmail', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
  });

  test('creates transporter with correct SMTP config', async () => {
    await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      template: <InviteEmail inviteUrl="https://test.com" tenantName="Test" />,
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 44321,
      secure: false,
    });
  });

  test('sends email with correct parameters', async () => {
    await sendEmail({
      to: 'recipient@example.com',
      subject: 'Welcome!',
      template: <InviteEmail inviteUrl="https://test.com" tenantName="Test" />,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('recipient@example.com');
    expect(callArgs.subject).toBe('Welcome!');
    expect(callArgs.from).toBe('noreply@teamtodo.local');
    expect(callArgs.html).toContain('<!DOCTYPE html');
  });

  test('returns true on successful send', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      template: <InviteEmail inviteUrl="https://test.com" tenantName="Test" />,
    });

    expect(result).toBe(true);
  });

  test('returns false when SMTP fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      template: <InviteEmail inviteUrl="https://test.com" tenantName="Test" />,
    });

    expect(result).toBe(false);
  });

  test('renders template to HTML before sending', async () => {
    await sendEmail({
      to: 'test@example.com',
      subject: 'Invitation',
      template: (
        <InviteEmail
          inviteUrl="https://app.com/invite/token123"
          tenantName="Acme Corp"
        />
      ),
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain('Acme Corp');
    expect(callArgs.html).toContain('https://app.com/invite/token123');
  });
});
