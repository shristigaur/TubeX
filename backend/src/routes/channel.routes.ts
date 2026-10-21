import { Router } from 'express';
import {
  getChannels,
  getChannelById,
  createListing,
  getSellerListings,
  getSellerListingById,
  updateListing,
  submitForReview,
  unpublishListing,
  deleteListing,
} from '../controllers/channel.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// ==========================================
// Authenticated Seller Routes (/mine)
// Must be registered BEFORE /:id to prevent Express from treating "mine" as a channel ID parameter
// ==========================================

// Create a draft listing
router.post('/mine', requireAuth, createListing);

// List the authenticated seller's listings
router.get('/mine', requireAuth, getSellerListings);

// Retrieve one listing owned by the authenticated seller
router.get('/mine/:id', requireAuth, getSellerListingById);

// Update an owned draft listing
router.patch('/mine/:id', requireAuth, updateListing);

// Submit an owned draft listing for admin review
router.post('/mine/:id/submit', requireAuth, submitForReview);

// Unpublish an eligible published listing
router.post('/mine/:id/unpublish', requireAuth, unpublishListing);

// Delete an eligible unpublished listing
router.delete('/mine/:id', requireAuth, deleteListing);

// ==========================================
// Public Marketplace Routes
// ==========================================

// Public endpoint for browsing channel listings
router.get('/', getChannels);

// Public endpoint for retrieving a single channel by ID
router.get('/:id', getChannelById);

export default router;

