'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { hashPassword } from '@/lib/auth';
import { sendEmail } from '@/lib/email/send';
import { PasswordResetEmail } from '@/lib/email/templates/password-reset';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';

const TOKEN_EXPIRY_HOURS = 1;

/**
 * Generates a cryptographically secure random token for password reset.
 * Uses 32 bytes (256 bits) of entropy encoded as base64url.
 * @returns A secure random token string
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Requests a password reset email.
 * Always returns success regardless of whether email exists (security).
 * @param email - The email address to send the reset link to
 * @returns Object with success property (always true)
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: boolean }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });

  if (user) {
    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = generateResetToken();
    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password/${token}`;

    await sendEmail({
      to: email,
      subject: 'Reset your password',
      template: PasswordResetEmail({
        resetUrl,
        expiresInHours: TOKEN_EXPIRY_HOURS,
      }),
    });
  }

  // Always return success to not reveal email existence
  return { success: true };
}

/**
 * Validates a password reset token.
 * @param token - The reset token to validate
 * @returns Object with valid property indicating if token is valid and not expired
 */
export async function validateResetToken(
  token: string,
): Promise<{ valid: boolean }> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return { valid: false };
  }

  return { valid: true };
}

export type ResetPasswordState = {
  errors?: {
    password?: string[];
    _form?: string[];
  };
};

/**
 * Resets the user's password and logs them in.
 * Updates password, deletes token, invalidates all sessions, creates new session.
 * Redirects to /todos on success.
 * @param token - The reset token
 * @param newPassword - The new password to set
 * @returns Form state with errors or redirects to /todos on success
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<ResetPasswordState> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return { errors: { _form: ['Invalid or expired reset link'] } };
  }

  const passwordHash = await hashPassword(newPassword);

  // Update password, delete token, and invalidate sessions in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({
      where: { token },
    }),
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  // Create new session for the user
  await createSession(resetToken.userId, resetToken.user.tenantId);

  redirect('/todos');
}
