import type { Request, Response, NextFunction } from 'express';
import { signupSchema, loginSchema } from '../validators/auth.validator.js';
import { createUser } from '../services/auth.service.js';
import { signAccessToken } from '../utils/auth/jwt.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { prisma } from '../config/prisma.js';
import { verifyPassword } from '../utils/auth/password.js';

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, parseResult.error.issues[0]?.message || 'Validation failed');
      return;
    }

    const { name, email, password } = parseResult.data;

    try {
      // Create user
      const user = await createUser(name, email, password);

      // Create JWT
      const accessToken = signAccessToken({ sub: user.id, role: user.role });

      sendSuccess(res, 201, 'Account created successfully.', {
        user,
        accessToken,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_EMAIL') {
        sendError(res, 409, 'An account with this email already exists.');
        return;
      }
      throw error; // Let global error handler handle it
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, parseResult.error.issues[0]?.message || 'Validation failed');
      return;
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      sendError(res, 401, 'Invalid email or password.');
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      sendError(res, 401, 'Invalid email or password.');
      return;
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    sendSuccess(res, 200, 'Login successful.', {
      user: safeUser,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};
