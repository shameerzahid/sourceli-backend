import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getPendingFarmerApplications,
  getFarmerApplicationById,
  approveFarmerApplication,
  rejectFarmerApplication,
  createSupplierAsAdmin,
  getPendingBuyerRegistrations,
  getBuyerRegistrationById,
  approveBuyerRegistration,
  rejectBuyerRegistration,
  createBuyerAsAdmin,
  getAllFarmers,
  getFarmerById,
  getAllBuyers,
  getBuyerById,
  updateFarmer,
  updateBuyer,
  updateFarmerStatus,
  updateBuyerStatus,
  getAdminStats,
  getPricingBands,
  updatePricingBand,
} from '../services/admin.service.js';
import {
  getPendingOrders,
  getOrderByIdForAdmin,
  getOrdersByBuyerIdForAdmin,
  approveOrder,
  rejectOrder,
  requestOrderModification,
  createOrderByAdmin,
  updateOrderByAdmin,
  deleteOrderByAdmin,
} from '../services/order.service.js';
import {
  approveFarmerSchema,
  rejectFarmerSchema,
  approveBuyerSchema,
  rejectBuyerSchema,
  updateFarmerStatusSchema,
  updateBuyerStatusSchema,
  updateFarmerSchema,
  updateBuyerSchema,
  listFarmersQuerySchema,
  listBuyersQuerySchema,
  updatePerformanceRulesSchema,
  overridePerformanceSchema,
  updatePricingBandSchema,
  createProduceCategorySchema,
  requestOrderModificationSchema,
  createOrderByAdminSchema,
  updateOrderByAdminSchema,
} from '../validators/admin.validator.js';
import { buyerRegistrationSchema } from '../validators/auth.validator.js';
import { createSupplierSchema } from '../validators/admin.validator.js';
import {
  getPerformanceRulesRecord,
  getActivePerformanceRules,
  updatePerformanceRules,
  type PerformanceRulesData,
} from '../services/performanceRules.service.js';
import { overridePerformanceScore, getPerformanceData, getPerformanceHistory } from '../services/performance.service.js';
import {
  listAllSupportTickets,
  getSupportTicketByIdForAdmin,
  respondToSupportTicket,
  updateSupportTicket,
  createSupportTicketByAdmin,
} from '../services/supportTicket.service.js';
import {
  respondToSupportTicketSchema,
  updateSupportTicketSchema,
  createSupportTicketByAdminSchema,
} from '../validators/supportTicket.validator.js';
import { createAuditLog, getAuditLogs, getAuditLogsCount, getAuditLogById, updateAuditLog, createAuditLogEntry } from '../utils/auditLog.js';
import { notifyUser } from '../services/notificationDelivery.service.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { createProduceCategory } from '../services/system.service.js';
import {
  getAdminBuyerOrderPayments,
  confirmBuyerOrderPaymentByAdmin,
} from '../services/buyerOrderPayment.service.js';

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
 * Create a supplier (farmer) manually (admin only). Same payload as farmer registration; user is created as PROBATIONARY (approved).
 */
export const createSupplierHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = createSupplierSchema.parse(req.body);

    const createData = {
      email: validatedData.email.toLowerCase().trim(),
      phone: validatedData.phone.trim(),
      password: validatedData.password,
      fullName: validatedData.fullName.trim(),
      farmName: validatedData.farmName?.trim(),
      region: validatedData.region.trim(),
      town: validatedData.town.trim(),
      weeklyCapacityMin: validatedData.weeklyCapacityMin,
      weeklyCapacityMax: validatedData.weeklyCapacityMax,
      produceCategory: validatedData.produceCategory.trim(),
      feedingMethod: validatedData.feedingMethod.trim(),
      termsAccepted: validatedData.termsAccepted ?? true,
      photoUrls: validatedData.photoUrls,
      certificateUrls: validatedData.certificateUrls,
      avatarUrl: validatedData.avatarUrl?.trim(),
    };

    const result = await createSupplierAsAdmin(adminId, createData);

    res.status(201).json({
      success: true,
      message: 'Supplier added successfully.',
      data: {
        userId: result.userId,
        farmerId: result.farmerId,
        applicationId: result.applicationId,
      },
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
 * Create a buyer manually (admin only). Same payload as buyer registration; user is created as ACTIVE.
 */
export const createBuyerHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = buyerRegistrationSchema.parse(req.body);

    const createData = {
      email: validatedData.email.toLowerCase().trim(),
      phone: validatedData.phone.trim(),
      password: validatedData.password,
      fullName: validatedData.fullName.trim(),
      businessName: validatedData.businessName?.trim(),
      buyerType: validatedData.buyerType,
      contactPerson: validatedData.contactPerson.trim(),
      estimatedVolume: validatedData.estimatedVolume,
      orderFrequency: validatedData.orderFrequency,
      companyRegistrationUrls: validatedData.companyRegistrationUrls,
      supportingDocUrls: validatedData.supportingDocUrls,
      deliveryAddresses: validatedData.deliveryAddresses.map((addr) => ({
        address: addr.address.trim(),
        landmark: addr.landmark?.trim(),
        region: addr.region?.trim(),
        isDefault: addr.isDefault,
      })),
      avatarUrl: validatedData.avatarUrl?.trim(),
    };

    const result = await createBuyerAsAdmin(adminId, createData);

    res.status(201).json({
      success: true,
      message: 'Buyer added successfully.',
      data: {
        userId: result.userId,
        buyerId: result.buyerId,
        registrationId: result.registrationId,
      },
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
 * Get single farmer by ID
 */
export const getFarmerByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const farmer = await getFarmerById(id);
    res.json({
      success: true,
      data: farmer,
    });
  }
);

/**
 * Update farmer (admin edit any field)
 */
export const updateFarmerHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateFarmerSchema.parse(req.body);
    const farmer = await updateFarmer(id, validatedData);
    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: farmer,
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
 * Get single buyer by ID
 */
export const getBuyerByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const buyer = await getBuyerById(id);
    res.json({
      success: true,
      data: buyer,
    });
  }
);

