import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  recordPayment,
  getFarmerPayments,
  getPaymentReports,
  getOutstandingBalance,
} from '../services/payment.service.js';
import {
  recordPaymentSchema,
  paymentReportFiltersSchema,
} from '../validators/payment.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { prisma } from '../config/database.js';
import { createAuditLog } from '../utils/auditLog.js';

/**
 * Record offline payment
 * POST /api/admin/payments
 * Admin only
 */
export const recordPaymentHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = recordPaymentSchema.parse(req.body);
    const payment = await recordPayment(req.user.userId, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment.id,
      details: {
        farmerId: payment.farmerId,
        amountPaid: payment.amountPaid,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    });
  }
);

/**
 * Get payment reports
 * GET /api/admin/payments
 * Admin only
 */
export const getPaymentReportsHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const filters = paymentReportFiltersSchema.parse(req.query);
    const reports = await getPaymentReports(filters);

    res.status(200).json({
      success: true,
      data: reports,
    });
  }
);

/**
 * Get farmer payments (read-only)
 * GET /api/farmers/payments
 * Farmer only
 */
export const getFarmerPaymentsHandler = wrapAsync(
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

    const data = await getFarmerPayments(farmer.id);

    res.status(200).json({
      success: true,
      data,
    });
  }
);

/**
 * Get outstanding balance for a farmer
 * GET /api/farmers/payments/balance
 * Farmer only
 */
export const getOutstandingBalanceHandler = wrapAsync(
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

    const balance = await getOutstandingBalance(farmer.id);

    res.status(200).json({
      success: true,
      data: balance,
    });
  }
);



