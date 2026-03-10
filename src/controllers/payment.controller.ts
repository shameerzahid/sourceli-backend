import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  recordPayment,
  getFarmerPayments,
  getPaymentReports,
  getOutstandingBalance,
  getPaymentById,
  updatePayment,
  deletePayment,
  confirmPaymentReceiptByFarmer,
} from '../services/payment.service.js';
import {
  getFarmerBuyerPayments,
  confirmBuyerPaymentReceiptByFarmer,
} from '../services/buyerOrderPayment.service.js';
import {
  recordPaymentSchema,
  paymentReportFiltersSchema,
  updatePaymentSchema,
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
    const raw = req.query as Record<string, string | undefined>;
    const filters = paymentReportFiltersSchema.parse({
      ...raw,
      paymentStatus: raw.paymentStatus ?? raw.status,
    });
    const reports = await getPaymentReports(filters);

    res.status(200).json({
      success: true,
      data: reports,
    });
  }
);

/**
 * Get a single payment by ID
 * GET /api/admin/payments/:id
 */
export const getPaymentByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }
    const { id } = req.params;
    const payment = await getPaymentById(id);
    res.status(200).json({
      success: true,
      data: payment,
    });
  }
);

/**
 * Update a payment
 * PATCH /api/admin/payments/:id
 */
export const updatePaymentHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }
    const { id } = req.params;
    const validatedData = updatePaymentSchema.parse(req.body);
    const payment = await updatePayment(id, req.user.userId, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'PAYMENT_UPDATED',
      entityType: 'Payment',
      entityId: id,
      details: {
        farmerId: payment.farmerId,
        amountPaid: payment.amountPaid,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: payment,
    });
  }
);

/**
 * Delete a payment
 * DELETE /api/admin/payments/:id
 */
export const deletePaymentHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }
    const { id } = req.params;
    const result = await deletePayment(id);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'PAYMENT_DELETED',
      entityType: 'Payment',
      entityId: id,
      details: { paymentId: result.paymentId },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Payment deleted successfully',
      data: result,
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

/**
 * Farmer confirms receipt of a payment (safe: only sets timestamp)
 * POST /api/farmers/payments/:id/confirm-receipt
 * Farmer only; payment must belong to this farmer
 */
export const confirmPaymentReceiptHandler = wrapAsync(
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
    const payment = await confirmPaymentReceiptByFarmer(id, farmer.id);

    res.status(200).json({
      success: true,
      message: payment.supplierConfirmedAt ? 'Receipt confirmed.' : 'Already confirmed.',
      data: payment,
    });
  }
);

/**
 * Get payments from buyers to this farmer (buyer paid supplier)
 * GET /api/farmers/buyer-payments
 */
export const getFarmerBuyerPaymentsHandler = wrapAsync(
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

    const payments = await getFarmerBuyerPayments(farmer.id);

    res.status(200).json({
      success: true,
      data: payments,
    });
  }
);

/**
 * Farmer confirms receipt of a buyer payment
 * POST /api/farmers/buyer-payments/:id/confirm-receipt
 */
export const confirmBuyerPaymentReceiptHandler = wrapAsync(
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
    const payment = await confirmBuyerPaymentReceiptByFarmer(id, farmer.id);

    await createAuditLog({
        userId: req.user.userId,
        actionType: 'BUYER_ORDER_PAYMENT_SUPPLIER_CONFIRMED',
        entityType: 'Order',
        entityId: payment.orderId,
        details: {
          buyerOrderPaymentId: payment.id,
          farmerId: farmer.id,
        },
        ipAddress: req.ip,
      });

    res.status(200).json({
      success: true,
      message: payment.supplierConfirmedAt ? 'Receipt confirmed.' : 'Already confirmed.',
      data: payment,
    });
  }
);
