import bcrypt from 'bcryptjs';

const BCRYPT_COST = 10;

/**
 * Hashes a password using bcrypt with cost factor 10.
 * @param password - The plain text password to hash
 * @returns The bcrypt hash of the password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verifies a password against a bcrypt hash.
 * @param password - The plain text password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns True if the password matches the hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
