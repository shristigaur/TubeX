import rateLimit from 'express-rate-limit';
import { sendError } from '../../utils/response.js';
import { config } from '../../config/env.js';
import type { Request, Response } from 'express';

const isDev = config.env === 'development';
const windowMs = isDev ? 1 * 60 * 1000 : 15 * 60 * 1000;
const limit = isDev ? 10 : 100;

export const globalRateLimiter = rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7', // Draft-7 standard headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    sendError(res, 429, 'Too many requests from this IP, please try again later.');
  },
});
