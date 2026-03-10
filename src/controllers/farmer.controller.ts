import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  submitWeeklyAvailability,
  getAvailabilityHistory,
  getCurrentWeekAvailability,
  submitMonthlyAvailability,
  getMonthlyAvailabilityHistory,
  getCurrentMonthAvailability,
  updateWeeklyAvailability,
  deleteWeeklyAvailability,
  updateMonthlyAvailability,
  deleteMonthlyAvailability,
  getDeliveryAssignments,
  getAssignmentById,
  updateDeliveryAssignment,
  cancelDeliveryAssignment,
  submitDeliveryConfirmation,
} from '../services/farmer.service.js';
import {
  getPerformanceData,
  getPerformanceHistory,
  getRecentChanges,
  getPerformanceTrend,
  getTierThresholds,
  getScoreWeights,
  getPerformanceWarnings,
} from '../services/performance.service.js';
import {
  weeklyAvailabilitySchema,
  weeklyAvailabilityUpdateSchema,
  monthlyAvailabilitySchema,
  monthlyAvailabilityUpdateSchema,
  deliveryAssignmentUpdateSchema,
  deliveryConfirmationSchema,
} from '../validators/farmer.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { getWeekStartDate, formatWeekRange, isWithinSubmissionWindow } from '../utils/weekCalculation.js';
import {
  getMonthStartDate,
  formatMonthRange,
  isWithinMonthlySubmissionWindow,
} from '../utils/monthCalculation.js';
import { createAuditLog } from '../utils/auditLog.js';
import { prisma } from '../config/database.js';
import { getFarmerDashboard } from '../services/dashboard.service.js';
import {
  createSupportTicket,
  listSupportTicketsByBuyer,
  getSupportTicketByIdForBuyer,
} from '../services/supportTicket.service.js';
import { createSupportTicketSchema } from '../validators/supportTicket.validator.js';

/**
 * Get farmer dashboard stats (upcoming deliveries, score/tier, unread notifications)
 * GET /api/farmers/dashboard
 */
export const getFarmerDashboardHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const dashboard = await getFarmerDashboard(req.user.userId);
    if (!dashboard) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Farmer profile not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  }
);

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
 * Submit monthly availability
 * POST /api/farmers/availability/monthly
 */
export const submitMonthlyAvailabilityHandler = wrapAsync(
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

    const validatedData = monthlyAvailabilitySchema.parse(req.body);

    const availability = await submitMonthlyAvailability(farmer.id, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'MONTHLY_AVAILABILITY_SUBMITTED',
      entityType: 'MonthlyAvailability',
      entityId: availability.id,
      details: {
        productType: availability.productType,
        quantityAvailable: availability.quantityAvailable,
        monthStartDate: availability.monthStartDate,
        isLate: availability.isLate,
      },
      ipAddress: req.ip,
    });

    const monthStart = getMonthStartDate();
    const monthRange = formatMonthRange(monthStart);
    const inWindow = isWithinMonthlySubmissionWindow();

    res.status(201).json({
      success: true,
      message: availability.isLate
        ? 'Monthly availability submitted successfully (marked as late)'
        : 'Monthly availability submitted successfully',
      data: {
        ...availability,
        monthRange,
        inSubmissionWindow: inWindow,
      },
    });
  }
);

/**
 * Get monthly availability history
 * GET /api/farmers/availability/monthly
 */
export const getMonthlyAvailabilityHistoryHandler = wrapAsync(
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

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;

    const history = await getMonthlyAvailabilityHistory(farmer.id, limit);
    const currentMonth = await getCurrentMonthAvailability(farmer.id);
    const monthStart = getMonthStartDate();
    const monthRange = formatMonthRange(monthStart);
    const inWindow = isWithinMonthlySubmissionWindow();

    res.status(200).json({
      success: true,
      data: {
        history,
        currentMonth: {
          monthStartDate: monthStart,
          monthRange,
          inSubmissionWindow: inWindow,
          submissions: currentMonth,
        },
      },
    });
  }
);

/**
 * Update monthly availability by ID
 * PATCH /api/farmers/availability/monthly/:id
 */
export const updateMonthlyAvailabilityHandler = wrapAsync(
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

    const availabilityId = req.params.id as string;
    const validatedData = monthlyAvailabilityUpdateSchema.parse(req.body);

    const availability = await updateMonthlyAvailability(
      availabilityId,
      farmer.id,
      validatedData
    );

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'MONTHLY_AVAILABILITY_UPDATED',
      entityType: 'MonthlyAvailability',
      entityId: availability.id,
      details: {
        productType: availability.productType,
        quantityAvailable: availability.quantityAvailable,
        monthStartDate: availability.monthStartDate,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Monthly availability updated successfully',
      data: availability,
    });
  }
);

/**
 * Delete monthly availability by ID
 * DELETE /api/farmers/availability/monthly/:id
 */
