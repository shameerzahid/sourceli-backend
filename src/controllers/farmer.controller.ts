import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  submitWeeklyAvailability,
  getAvailabilityHistory,
  getCurrentWeekAvailability,
  getDeliveryAssignments,
  getAssignmentById,
} from '../services/farmer.service.js';
import {
  getPerformanceData,
  getPerformanceHistory,
  getRecentChanges,
  getPerformanceTrend,
  getTierThresholds,
  getScoreWeights,
} from '../services/performance.service.js';
import { weeklyAvailabilitySchema } from '../validators/farmer.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { getWeekStartDate, formatWeekRange, isWithinSubmissionWindow } from '../utils/weekCalculation.js';
import { createAuditLog } from '../utils/auditLog.js';
import { prisma } from '../config/database.js';

/**
 * Submit weekly availability
 * POST /api/farmers/availability
 */
export const submitAvailabilityHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Get farmer ID from user
    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    // Validate input
    const validatedData = weeklyAvailabilitySchema.parse(req.body);

    // Submit availability
    const availability = await submitWeeklyAvailability(
      farmer.id,
      validatedData
    );

    // Create audit log
    await createAuditLog({
      userId: req.user.userId,
      actionType: 'AVAILABILITY_SUBMITTED',
      entityType: 'WeeklyAvailability',
      entityId: availability.id,
      details: {
        productType: availability.productType,
        quantityAvailable: availability.quantityAvailable,
        weekStartDate: availability.weekStartDate,
        isLate: availability.isLate,
      },
      ipAddress: req.ip,
    });

    // Get current week info
    const weekStart = getWeekStartDate();
    const weekRange = formatWeekRange(weekStart);
    const inWindow = isWithinSubmissionWindow();

    res.status(201).json({
      success: true,
      message: availability.isLate
        ? 'Availability submitted successfully (marked as late)'
        : 'Availability submitted successfully',
      data: {
        ...availability,
        weekRange,
        inSubmissionWindow: inWindow,
      },
    });
  }
);

/**
 * Get availability history
 * GET /api/farmers/availability
 */
export const getAvailabilityHistoryHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Get farmer ID from user
    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    // Get limit from query params
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;

    // Get availability history
    const history = await getAvailabilityHistory(farmer.id, limit);

    // Get current week status
    const currentWeek = await getCurrentWeekAvailability(farmer.id);
    const weekStart = getWeekStartDate();
    const weekRange = formatWeekRange(weekStart);
    const inWindow = isWithinSubmissionWindow();

    res.status(200).json({
      success: true,
      data: {
        history,
        currentWeek: {
          weekStartDate: weekStart,
          weekRange,
          inSubmissionWindow: inWindow,
          submissions: currentWeek,
        },
      },
    });
  }
);

/**
 * Get delivery assignments
 * GET /api/farmers/deliveries
 */
export const getDeliveryAssignmentsHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    // Get filters from query params
    const status = req.query.status as string | undefined;
    const upcomingOnly = req.query.upcomingOnly === 'true';

    const assignments = await getDeliveryAssignments(farmer.id, {
      status,
      upcomingOnly,
    });

    // Separate pending and completed assignments
    const pending = assignments.filter((a) => a.status === 'PENDING');
    const completed = assignments.filter((a) => a.status !== 'PENDING');

    res.status(200).json({
      success: true,
      data: {
        assignments,
        summary: {
          total: assignments.length,
          pending: pending.length,
          completed: completed.length,
        },
      },
    });
  }
);

/**
 * Get a specific delivery assignment by ID
 * GET /api/farmers/deliveries/:id
 */
export const getAssignmentByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    const { id } = req.params;
    const assignment = await getAssignmentById(id, farmer.id);

    res.status(200).json({
      success: true,
      data: assignment,
    });
  }
);

/**
 * Get farmer performance data
 * GET /api/farmers/performance
 */
export const getPerformanceHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    // Get performance data
    const { performance, breakdown } = await getPerformanceData(farmer.id);
    
    // Get tier thresholds and score weights for display
    const tierThresholds = getTierThresholds();
    const scoreWeights = getScoreWeights();

    // Get recent changes
    const recentChanges = await getRecentChanges(farmer.id, 10);

    // Calculate next tier progress
    let nextTierProgress = null;
    if (performance) {
      const currentScore = performance.score;
      let nextTierThreshold: number | undefined;
      let nextTierName: string | undefined;

      if (currentScore < tierThresholds.STANDARD) {
        nextTierThreshold = tierThresholds.STANDARD;
        nextTierName = 'STANDARD';
      } else if (currentScore < tierThresholds.PREFERRED) {
        nextTierThreshold = tierThresholds.PREFERRED;
        nextTierName = 'PREFERRED';
      } else {
        // Already at highest tier
        nextTierProgress = {
          currentScore,
          nextTierThreshold: 100,
          pointsNeeded: 0,
          nextTierName: 'MAX',
        };
      }

      if (!nextTierProgress && nextTierThreshold !== undefined && nextTierName !== undefined) {
        nextTierProgress = {
          currentScore,
          nextTierThreshold,
          pointsNeeded: Math.max(0, nextTierThreshold - currentScore),
          nextTierName,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        performance: performance || null,
        breakdown: breakdown || null,
        tierThresholds,
        scoreWeights,
        recentChanges,
        nextTierProgress,
      },
    });
  }
);

/**
 * Get farmer performance history
 * GET /api/farmers/performance/history
 */
export const getPerformanceHistoryHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    // Get days from query params (default: 30)
    const days = req.query.days
      ? parseInt(req.query.days as string, 10)
      : 30;

    const history = await getPerformanceHistory(farmer.id, days);

    res.status(200).json({
      success: true,
      data: history,
    });
  }
);

/**
 * Get farmer performance trend data
 * GET /api/farmers/performance/trend
 */
export const getPerformanceTrendHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!farmer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    // Get days from query params (default: 30)
    const days = req.query.days
      ? parseInt(req.query.days as string, 10)
      : 30;

    const trend = await getPerformanceTrend(farmer.id, days);

    res.status(200).json({
      success: true,
      data: trend,
    });
  }
);

