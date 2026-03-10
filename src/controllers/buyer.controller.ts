import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getDeliveryAddresses,
  createDeliveryAddress,
  updateDeliveryAddress,
  deleteDeliveryAddress,
} from '../services/buyer.service.js';
import {
  createOrder,
  getBuyerOrders,
  getOrderById,
  cancelOrderByBuyer,
  updateOrderByBuyer,
  createBuyerOrderPayment,
} from '../services/order.service.js';
import {
  createStandingOrder,
  getStandingOrdersByBuyer,
  getStandingOrderById,
  updateStandingOrder,
} from '../services/standingOrder.service.js';
import {
  createSupportTicket,
  listSupportTicketsByBuyer,
  getSupportTicketByIdForBuyer,
  updateSupportTicketByBuyer,
  deleteSupportTicketByBuyer,
} from '../services/supportTicket.service.js';
import {
  createDeliveryAddressSchema,
  updateDeliveryAddressSchema,
  createOrderSchema,
  updateOrderSchema,
  recordBuyerOrderPaymentSchema,
  createStandingOrderSchema,
  updateStandingOrderSchema,
} from '../validators/buyer.validator.js';
import {
  createSupportTicketSchema,
  updateSupportTicketByBuyerSchema,
} from '../validators/supportTicket.validator.js';
import { getBuyerDashboard } from '../services/dashboard.service.js';
import { getBuyerPaymentsToSuppliers } from '../services/buyerOrderPayment.service.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { prisma } from '../config/database.js';
import { createAuditLog } from '../utils/auditLog.js';

/**
 * Get buyer dashboard stats (active orders, standing orders, unread notifications)
 * GET /api/buyers/dashboard
 */
export const getBuyerDashboardHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const dashboard = await getBuyerDashboard(req.user.userId);
    if (!dashboard) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Buyer profile not found',
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
 * Get all delivery addresses
 * GET /api/buyers/delivery-addresses
 */
export const getDeliveryAddressesHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const buyer = await prisma.buyer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!buyer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Buyer profile not found',
      });
      return;
    }

    const addresses = await getDeliveryAddresses(buyer.id);

    res.status(200).json({
      success: true,
      data: addresses,
      count: addresses.length,
    });
  }
);

/**
 * Create a new delivery address
 * POST /api/buyers/delivery-addresses
 */
export const createDeliveryAddressHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const buyer = await prisma.buyer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!buyer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Buyer profile not found',
      });
      return;
    }

    const validatedData = createDeliveryAddressSchema.parse(req.body);
    const address = await createDeliveryAddress(buyer.id, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ADDRESS_CREATED',
      entityType: 'DeliveryAddress',
      entityId: address.id,
      details: {
        address: address.address,
        isDefault: address.isDefault,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Delivery address created successfully',
      data: address,
    });
  }
);

/**
 * Update a delivery address
 * PUT /api/buyers/delivery-addresses/:id
 */
export const updateDeliveryAddressHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const buyer = await prisma.buyer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!buyer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Buyer profile not found',
      });
      return;
    }

    const { id } = req.params;
    const validatedData = updateDeliveryAddressSchema.parse(req.body);
    const address = await updateDeliveryAddress(id, buyer.id, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ADDRESS_UPDATED',
      entityType: 'DeliveryAddress',
      entityId: address.id,
      details: {
        address: address.address,
        isDefault: address.isDefault,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Delivery address updated successfully',
      data: address,
    });
  }
);

/**
 * Delete a delivery address
 * DELETE /api/buyers/delivery-addresses/:id
 */
export const deleteDeliveryAddressHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const buyer = await prisma.buyer.findUnique({
      where: { userId: req.user.userId },
    });

    if (!buyer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Buyer profile not found',
      });
      return;
    }

    const { id } = req.params;
    await deleteDeliveryAddress(id, buyer.id);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'DELIVERY_ADDRESS_DELETED',
      entityType: 'DeliveryAddress',
      entityId: id,
      details: {},
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Delivery address deleted successfully',
    });
  }
);

/**
 * Create a new order
 * POST /api/buyers/orders
 */
export const createOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = createOrderSchema.parse(req.body);
    const order = await createOrder(req.user.userId, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      details: {
        productType: order.productType,
        quantity: order.quantity,
        orderType: order.orderType,
        deliveryDate: order.deliveryDate,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Waiting for admin approval.',
      data: {
        id: order.id,
        productType: order.productType,
        quantity: order.quantity,
        orderType: order.orderType,
        deliveryDate: order.deliveryDate,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  }
);

/**
 * Get all orders for buyer
 * GET /api/buyers/orders
 */
export const getOrdersHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const status = req.query.status as string | undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;

    const orders = await getBuyerOrders(req.user.userId, {
      status: status as any,
      limit,
    });

    res.status(200).json({
      success: true,
      data: orders,
      count: orders.length,
    });
  }
);

/**
 * Get a specific order by ID
 * GET /api/buyers/orders/:id
 */
export const getOrderByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const order = await getOrderById(id, req.user.userId);

    res.status(200).json({
      success: true,
      data: order,
    });
  }
);

/**
 * Cancel order (buyer only). Only PENDING or PENDING_MODIFICATION.
 * POST /api/buyers/orders/:id/cancel
 */
export const cancelOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const order = await cancelOrderByBuyer(id, req.user.userId);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'ORDER_CANCELLED_BY_BUYER',
      entityType: 'Order',
      entityId: order.id,
      details: { previousStatus: 'PENDING_or_PENDING_MODIFICATION' },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled.',
      data: order,
    });
  }
);