export const deleteMonthlyAvailabilityHandler = wrapAsync(
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

    const availabilityId = req.params.id as string;
    const result = await deleteMonthlyAvailability(availabilityId, farmer.id);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'MONTHLY_AVAILABILITY_DELETED',
      entityType: 'MonthlyAvailability',
      entityId: availabilityId,
      details: { deleted: result.deleted },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Monthly availability deleted successfully',
      data: result,
    });
  }
);

/**
 * Update weekly availability by ID
 * PATCH /api/farmers/availability/:id
 */
export const updateAvailabilityHandler = wrapAsync(
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

    const availabilityId = req.params.id as string;
    const validatedData = weeklyAvailabilityUpdateSchema.parse(req.body);

    const availability = await updateWeeklyAvailability(
      availabilityId,
      farmer.id,
      validatedData
    );

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'AVAILABILITY_UPDATED',
      entityType: 'WeeklyAvailability',
      entityId: availability.id,
      details: {
        productType: availability.productType,
        quantityAvailable: availability.quantityAvailable,
        weekStartDate: availability.weekStartDate,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: availability,
    });
  }
);

/**
 * Delete weekly availability by ID
 * DELETE /api/farmers/availability/:id
 */
export const deleteAvailabilityHandler = wrapAsync(
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

    const availabilityId = req.params.id as string;
    const result = await deleteWeeklyAvailability(availabilityId, farmer.id);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'AVAILABILITY_DELETED',
      entityType: 'WeeklyAvailability',
      entityId: availabilityId,
      details: { deleted: result.deleted },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Availability deleted successfully',
      data: result,
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
 * Update delivery assignment (estimated time window)
 * PATCH /api/farmers/deliveries/:id
 */
export const updateDeliveryAssignmentHandler = wrapAsync(
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

    const assignmentId = req.params.id as string;
    const validatedData = deliveryAssignmentUpdateSchema.parse(req.body);

    const assignment = await updateDeliveryAssignment(
      assignmentId,
      farmer.id,
      validatedData
    );

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ASSIGNMENT_UPDATED',
      entityType: 'DeliveryAssignment',
      entityId: assignment.id,
      details: {
        estimatedTimeWindow: assignment.estimatedTimeWindow,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Delivery updated successfully',
      data: assignment,
    });
  }
);

/**
 * Cancel delivery assignment
 * DELETE /api/farmers/deliveries/:id
 */
export const cancelDeliveryAssignmentHandler = wrapAsync(
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

    const assignmentId = req.params.id as string;
    const assignment = await cancelDeliveryAssignment(assignmentId, farmer.id);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ASSIGNMENT_CANCELLED',
      entityType: 'DeliveryAssignment',
      entityId: assignment.id,
      details: { status: assignment.status },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Delivery cancelled successfully',
      data: assignment,
    });
  }
);

/**
 * Submit delivery confirmation (quantity delivered + notes)
 * PATCH /api/farmers/deliveries/:id/confirmation
 */
export const submitDeliveryConfirmationHandler = wrapAsync(
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

    const assignmentId = req.params.id as string;
    const validatedData = deliveryConfirmationSchema.parse(req.body);

    const assignment = await submitDeliveryConfirmation(
      assignmentId,
      farmer.id,
      validatedData
    );

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_CONFIRMATION_SUBMITTED',
      entityType: 'DeliveryAssignment',
      entityId: assignment.id,
      details: {
        quantityDelivered: assignment.quantityDelivered,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Confirmation submitted. Admin will confirm the delivery.',
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
    
    // Get tier thresholds and score weights for display (from active rules)
    const tierThresholds = await getTierThresholds();
    const scoreWeights = await getScoreWeights();

    // Get recent changes and warnings
    const [recentChanges, warnings] = await Promise.all([
      getRecentChanges(farmer.id, 10),
      getPerformanceWarnings(farmer.id),
    ]);

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
        warnings,
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

/**
 * Create support ticket (e.g. request review of a performance change)
 * POST /api/farmers/support-tickets
 */
export const createSupportTicketHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = createSupportTicketSchema.parse(req.body);
    const ticket = await createSupportTicket(req.user.userId, validatedData);

    res.status(201).json({
      success: true,
      message: 'Support ticket created.',
      data: ticket,
    });
  }
);

/**
 * List own support tickets
 * GET /api/farmers/support-tickets
 */
export const getSupportTicketsHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const tickets = await listSupportTicketsByBuyer(req.user.userId, {
      status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | undefined,
      limit,
    });

    res.status(200).json({
      success: true,
      data: tickets,
    });
  }
);

/**
 * Get support ticket by ID (own only)
 * GET /api/farmers/support-tickets/:id
 */
export const getSupportTicketByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const ticket = await getSupportTicketByIdForBuyer(id, req.user.userId);

    res.status(200).json({
      success: true,
      data: ticket,
    });
  }
);