/**
 * Get all orders for a buyer (admin)
 */
export const getBuyerOrdersHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id: buyerId } = req.params;
    const orders = await getOrdersByBuyerIdForAdmin(buyerId);
    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  }
);

/**
 * Update buyer (admin edit any field)
 */
export const updateBuyerHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateBuyerSchema.parse(req.body);
    const buyer = await updateBuyer(id, validatedData);
    res.json({
      success: true,
      message: 'Buyer updated successfully',
      data: buyer,
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

/**
 * Get all pending orders
 */
export const getPendingOrdersHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const orders = await getPendingOrders();

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  }
);

/**
 * Get a single order by ID (admin, any status)
 */
export const getOrderByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const order = await getOrderByIdForAdmin(id);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }
    res.json({
      success: true,
      data: order,
    });
  }
);

/**
 * Approve an order
 */
export const approveOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    const adminNotes = req.body.adminNotes;

    const order = await approveOrder(id, adminId, adminNotes);

    await createAuditLog({
      userId: adminId,
      actionType: 'ORDER_APPROVED',
      entityType: 'Order',
      entityId: id,
      details: {
        orderId: id,
        buyerId: order.buyerId,
        adminNotes,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Order approved successfully',
      data: order,
    });
  }
);

/**
 * Reject an order
 */
export const rejectOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    const { rejectionReason } = req.body;

    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Rejection reason is required',
      });
      return;
    }

    const order = await rejectOrder(id, adminId, rejectionReason);

    await createAuditLog({
      userId: adminId,
      actionType: 'ORDER_REJECTED',
      entityType: 'Order',
      entityId: id,
      details: {
        orderId: id,
        buyerId: order.buyerId,
        rejectionReason,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Order rejected',
      data: order,
    });
  }
);

/**
 * Request order modification (US-ADMIN-010). Sets order to PENDING_MODIFICATION and notifies buyer.
 */
export const requestOrderModificationHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    const validatedData = requestOrderModificationSchema.parse(req.body);

    const order = await requestOrderModification(
      id,
      adminId,
      validatedData.messageToBuyer
    );

    await createAuditLog({
      userId: adminId,
      actionType: 'ORDER_MODIFICATION_REQUESTED',
      entityType: 'Order',
      entityId: id,
      details: {
        orderId: id,
        buyerId: order.buyerId,
        messageToBuyer: validatedData.messageToBuyer,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Modification requested; buyer has been notified.',
      data: order,
    });
  }
);

/**
 * Create an order on behalf of a buyer (admin only)
 * POST /api/admin/orders
 */
