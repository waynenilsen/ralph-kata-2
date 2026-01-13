'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSession, getSession } from '@/lib/session';

const INVITE_EXPIRY_DAYS = 7;

const createInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateInviteState = {
  errors?: {
    email?: string[];
    _form?: string[];
  };
  success?: boolean;
  inviteLink?: string;
};

export type AcceptInviteState = {
  errors?: {
    password?: string[];
    _form?: string[];
  };
};

/**
 * Creates a new invite for a user to join the tenant.
 * Only ADMIN users can create invites.
 * @param _prevState - Previous form state
 * @param formData - Form data with email
 * @returns Form state with errors or success with invite link
 */
export async function createInvite(
  _prevState: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const session = await getSession();

  if (!session) {
    return {
      errors: {
        _form: ['You must be authenticated to create an invite'],
      },
    };
  }

  // Check if user is ADMIN
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    return {
      errors: {
        _form: ['Only ADMIN users can invite new members'],
      },
    };
  }

  const rawData = {
    email: formData.get('email'),
  };

  const result = createInviteSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { email } = result.data;

  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.invite.create({
    data: {
      email,
      token,
      tenantId: session.tenantId,
      expiresAt,
    },
  });

  // Log invite link to console (no email service)
  const inviteLink = `/invite/${token}`;
  console.log(`Invite link for ${email}: ${inviteLink}`);

  revalidatePath('/todos');

  return {
    success: true,
    inviteLink,
  };
}

/**
 * Accepts an invite and creates a new user.
 * @param _prevState - Previous form state
 * @param formData - Form data with token and password
 * @returns Form state with errors or redirects to /todos on success
 */
export async function acceptInvite(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const rawData = {
    token: formData.get('token'),
    password: formData.get('password'),
  };

  const result = acceptInviteSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { token, password } = result.data;

  // Find the invite
  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite) {
    return {
      errors: {
        _form: ['This invite link is invalid'],
      },
    };
  }

  if (invite.expiresAt < new Date()) {
    return {
      errors: {
        _form: ['This invite link has expired'],
      },
    };
  }

  const passwordHash = await hashPassword(password);

  // Create user and delete invite in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: invite.email,
        passwordHash,
        role: 'MEMBER',
        tenantId: invite.tenantId,
      },
    });

    // Use deleteMany to avoid errors if invite was already deleted (race condition)
    await tx.invite.deleteMany({
      where: { token },
    });

    return newUser;
  });

  await createSession(user.id, user.tenantId);

  redirect('/todos');
}
