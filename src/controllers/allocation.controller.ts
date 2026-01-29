import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getAllocationData,
  createDeliveryAssignments,
  updateAssignment,
  deleteAssignment,
  confirmDelivery,
  getAllDeliveryAssignments,
  type ConfirmDeliveryData,
} from '../services/allocation.service.js';
import {
  createAllocationSchema,
  updateAssignmentSchema,
} from '../validators/allocation.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { createAuditLog } from '../utils/auditLog.js';

/**
 * Get allocation screen data
 * GET /api/admin/allocations
 */
export const getAllocationDataHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await getAllocationData();

    res.status(200).json({
      success: true,
      data,
    });
  }
);

/**
 * Create delivery assignments
 * POST /api/admin/allocations
 */
export const createAssignmentsHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = createAllocationSchema.parse(req.body);
    const result = await createDeliveryAssignments(
      validatedData.orderId,
      req.user.userId,
      validatedData
    );

    // Create audit log for each assignment
    for (const assignment of result.assignments) {
      await createAuditLog({
        userId: req.user.userId,
        actionType: 'DELIVERY_ASSIGNMENT_CREATED',
        entityType: 'DeliveryAssignment',
        entityId: assignment.id,
        details: {
          orderId: result.order.id,
          farmerId: assignment.farmerId,
          assignedQuantity: assignment.assignedQuantity,
          deliveryDate: assignment.deliveryDate,
        },
        ipAddress: req.ip,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Delivery assignments created successfully',
      data: result,
    });
  }
);

/**
 * Update an assignment
 * PUT /api/admin/allocations/:id
 */
export const updateAssignmentHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const validatedData = updateAssignmentSchema.parse(req.body);

    const updated = await updateAssignment(
      id,
      req.user.userId,
      validatedData.assignedQuantity
    );

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ASSIGNMENT_UPDATED',
      entityType: 'DeliveryAssignment',
      entityId: id,
      details: {
        orderId: updated.orderId,
        farmerId: updated.farmerId,
        newQuantity: updated.assignedQuantity,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: updated,
    });
  }
);

/**
 * Delete an assignment
 * DELETE /api/admin/allocations/:id
 */
export const deleteAssignmentHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    await deleteAssignment(id, req.user.userId);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ASSIGNMENT_DELETED',
      entityType: 'DeliveryAssignment',
      entityId: id,
      details: {},
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully',
    });
  }
);

/**
 * Get all delivery assignments (for admin deliveries page)
 * GET /api/admin/deliveries
 */
export const getAllDeliveryAssignmentsHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const status = req.query.status as string | undefined;
    const orderId = req.query.orderId as string | undefined;
    const farmerId = req.query.farmerId as string | undefined;

    const assignments = await getAllDeliveryAssignments({
      status: status as any,
      orderId,
      farmerId,
    });

    res.status(200).json({
      success: true,
      data: assignments,
    });
  }
);

/**
 * Confirm a delivery (US-ADMIN-008)
 * POST /api/admin/deliveries/:id/confirm
 */
export const confirmDeliveryHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const data: ConfirmDeliveryData = req.body;

    // Validate required fields
    if (typeof data.delivered !== 'boolean') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'delivered field is required and must be a boolean',
      });
      return;
    }

    if (data.delivered && data.quantityDelivered === undefined) {
      // If delivered is true, quantityDelivered defaults to assignedQuantity
      data.quantityDelivered = undefined; // Will be set in service
    }

    const updated = await confirmDelivery(id, req.user.userId, data);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_CONFIRMED',
      entityType: 'DeliveryAssignment',
      entityId: id,
      details: {
        orderId: updated.orderId,
        farmerId: updated.farmerId,
        delivered: data.delivered,
        quantityDelivered: updated.quantityDelivered,
        qualityResult: updated.qualityResult,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed successfully',
      data: updated,
    });
  }
);