export const createOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = createOrderByAdminSchema.parse(req.body);

    const order = await createOrderByAdmin(adminId, {
      buyerId: validatedData.buyerId,
      productType: validatedData.productType,
      quantity: validatedData.quantity,
      orderType: validatedData.orderType as 'ONE_TIME' | 'STANDING',
      deliveryDate: validatedData.deliveryDate,
      deliveryAddressId: validatedData.deliveryAddressId,
      notes: validatedData.notes,
    });

    await createAuditLog({
      userId: adminId,
      actionType: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      details: {
        orderId: order.id,
        buyerId: order.buyerId,
        productType: order.productType,
        quantity: order.quantity,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  }
);

/**
 * Update an order (admin only). Only PENDING or PENDING_MODIFICATION.
 * PATCH /api/admin/orders/:id
 */
export const updateOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;
    const body = req.body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};
    if (body.productType !== undefined) updateData.productType = body.productType;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.deliveryDate !== undefined) updateData.deliveryDate = body.deliveryDate;
    if (body.deliveryAddressId !== undefined) updateData.deliveryAddressId = body.deliveryAddressId;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const validatedData = updateOrderByAdminSchema.parse(updateData);

    const order = await updateOrderByAdmin(id, adminId, {
      productType: validatedData.productType,
      quantity: validatedData.quantity,
      deliveryDate: validatedData.deliveryDate,
      deliveryAddressId: validatedData.deliveryAddressId,
      notes: validatedData.notes ?? undefined,
    });

    await createAuditLog({
      userId: adminId,
      actionType: 'ORDER_UPDATED',
      entityType: 'Order',
      entityId: id,
      details: {
        orderId: id,
        buyerId: order.buyerId,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: order,
    });
  }
);

/**
 * Delete an order (admin only). Only PENDING or PENDING_MODIFICATION.
 * DELETE /api/admin/orders/:id
 */
export const deleteOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    const result = await deleteOrderByAdmin(id, adminId);

    await createAuditLog({
      userId: adminId,
      actionType: 'ORDER_DELETED',
      entityType: 'Order',
      entityId: id,
      details: {
        ...result,
        orderId: id,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Order deleted successfully',
      data: result,
    });
  }
);

/**
 * Get all buyer-to-supplier payments (buyer recorded; admin/supplier can confirm)
 * GET /api/admin/buyer-order-payments?orderId=...&farmerId=...
 */
export const getBuyerOrderPaymentsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const orderId = req.query.orderId as string | undefined;
    const farmerId = req.query.farmerId as string | undefined;

    const payments = await getAdminBuyerOrderPayments(
      orderId || farmerId ? { orderId, farmerId } : undefined
    );

    res.json({
      success: true,
      data: payments,
    });
  }
);

/**
 * Admin confirms a buyer payment to supplier
 * POST /api/admin/buyer-order-payments/:id/confirm
 */
export const confirmBuyerOrderPaymentHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { id } = req.params;

    const payment = await confirmBuyerOrderPaymentByAdmin(id, adminId);

    await createAuditLog({
      userId: adminId,
      actionType: 'BUYER_ORDER_PAYMENT_ADMIN_CONFIRMED',
      entityType: 'Order',
      entityId: payment.orderId,
      details: {
        buyerOrderPaymentId: payment.id,
        farmerId: payment.farmerId,
        deliveryAssignmentId: payment.deliveryAssignmentId,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Payment confirmed.',
      data: payment,
    });
  }
);

// --- Performance rules (US-ADMIN-006) ---

/**
 * Get current performance rules (admin)
 * GET /api/admin/performance-rules
 */
export const getPerformanceRulesHandler = wrapAsync(
  async (_req: AuthRequest, res: Response) => {
    const record = await getPerformanceRulesRecord();
    const active = await getActivePerformanceRules();
    res.json({
      success: true,
      data: record
        ? {
            id: record.id,
            tierThresholds: record.tierThresholds,
            scoreWeights: record.scoreWeights,
            penalties: record.penalties,
            warningTriggers: record.warningTriggers,
            effectiveFrom: record.effectiveFrom,
            updatedBy: record.updatedBy,
            updatedAt: record.updatedAt,
          }
        : null,
      activeRules: active,
    });
  }
);

/**
 * Update performance rules (admin). Creates new rule row (history preserved).
 * PUT /api/admin/performance-rules
 */
export const updatePerformanceRulesHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = updatePerformanceRulesSchema.parse(req.body);
    const rule = await updatePerformanceRules(adminId, validatedData as PerformanceRulesData);

    await createAuditLog({
      userId: adminId,
      actionType: 'PERFORMANCE_RULES_UPDATED',
      entityType: 'PerformanceRule',
      entityId: rule.id,
      details: {},
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Performance rules updated. Changes apply to future calculations.',
      data: {
        id: rule.id,
        tierThresholds: rule.tierThresholds,
        scoreWeights: rule.scoreWeights,
        penalties: rule.penalties,
        warningTriggers: rule.warningTriggers,
        effectiveFrom: rule.effectiveFrom,
      },
    });
  }
);

/**
 * Get performance data for a farmer (admin review)
 * GET /api/admin/performance/:farmerId
 */
