import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getAllocationData,
  createDeliveryAssignments,
  updateAssignment,
  deleteAssignment,
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


