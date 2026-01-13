'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';

const registerSchema = z.object({
  tenantName: z.string().min(1, 'Tenant name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RegisterState = {
  errors?: {
    tenantName?: string[];
    email?: string[];
    password?: string[];
    _form?: string[];
  };
};

/**
 * Registers a new tenant with an admin user.
 * Creates tenant and user atomically in a single transaction.
 * @param _prevState - Previous form state
 * @param formData - Form data with tenantName, email, and password
 * @returns Form state with errors or redirects to /todos on success
 */
export async function register(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const rawData = {
    tenantName: formData.get('tenantName'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const result = registerSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { tenantName, email, password } = result.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      errors: {
        email: ['An account with this email already exists'],
      },
    };
  }

  const passwordHash = await hashPassword(password);

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      users: {
        create: {
          email,
          passwordHash,
          role: 'ADMIN',
        },
      },
    },
    include: {
      users: true,
    },
  });

  const user = tenant.users[0];
  await createSession(user.id, tenant.id);

  redirect('/todos');
}