export const getPerformanceByFarmerIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { farmerId } = req.params;
    const { performance, breakdown } = await getPerformanceData(farmerId);
    const history = await getPerformanceHistory(farmerId, 90);
    res.json({
      success: true,
      data: { performance, breakdown, history },
    });
  }
);

/**
 * Admin override farmer performance score/tier (US-ADMIN-009)
 * POST /api/admin/performance/override
 */
export const overridePerformanceHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = overridePerformanceSchema.parse(req.body);
    const { farmerId } = validatedData;

    await overridePerformanceScore(farmerId, adminId, {
      score: validatedData.score,
      tier: validatedData.tier,
      reason: validatedData.reason,
    });

    await createAuditLog({
      userId: adminId,
      actionType: 'PERFORMANCE_OVERRIDE',
      entityType: 'FarmerPerformance',
      entityId: farmerId,
      details: {
        score: validatedData.score,
        tier: validatedData.tier,
        reason: validatedData.reason,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Performance override applied.',
    });
  }
);

// --- Pricing bands (US-ADMIN-005) ---

/**
 * Get all pricing bands (produce categories with min/max price)
 * GET /api/admin/pricing-bands
 */
export const getPricingBandsHandler = wrapAsync(
  async (_req: AuthRequest, res: Response) => {
    const bands = await getPricingBands();
    res.json({
      success: true,
      data: bands,
      count: bands.length,
    });
  }
);

/**
 * Update pricing band for a category
 * PUT /api/admin/pricing-bands
 */
export const updatePricingBandHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = updatePricingBandSchema.parse(req.body);

    const category = await updatePricingBand(validatedData.categoryId, {
      minPrice: validatedData.minPrice,
      maxPrice: validatedData.maxPrice,
    });

    await createAuditLog({
      userId: adminId,
      actionType: 'PRICING_BAND_UPDATED',
      entityType: 'ProduceCategory',
      entityId: category.id,
      details: {
        categoryName: category.name,
        minPrice: category.minPrice,
        maxPrice: category.maxPrice,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Pricing band updated',
      data: category,
    });
  }
);

/**
 * Create a produce category (admin)
 * POST /api/admin/produce-categories
 */
export const createProduceCategoryHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = createProduceCategorySchema.parse(req.body);

    const category = await createProduceCategory({
      name: validatedData.name,
      unitType: validatedData.unitType,
    });

    await createAuditLog({
      userId: adminId,
      actionType: 'PRODUCE_CATEGORY_CREATED',
      entityType: 'ProduceCategory',
      entityId: category.id,
      details: { name: category.name, unitType: category.unitType },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Produce category added.',
      data: category,
    });
  }
);

// --- Audit logs (reportable) ---

/**
 * Get audit logs with filters. Query: startDate, endDate, userId, actionType, entityType, limit, offset
 * GET /api/admin/audit-logs
 * Optional: ?format=csv returns CSV for export
 */
export const getAuditLogsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const userId = req.query.userId as string | undefined;
    const actionType = req.query.actionType as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const limit = req.query.limit ? Math.min(500, Math.max(1, Number(req.query.limit))) : 100;
    const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : 0;
    const format = (req.query.format as string)?.toLowerCase();

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId: userId || undefined,
      actionType: actionType || undefined,
      entityType: entityType || undefined,
      limit: format === 'csv' ? 5000 : limit,
      offset: format === 'csv' ? 0 : offset,
    };

    const [logs, total] = await Promise.all([
      getAuditLogs(filters),
      getAuditLogsCount(filters),
    ]);

    if (format === 'csv') {
      const header = 'Timestamp,User Email,Role,Action Type,Entity Type,Entity ID,Details\n';
      const rows = logs.map((log: any) => {
        const email = log.user?.email ?? '';
        const role = log.user?.role ?? '';
        const details = typeof log.details === 'object' ? JSON.stringify(log.details).replace(/"/g, '""') : String(log.details ?? '');
        return `${log.timestamp},${email},${role},${log.actionType},${log.entityType},${log.entityId ?? ''},"${details}"`;
      });
      const csv = header + rows.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
      return;
    }

    res.json({
      success: true,
      data: logs,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });
  }
);

/**
 * Get single audit log by ID. GET /api/admin/audit-logs/:id
 */
export const getAuditLogByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const log = await getAuditLogById(id);
    if (!log) {
      res.status(404).json({ success: false, message: 'Audit log not found' });
      return;
    }
    res.json({
      success: true,
      data: {
        ...log,
        timestamp: log.timestamp.toISOString(),
      },
    });
  }
);

