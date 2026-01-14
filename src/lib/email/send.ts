import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import type { ReactElement } from 'react';

/**
 * Options for sending an email.
 */
export interface SendEmailOptions {
  /** The recipient email address */
  to: string;
  /** The email subject line */
  subject: string;
  /** The React Email template to render */
  template: ReactElement;
}

/**
 * SMTP configuration from environment variables.
 * Defaults to localhost:44321 for development with Mailhog.
 */
const smtpConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 44321,
  secure: false,
};

/**
 * The sender email address.
 */
const emailFrom = process.env.EMAIL_FROM || 'noreply@teamtodo.local';

/**
 * Sends an email using the configured SMTP server.
 *
 * @param options - The email options including recipient, subject, and template
 * @returns Promise that resolves to true if email was sent, false if SMTP unavailable
 *
 * @example
 * ```ts
 * import { sendEmail } from '@/lib/email/send';
 * import { InviteEmail } from '@/lib/email/templates/invite';
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'You have been invited!',
 *   template: <InviteEmail inviteUrl="..." tenantName="..." />,
 * });
 * ```
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, template } = options;

  try {
    const transporter = nodemailer.createTransport(smtpConfig);

    const html = await render(template);

    await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.warn(
      `[email] Failed to send email to ${to}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
