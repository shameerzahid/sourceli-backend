import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getProduceCategories } from '../services/system.service.js';
import { wrapAsync } from '../middleware/errorHandler.js';

/**
 * Get all produce categories
 * GET /api/system/produce-categories
 * Public endpoint - no authentication required
 */
export const getProduceCategoriesHandler = wrapAsync(
  async (_req: AuthRequest, res: Response): Promise<void> => {
    const categories = await getProduceCategories();

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
    });
  }
);



