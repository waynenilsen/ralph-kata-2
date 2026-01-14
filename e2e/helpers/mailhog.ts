/**
 * E2E test helpers for interacting with the Mailhog API.
 * Used to verify email sending functionality in tests.
 *
 * Mailhog API runs at localhost:44322 (configured in docker-compose.yml)
 */

const MAILHOG_API_BASE = 'http://localhost:44322';

/**
 * Represents an email address in Mailhog's format
 */
interface MailhogAddress {
  Mailbox: string;
  Domain: string;
}

/**
 * Represents a message from the Mailhog API
 */
export interface MailhogMessage {
  ID: string;
  From: MailhogAddress;
  To: MailhogAddress[];
  Content: {
    Headers: {
      Subject: string[];
      From: string[];
      To: string[];
      'Content-Type': string[];
    };
    Body: string;
  };
  Created: string;
  Raw: {
    From: string;
    To: string[];
    Data: string;
  };
}

/**
 * Response from the Mailhog search API
 */
interface MailhogSearchResponse {
  total: number;
  count: number;
  start: number;
  items: MailhogMessage[];
}

/**
 * Fetches all emails sent to a specific recipient from Mailhog.
 *
 * @param email - The recipient email address to search for
 * @returns Array of messages sent to the recipient
 *
 * @example
 * ```typescript
 * const emails = await getEmailsForRecipient('user@example.com');
 * expect(emails.length).toBeGreaterThan(0);
 * ```
 */
export async function getEmailsForRecipient(
  email: string,
): Promise<MailhogMessage[]> {
  const response = await fetch(
    `${MAILHOG_API_BASE}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch emails from Mailhog: ${response.status} ${response.statusText}`,
    );
  }

  const data: MailhogSearchResponse = await response.json();
  return data.items || [];
}

/**
 * Clears all emails from Mailhog.
 * Useful for test isolation - call this in beforeEach to ensure a clean state.
 *
 * @example
 * ```typescript
 * test.beforeEach(async () => {
 *   await clearAllEmails();
 * });
 * ```
 */
export async function clearAllEmails(): Promise<void> {
  const response = await fetch(`${MAILHOG_API_BASE}/api/v1/messages`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(
      `Failed to clear emails from Mailhog: ${response.status} ${response.statusText}`,
    );
  }
}

/**
 * Waits for an email to be received by a specific recipient.
 * Polls the Mailhog API until an email is found or the timeout is reached.
 *
 * @param email - The recipient email address to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 5000ms)
 * @returns The first email received by the recipient
 * @throws Error if no email is received within the timeout
 *
 * @example
 * ```typescript
 * // Trigger email send
 * await page.click('button[type="submit"]');
 *
 * // Wait for email to arrive
 * const email = await waitForEmail('user@example.com', 10000);
 * expect(email.Content.Headers.Subject[0]).toContain('Welcome');
 * ```
 */
export async function waitForEmail(
  email: string,
  timeout = 5000,
): Promise<MailhogMessage> {
  const pollInterval = 100;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const emails = await getEmailsForRecipient(email);
    if (emails.length > 0) {
      return emails[0];
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`No email received for ${email} within ${timeout}ms`);
}
