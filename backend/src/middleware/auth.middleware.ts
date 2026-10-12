import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../utils/auth/jwt.js';
import { sendError } from '../utils/response.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    sendError(res, 401, 'Authorization header is missing');
    return;
  }

  // Header must strictly be in format "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    sendError(res, 401, 'Authorization header format must be Bearer <token>');
    return;
  }

  const token = parts[1];
  if (!token) {
    sendError(res, 401, 'Token is missing');
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'Invalid or expired token');
  }
};
