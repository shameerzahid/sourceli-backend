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
} from '../services/order.service.js';
import {
  createDeliveryAddressSchema,
  updateDeliveryAddressSchema,
  createOrderSchema,
} from '../validators/buyer.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { prisma } from '../config/database.js';
import { createAuditLog } from '../utils/auditLog.js';

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