/**
 * Update audit log details (admin correction). PATCH /api/admin/audit-logs/:id
 * Body: { details: Record<string, unknown> }
 */
export const updateAuditLogHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { details } = req.body as { details?: Record<string, unknown> };
    if (!details || typeof details !== 'object') {
      res.status(400).json({ success: false, message: 'details object required' });
      return;
    }
    const log = await updateAuditLog(id, { details });
    res.json({
      success: true,
      data: {
        ...log,
        timestamp: log.timestamp.toISOString(),
      },
    });
  }
);

/**
 * Create audit log entry manually (admin). POST /api/admin/audit-logs
 * Body: { actionType, entityType, entityId?, details }
 */
export const createAuditLogManualHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.userId;
    const { actionType, entityType, entityId, details } = req.body as {
      actionType?: string;
      entityType?: string;
      entityId?: string;
      details?: Record<string, unknown>;
    };
    if (!actionType || !entityType) {
      res.status(400).json({ success: false, message: 'actionType and entityType required' });
      return;
    }
    if (!details || typeof details !== 'object') {
      res.status(400).json({ success: false, message: 'details object required' });
      return;
    }
    const log = await createAuditLogEntry({
      userId: adminId || undefined,
      actionType,
      entityType,
      entityId: entityId || undefined,
      details,
    });
    res.status(201).json({
      success: true,
      data: {
        ...log,
        timestamp: log.timestamp.toISOString(),
      },
    });
  }
);

// --- Support tickets ---

/**
 * List all support tickets (admin). Optional ?status=OPEN|IN_PROGRESS|RESOLVED
 * GET /api/admin/support-tickets
 */
export const getSupportTicketsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const tickets = await listAllSupportTickets({
      status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | undefined,
      limit,
    });

    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
    });
  }
);

/**
 * Get support ticket by ID (admin)
 * GET /api/admin/support-tickets/:id
 */
export const getSupportTicketByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const ticket = await getSupportTicketByIdForAdmin(id);

    res.json({
      success: true,
      data: ticket,
    });
  }
);

/**
 * Admin respond to support ticket
 * POST /api/admin/support-tickets/:id/respond
 */
export const respondToSupportTicketHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const validatedData = respondToSupportTicketSchema.parse(req.body);

    const ticket = await respondToSupportTicket(id, adminId, validatedData);

    await notifyUser(
      ticket.userId,
      'SUPPORT_TICKET_RESPONSE',
      'Support request updated',
      'An admin has responded to your support request. Check "My support requests" on your Performance page (or Support page) for details.',
      { ticketId: ticket.id, subject: ticket.subject },
      { sendEmail: true, sendSms: false }
    ).catch((err) => console.error('[Support ticket] Notify failed:', err));

    await createAuditLog({
      userId: adminId,
      actionType: 'SUPPORT_TICKET_RESPONDED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      details: { status: ticket.status },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Response saved.',
      data: ticket,
    });
  }
);

/**
 * Admin update support ticket (edit response, close, escalate)
 * PATCH /api/admin/support-tickets/:id
 * Body: { status?, adminResponse? } — at least one required
 */
export const updateSupportTicketHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const validatedData = updateSupportTicketSchema.parse(req.body);

    const ticket = await updateSupportTicket(id, adminId, validatedData);

    if (validatedData.adminResponse !== undefined && validatedData.adminResponse.trim() !== '') {
      await notifyUser(
        ticket.userId,
        'SUPPORT_TICKET_RESPONSE',
        'Support request updated',
        'An admin has responded to your support request. Check "My support requests" on your Performance page (or Support page) for details.',
        { ticketId: ticket.id, subject: ticket.subject },
        { sendEmail: true, sendSms: false }
      ).catch((err) => console.error('[Support ticket] Notify failed:', err));
    }

    await createAuditLog({
      userId: adminId,
      actionType: 'SUPPORT_TICKET_UPDATED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      details: { status: ticket.status },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Ticket updated.',
      data: ticket,
    });
  }
);

/**
 * Admin create support ticket on behalf of a user
 * POST /api/admin/support-tickets
 * Body: { userId, subject, message }
 */
export const createSupportTicketByAdminHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.userId;
    const validatedData = createSupportTicketByAdminSchema.parse(req.body);

    const ticket = await createSupportTicketByAdmin(validatedData.userId, {
      subject: validatedData.subject,
      message: validatedData.message,
    });

    await createAuditLog({
      userId: adminId,
      actionType: 'SUPPORT_TICKET_CREATED_BY_ADMIN',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      details: { userId: validatedData.userId },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Ticket created.',
      data: ticket,
    });
  }
);
