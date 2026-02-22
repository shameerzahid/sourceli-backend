import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getProduceCategoriesHandler, getDeliveryCoverageHandler } from '../controllers/system.controller.js';
import { markReadHandler, markAllReadHandler, pusherAuthHandler } from '../controllers/notification.controller.js';

const router = Router();

/**
 * System routes - Mix of public and authenticated
 */

// Get produce categories (public - needed for registration and order forms)
router.get('/produce-categories', getProduceCategoriesHandler);

// Get delivery coverage regions (public - US-BUYER-005)
router.get('/delivery-coverage', getDeliveryCoverageHandler);

/**
 * Notifications - require authentication (any role)
 */
router.post('/notifications/mark-read', authenticate, markReadHandler);
router.post('/notifications/mark-all-read', authenticate, markAllReadHandler);

/**
 * Pusher private channel auth (for real-time notification subscription)
 */
router.post('/pusher-auth', authenticate, pusherAuthHandler);

export default router;







