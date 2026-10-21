import type { Request, Response, NextFunction } from 'express';
import {
  channelQuerySchema,
  channelIdParamSchema,
  createChannelSchema,
  updateChannelSchema,
  MONGODB_OBJECT_ID_REGEX,
} from '../validators/channel.validator.js';
import {
  getPublicChannels,
  getPublicChannelById,
  createChannelListing,
  getSellerChannels,
  getSellerChannelById,
  updateSellerChannel,
  submitChannelForReview,
  unpublishSellerChannel,
  deleteSellerChannel,
  ChannelValidationError,
  ChannelNotFoundError,
  ChannelForbiddenError,
} from '../services/channel.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Validates and extracts the authenticated seller ID from req.user.sub.
 * Rejects unauthenticated requests or malformed IDs with 401 Unauthorized.
 */
const getAuthenticatedSellerId = (req: Request, res: Response): string | null => {
  const sellerId = req.user?.sub;
  if (!sellerId || !MONGODB_OBJECT_ID_REGEX.test(sellerId)) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  return sellerId;
};

/**
 * Maps known service errors to appropriate HTTP responses,
 * delegating unexpected errors to Express centralized error handler.
 */
const handleServiceError = (res: Response, next: NextFunction, error: unknown): void => {
  if (error instanceof ChannelValidationError) {
    sendError(res, 400, error.message);
    return;
  }
  if (error instanceof ChannelNotFoundError) {
    sendError(res, 404, error.message);
    return;
  }
  if (error instanceof ChannelForbiddenError) {
    sendError(res, 403, error.message);
    return;
  }
  next(error);
};

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

/**
 * Controller to create a private draft channel listing for the authenticated seller.
 * POST /api/v1/channels/mine
 */
export const createListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const parseResult = createChannelSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const channel = await createChannelListing(sellerId, parseResult.data);
    sendSuccess(res, 201, 'Channel listing created successfully.', { channel });
  } catch (error) {
    handleServiceError(res, next, error);
  }
};

/**
 * Controller to list all channel listings owned by the authenticated seller.
 * GET /api/v1/channels/mine
 */
export const getSellerListings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const channels = await getSellerChannels(sellerId);
    sendSuccess(res, 200, 'Seller channels retrieved successfully.', { channels });
  } catch (error) {
    handleServiceError(res, next, error);
  }
};

/**
 * Controller to retrieve a single channel listing owned by the authenticated seller.
 * GET /api/v1/channels/mine/:id
 */
export const getSellerListingById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const paramResult = channelIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const channel = await getSellerChannelById(sellerId, paramResult.data.id);
    if (!channel) {
      sendError(res, 404, 'Channel not found');
      return;
    }

    sendSuccess(res, 200, 'Channel retrieved successfully.', { channel });
  } catch (error) {
    handleServiceError(res, next, error);
  }
};

/**
 * Controller to update an owned draft channel listing.
 * PATCH /api/v1/channels/mine/:id
 */
export const updateListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const paramResult = channelIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const bodyResult = updateChannelSchema.safeParse(req.body);
    if (!bodyResult.success) {
      const errorMessage = bodyResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const channel = await updateSellerChannel(sellerId, paramResult.data.id, bodyResult.data);
    sendSuccess(res, 200, 'Channel listing updated successfully.', { channel });
  } catch (error) {
    handleServiceError(res, next, error);
  }
};

/**
 * Controller to submit an owned draft channel listing for admin moderation review.
 * POST /api/v1/channels/mine/:id/submit
 */
export const submitForReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const paramResult = channelIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const channel = await submitChannelForReview(sellerId, paramResult.data.id);
    sendSuccess(res, 200, 'Channel submitted for review successfully.', { channel });
  } catch (error) {
    handleServiceError(res, next, error);
  }
};

/**
 * Controller to unpublish an owned published channel listing.
 * POST /api/v1/channels/mine/:id/unpublish
 */
export const unpublishListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const paramResult = channelIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const channel = await unpublishSellerChannel(sellerId, paramResult.data.id);
    sendSuccess(res, 200, 'Channel unpublished successfully.', { channel });
  } catch (error) {
    handleServiceError(res, next, error);
  }
};

/**
 * Controller to delete an owned unpublished channel listing.
 * DELETE /api/v1/channels/mine/:id
 */
export const deleteListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = getAuthenticatedSellerId(req, res);
    if (!sellerId) return;

    const paramResult = channelIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.issues[0]?.message || 'Validation failed';
      sendError(res, 400, errorMessage);
      return;
    }

    const result = await deleteSellerChannel(sellerId, paramResult.data.id);
    sendSuccess(res, 200, 'Channel listing deleted successfully.', result);
  } catch (error) {
    handleServiceError(res, next, error);
  }
};
