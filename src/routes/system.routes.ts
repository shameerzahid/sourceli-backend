import { Router } from 'express';
import { getProduceCategoriesHandler } from '../controllers/system.controller.js';

const router = Router();

/**
 * System routes - Public endpoints
 * These endpoints don't require authentication
 */

// Get produce categories (public - needed for registration and order forms)
router.get('/produce-categories', getProduceCategoriesHandler);

export default router;


