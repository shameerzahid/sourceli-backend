import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getProduceCategories, getDeliveryCoverageRegions } from '../services/system.service.js';
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

/**
 * Get delivery coverage regions (US-BUYER-005)
 * GET /api/system/delivery-coverage
 * Public - used by buyer delivery address form
 */
export const getDeliveryCoverageHandler = wrapAsync(
  async (_req: AuthRequest, res: Response): Promise<void> => {
    const regions = getDeliveryCoverageRegions();
    res.status(200).json({
      success: true,
      data: { regions },
    });
  }
);



