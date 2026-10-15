import type { Request, Response, NextFunction } from 'express';
import { channelQuerySchema, channelIdParamSchema } from '../validators/channel.validator.js';
import {
  getPublicChannels,
  getPublicChannelById,
  ChannelValidationError,
} from '../services/channel.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Controller to handle public channel listing retrieval with filtering, sorting, and pagination.
 */
export const getChannels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Validate and coerce incoming query parameters
    const parseResult = channelQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    try {
      // 2. Delegate to service layer with validated & coerced query input
      const result = await getPublicChannels(parseResult.data);

      // 3. Return standard success envelope
      sendSuccess(res, 200, 'Channels retrieved successfully.', result);
    } catch (serviceError) {
      // 4. Handle known validation/conflict errors from service with HTTP 400
      if (serviceError instanceof ChannelValidationError) {
        sendError(res, 400, serviceError.message);
        return;
      }
      // 5. Delegate unexpected database/internal service errors to Express error middleware
      throw serviceError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle retrieving a single public channel by its MongoDB ID.
 */
export const getChannelById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Validate route parameter
    const parseResult = channelIdParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const { id } = parseResult.data;

    // 2. Delegate to service layer
    const channel = await getPublicChannelById(id);

    // 3. Return 404 if channel does not exist, is unpublished, or is not AVAILABLE
    if (!channel) {
      sendError(res, 404, 'Channel not found');
      return;
    }

    // 4. Return standard success envelope
    sendSuccess(res, 200, 'Channel retrieved successfully.', { channel });
  } catch (error) {
    next(error);
  }
};
