import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
};
