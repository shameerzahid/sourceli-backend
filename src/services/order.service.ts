import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { OrderType, OrderStatus, UserStatus } from '@prisma/client';

export interface CreateOrderData {
  productType: string;
  quantity: number;
  orderType: OrderType;
  deliveryDate: Date;
  deliveryAddressId: string;
  notes?: string;
}

/**
 * Create a new order (one-time or standing)
 */
export async function createOrder(buyerId: string, data: CreateOrderData) {
  // Verify buyer exists and is active
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerId },
    include: { user: true },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  if (buyer.user.status !== UserStatus.ACTIVE) {
    throw createError(
      'Your account is not active. Please contact support.',
      403,
      'BUYER_NOT_ACTIVE'
    );
  }

  // Verify delivery address belongs to buyer
  const address = await prisma.deliveryAddress.findFirst({
    where: {
      id: data.deliveryAddressId,
      buyerId: buyer.id,
    },
  });

  if (!address) {
    throw createError(
      'Delivery address not found or does not belong to you',
      404,
      'ADDRESS_NOT_FOUND'
    );
  }

  // Validate quantity
  if (data.quantity <= 0) {
    throw createError(
      'Quantity must be greater than 0',
      400,
      'INVALID_QUANTITY'
    );
  }

  // Validate delivery date is in the future
  if (data.deliveryDate <= new Date()) {
    throw createError(
      'Delivery date must be in the future',
      400,
      'INVALID_DELIVERY_DATE'
    );
  }

  // Create order
  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id,
      productType: data.productType.trim(),
      quantity: data.quantity,
      orderType: data.orderType,
      deliveryDate: data.deliveryDate,
      deliveryAddressId: data.deliveryAddressId,
      status: OrderStatus.PENDING,
      notes: data.notes?.trim(),
    },
    include: {
      deliveryAddress: true,
      buyer: {
        include: {
          user: {
            select: {
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  return order;
}

/**
 * Get all orders for a buyer
 */
export async function getBuyerOrders(buyerId: string, filters?: {
  status?: OrderStatus;
  limit?: number;
}) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerId },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  const where: any = {
    buyerId: buyer.id,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      deliveryAddress: true,
      assignments: {
        include: {
          farmer: {
            include: {
              user: {
                select: {
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: filters?.limit || 50,
  });

  return orders;
}

/**
 * Get a specific order by ID
 */
export async function getOrderById(orderId: string, buyerId: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerId },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId: buyer.id,
    },
    include: {
      deliveryAddress: true,
      assignments: {
        include: {
          farmer: {
            include: {
              user: {
                select: {
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
      buyer: {
        include: {
          user: {
            select: {
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  return order;
}

/**
 * Get all pending orders (for admin)
 */
export async function getPendingOrders() {
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING,
    },
    include: {
      buyer: {
        include: {
          user: {
            select: {
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      },
      deliveryAddress: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return orders;
}

/**
 * Approve an order (admin only)
 */
export async function approveOrder(
  orderId: string,
  adminId: string,
  adminNotes?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: { include: { user: true } } },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== OrderStatus.PENDING) {
    throw createError(
      `Cannot approve order with status: ${order.status}`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  // Check if buyer is suspended
  if (order.buyer.user.status === UserStatus.SUSPENDED) {
    throw createError(
      'Cannot approve order from suspended buyer',
      400,
      'BUYER_SUSPENDED'
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.ALLOCATION,
      approvedAt: new Date(),
      approvedBy: adminId,
      notes: adminNotes ? `${order.notes || ''}\n[Admin]: ${adminNotes}`.trim() : order.notes,
    },
    include: {
      buyer: {
        include: {
          user: {
            select: {
              email: true,
              phone: true,
            },
          },
        },
      },
      deliveryAddress: true,
    },
  });

  return updated;
}

/**
 * Reject an order (admin only)
 */
export async function rejectOrder(
  orderId: string,
  adminId: string,
  rejectionReason: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== OrderStatus.PENDING) {
    throw createError(
      `Cannot reject order with status: ${order.status}`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.REJECTED,
      approvedBy: adminId,
      rejectionReason: rejectionReason.trim(),
    },
    include: {
      buyer: {
        include: {
          user: {
            select: {
              email: true,
              phone: true,
            },
          },
        },
      },
      deliveryAddress: true,
    },
  });

  return updated;
}

