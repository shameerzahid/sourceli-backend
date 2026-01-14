import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getPendingFarmerApplications,
  getFarmerApplicationById,
  approveFarmerApplication,
  rejectFarmerApplication,
  getPendingBuyerRegistrations,
  getBuyerRegistrationById,
  approveBuyerRegistration,
  rejectBuyerRegistration,
  getAllFarmers,
  getAllBuyers,
  updateFarmerStatus,
  updateBuyerStatus,
  getAdminStats,
} from '../services/admin.service.js';
import {
  approveFarmerSchema,
  rejectFarmerSchema,
  approveBuyerSchema,
  rejectBuyerSchema,
  updateFarmerStatusSchema,
  updateBuyerStatusSchema,
  listFarmersQuerySchema,
  listBuyersQuerySchema,
} from '../validators/admin.validator.js';
import { createAuditLog } from '../utils/auditLog.js';
import { wrapAsync } from '../middleware/errorHandler.js';

/**
 * Get all pending farmer applications
 */
export const getPendingFarmerApplicationsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const applications = await getPendingFarmerApplications();

    res.json({
      success: true,
      data: applications,
      count: applications.length,
    });
  }
);

/**
 * Get a specific farmer application by ID
 */
export const getFarmerApplicationByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const application = await getFarmerApplicationById(id);

    res.json({
      success: true,
      data: application,
    });
  }
);

/**
 * Approve a farmer application
 */
export const approveFarmerApplicationHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Validate request body
    const validatedData = approveFarmerSchema.parse(req.body);

    // Approve the application
    const application = await approveFarmerApplication(
      id,
      adminId,
      validatedData
    );

    // Create audit log
    await createAuditLog({
      userId: adminId,
      actionType: 'FARMER_APPLICATION_APPROVED',
      entityType: 'FarmerApplication',
      entityId: id,
      details: {
        farmerId: application.farmerId,
        adminNotes: validatedData.adminNotes,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Farmer application approved successfully',
      data: application,
    });
  }
);

/**
 * Reject a farmer application
 */
export const rejectFarmerApplicationHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Validate request body
    const validatedData = rejectFarmerSchema.parse(req.body);

    // Reject the application
    const application = await rejectFarmerApplication(
      id,
      adminId,
      validatedData
    );

    // Create audit log
    await createAuditLog({
      userId: adminId,
      actionType: 'FARMER_APPLICATION_REJECTED',
      entityType: 'FarmerApplication',
      entityId: id,
      details: {
        farmerId: application.farmerId,
        rejectionReason: validatedData.rejectionReason,
        adminNotes: validatedData.adminNotes,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Farmer application rejected',
      data: application,
    });
  }
);

/**
 * Get all pending buyer registrations
 */
export const getPendingBuyerRegistrationsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const registrations = await getPendingBuyerRegistrations();

    res.json({
      success: true,
      data: registrations,
      count: registrations.length,
    });
  }
);

/**
 * Get a specific buyer registration by ID
 */
export const getBuyerRegistrationByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const registration = await getBuyerRegistrationById(id);

    res.json({
      success: true,
      data: registration,
    });
  }
);

/**
 * Approve a buyer registration
 */
export const approveBuyerRegistrationHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Validate request body
    const validatedData = approveBuyerSchema.parse(req.body);

    // Approve the registration
    const registration = await approveBuyerRegistration(
      id,
      adminId,
      validatedData
    );

    // Create audit log
    await createAuditLog({
      userId: adminId,
      actionType: 'BUYER_REGISTRATION_APPROVED',
      entityType: 'BuyerRegistration',
      entityId: id,
      details: {
        buyerId: registration.buyerId,
        adminNotes: validatedData.adminNotes,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Buyer registration approved successfully',
      data: registration,
    });
  }
);

/**
 * Reject a buyer registration
 */
export const rejectBuyerRegistrationHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Validate request body
    const validatedData = rejectBuyerSchema.parse(req.body);

    // Reject the registration
    const registration = await rejectBuyerRegistration(
      id,
      adminId,
      validatedData
    );

    // Create audit log
    await createAuditLog({
      userId: adminId,
      actionType: 'BUYER_REGISTRATION_REJECTED',
      entityType: 'BuyerRegistration',
      entityId: id,
      details: {
        buyerId: registration.buyerId,
        rejectionReason: validatedData.rejectionReason,
        adminNotes: validatedData.adminNotes,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Buyer registration rejected',
      data: registration,
    });
  }
);

/**
 * Get all farmers
 */
export const getAllFarmersHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    // Validate query parameters
    const filters = listFarmersQuerySchema.parse(req.query);

    const farmers = await getAllFarmers(filters);

    res.json({
      success: true,
      data: farmers,
      count: farmers.length,
    });
  }
);

/**
 * Get all buyers
 */
export const getAllBuyersHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    // Validate query parameters
    const filters = listBuyersQuerySchema.parse(req.query);

    const buyers = await getAllBuyers(filters);

    res.json({
      success: true,
      data: buyers,
      count: buyers.length,
    });
  }
);

/**
 * Update farmer status
 */
export const updateFarmerStatusHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Validate request body
    const validatedData = updateFarmerStatusSchema.parse(req.body);

    // Update status
    const updatedUser = await updateFarmerStatus(
      id,
      validatedData.status,
      adminId
    );

    // Create audit log
    await createAuditLog({
      userId: adminId,
      actionType: 'FARMER_STATUS_UPDATED',
      entityType: 'Farmer',
      entityId: id,
      details: {
        newStatus: validatedData.status,
        userId: updatedUser.id,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Farmer status updated successfully',
      data: updatedUser,
    });
  }
);

/**
 * Update buyer status
 */
export const updateBuyerStatusHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Validate request body
    const validatedData = updateBuyerStatusSchema.parse(req.body);

    // Update status
    const updatedUser = await updateBuyerStatus(
      id,
      validatedData.status,
      adminId
    );

    // Create audit log
    await createAuditLog({
      userId: adminId,
      actionType: 'BUYER_STATUS_UPDATED',
      entityType: 'Buyer',
      entityId: id,
      details: {
        newStatus: validatedData.status,
        userId: updatedUser.id,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Buyer status updated successfully',
      data: updatedUser,
    });
  }
);

/**
 * Get admin dashboard statistics
 */
export const getAdminStatsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    try {
      console.log("getAdminStatsHandler called");
      const stats = await getAdminStats();
      console.log("getAdminStats completed, sending response");

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error in getAdminStatsHandler:", error);
      throw error;
    }
  }
);

