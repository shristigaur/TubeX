import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/auth/password.js';
import { Prisma } from '@prisma/client';

export const createUser = async (name: string, email: string, passwordPlain: string) => {
  // Pre-check for duplicate email
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('DUPLICATE_EMAIL');
  }

  // Hash password
  const passwordHash = await hashPassword(passwordPlain);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'USER', // Enforced server-side
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // specifically NOT selecting passwordHash or googleId
      },
    });

    return user;
  } catch (error) {
    // Handle concurrent duplicate constraint securely
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = error.meta?.target as string | string[] | undefined;
        if (
          target === 'email' || 
          target === 'User_email_key' || 
          (Array.isArray(target) && target.includes('email')) ||
          (typeof target === 'string' && target.includes('email'))
        ) {
          throw new Error('DUPLICATE_EMAIL');
        }
      }
    }
    throw error;
  }
};
