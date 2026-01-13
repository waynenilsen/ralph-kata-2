import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from './auth';

describe('hashPassword', () => {
  test('returns a hash different from the original password', async () => {
    const password = 'mySecretPassword123';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(0);
  });

  test('returns different hashes for the same password', async () => {
    const password = 'mySecretPassword123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  test('returns a bcrypt hash format', async () => {
    const password = 'test';
    const hash = await hashPassword(password);

    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$/);
  });
});

describe('verifyPassword', () => {
  test('returns true for correct password', async () => {
    const password = 'correctPassword';
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);

    expect(result).toBe(true);
  });

  test('returns false for incorrect password', async () => {
    const password = 'correctPassword';
    const hash = await hashPassword(password);

    const result = await verifyPassword('wrongPassword', hash);

    expect(result).toBe(false);
  });

  test('returns false for empty password', async () => {
    const hash = await hashPassword('somePassword');

    const result = await verifyPassword('', hash);

    expect(result).toBe(false);
  });
});