/**
 * Update order (buyer only). Only PENDING or PENDING_MODIFICATION.
 * PUT /api/buyers/orders/:id
 */
export const updateOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const validatedData = updateOrderSchema.parse(req.body);
    const data: {
      productType?: string;
      quantity?: number;
      deliveryDate?: Date;
      deliveryAddressId?: string;
      notes?: string;
    } = {};
    if (validatedData.productType !== undefined) data.productType = validatedData.productType;
    if (validatedData.quantity !== undefined) data.quantity = validatedData.quantity;
    if (validatedData.deliveryDate !== undefined) data.deliveryDate = validatedData.deliveryDate;
    if (validatedData.deliveryAddressId !== undefined) data.deliveryAddressId = validatedData.deliveryAddressId;
    if (validatedData.notes !== undefined) data.notes = validatedData.notes ?? undefined;

    const order = await updateOrderByBuyer(id, req.user.userId, data);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'ORDER_UPDATED_BY_BUYER',
      entityType: 'Order',
      entityId: order.id,
      details: {},
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Order updated.',
      data: order,
    });
  }
);

/**
 * Record payment for an order (buyer, offline). Only ALLOCATION or DELIVERED.
 * POST /api/buyers/orders/:id/record-payment
 */
export const recordOrderPaymentHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const validatedData = recordBuyerOrderPaymentSchema.parse(req.body);
    const payment = await createBuyerOrderPayment(id, req.user.userId, {
      deliveryAssignmentId: validatedData.deliveryAssignmentId,
      amountPaid: validatedData.amountPaid,
      paymentMethod: validatedData.paymentMethod,
      paymentDate: validatedData.paymentDate,
      notes: validatedData.notes,
    });

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'BUYER_RECORDED_ORDER_PAYMENT',
      entityType: 'Order',
      entityId: payment.orderId,
      details: {
        buyerOrderPaymentId: payment.id,
        deliveryAssignmentId: payment.deliveryAssignmentId ?? undefined,
        farmerId: payment.farmerId ?? undefined,
        amountPaid: validatedData.amountPaid,
        paymentMethod: validatedData.paymentMethod,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded.',
      data: payment,
    });
  }
);

/**
 * Get buyer's payments to suppliers (buyer pays supplier, with confirmation status)
 * GET /api/buyers/payments-to-suppliers
 */
export const getPaymentsToSuppliersHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const payments = await getBuyerPaymentsToSuppliers(req.user.userId);

    res.status(200).json({
      success: true,
      data: payments,
    });
  }
);

// --- Standing orders ---

/**
 * Create standing order
 * POST /api/buyers/standing-orders
 */
export const createStandingOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = createStandingOrderSchema.parse(req.body);
    const standingOrder = await createStandingOrder(req.user.userId, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'STANDING_ORDER_CREATED',
      entityType: 'StandingOrder',
      entityId: standingOrder.id,
      details: {
        productType: standingOrder.productType,
        quantity: standingOrder.quantity,
        preferredDeliveryDayOfWeek: standingOrder.preferredDeliveryDayOfWeek,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Standing order created successfully. Orders will be generated weekly.',
      data: standingOrder,
    });
  }
);

/**
 * Get all standing orders for buyer
 * GET /api/buyers/standing-orders
 */
export const getStandingOrdersHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const list = await getStandingOrdersByBuyer(req.user.userId);
    res.status(200).json({
      success: true,
      data: list,
      count: list.length,
    });
  }
);

/**
 * Get standing order by ID
 * GET /api/buyers/standing-orders/:id
 */
export const getStandingOrderByIdHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const standingOrder = await getStandingOrderById(id, req.user.userId);
    res.status(200).json({
      success: true,
      data: standingOrder,
    });
  }
);

/**
 * Update standing order (pause/cancel = isActive: false)
 * PUT /api/buyers/standing-orders/:id
 */
export const updateStandingOrderHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const validatedData = updateStandingOrderSchema.parse(req.body);
    const standingOrder = await updateStandingOrder(id, req.user.userId, validatedData);

    await createAuditLog({
      userId: req.user.userId,
      actionType: 'STANDING_ORDER_UPDATED',
      entityType: 'StandingOrder',
      entityId: standingOrder.id,
      details: { isActive: standingOrder.isActive },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: standingOrder.isActive
        ? 'Standing order resumed.'
        : 'Standing order paused.',
      data: standingOrder,
    });
  }
);

// --- Support tickets (buyer only) ---

/**
 * Create support ticket
 * POST /api/buyers/support-tickets
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
 * GET /api/buyers/support-tickets
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
 * GET /api/buyers/support-tickets/:id
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

/**
 * Update support ticket (own only, subject and/or message). Allowed only before admin has responded.
 * PATCH /api/buyers/support-tickets/:id
 */
export const updateSupportTicketHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    const validatedData = updateSupportTicketByBuyerSchema.parse(req.body);
    const ticket = await updateSupportTicketByBuyer(id, req.user.userId, validatedData);

    res.status(200).json({
      success: true,
      message: 'Support ticket updated.',
      data: ticket,
    });
  }
);

/**
 * Delete support ticket (own only). Allowed only before admin has responded.
 * DELETE /api/buyers/support-tickets/:id
 */
export const deleteSupportTicketHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;
    await deleteSupportTicketByBuyer(id, req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Support ticket deleted.',
    });
  }
);

