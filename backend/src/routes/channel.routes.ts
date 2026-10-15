import { Router } from 'express';
import { getChannels, getChannelById } from '../controllers/channel.controller.js';

const router = Router();

// Public endpoint for browsing channel listings
router.get('/', getChannels);

// Public endpoint for retrieving a single channel by ID
router.get('/:id', getChannelById);

export default router;
