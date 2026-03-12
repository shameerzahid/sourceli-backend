import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { OrderType, OrderStatus, UserStatus, PaymentMethod } from '@prisma/client';
import { notifyUser, notifyAdmins } from './notificationDelivery.service.js';

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
      buyerOrderPayments: true,
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
      buyerOrderPayments: true,
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
 * Cancel order by buyer (soft cancel: set status to CANCELLED).
 * Only PENDING or PENDING_MODIFICATION orders can be cancelled.
 */
export async function cancelOrderByBuyer(orderId: string, buyerUserId: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerUserId },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId: buyer.id,
    },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.PENDING_MODIFICATION
  ) {
    throw createError(
      `Cannot cancel order with status: ${order.status}. Only pending or modification-requested orders can be cancelled.`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
    include: {
      deliveryAddress: true,
    },
  });
}

export interface RecordBuyerOrderPaymentData {
  deliveryAssignmentId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes?: string;
}

/**
 * Record a buyer payment to supplier (per delivery assignment). Only ALLOCATION or DELIVERED orders.
 */
export async function createBuyerOrderPayment(
  orderId: string,
  buyerUserId: string,
  data: RecordBuyerOrderPaymentData
) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerUserId },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId: buyer.id,
    },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const allowedStatuses: OrderStatus[] = [OrderStatus.ALLOCATION, OrderStatus.DELIVERED];
  if (!allowedStatuses.includes(order.status)) {
    throw createError(
      `Cannot record payment for order with status: ${order.status}. Only orders in allocation or delivered can be paid.`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: {
      id: data.deliveryAssignmentId,
      orderId,
    },
    include: { farmer: true },
  });

  if (!assignment) {
    throw createError(
      'Delivery assignment not found or does not belong to this order',
      404,
      'ASSIGNMENT_NOT_FOUND'
    );
  }

  const payment = await prisma.buyerOrderPayment.create({
    data: {
      orderId,
      deliveryAssignmentId: data.deliveryAssignmentId,
      farmerId: assignment.farmerId,
      amountPaid: data.amountPaid,
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
      recordedBy: buyerUserId,
      notes: data.notes?.trim() || null,
    },
    include: {
      order: { include: { deliveryAddress: true } },
      deliveryAssignment: true,
      farmer: {
        include: {
          user: { select: { email: true, phone: true } },
        },
      },
    },
  });

  return payment;
}

export interface UpdateOrderByBuyerData {
  productType?: string;
  quantity?: number;
  deliveryDate?: Date;
  deliveryAddressId?: string;
  notes?: string;
}

/**
 * Update an order by buyer. Only PENDING or PENDING_MODIFICATION orders can be updated.
 */
export async function updateOrderByBuyer(
  orderId: string,
  buyerUserId: string,
  data: UpdateOrderByBuyerData
) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerUserId },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId: buyer.id,
    },
    include: { buyer: true },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.PENDING_MODIFICATION
  ) {
    throw createError(
      `Cannot update order with status: ${order.status}. Only PENDING or PENDING_MODIFICATION orders can be updated.`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const updateData: Record<string, unknown> = {};

  if (data.productType !== undefined) {
    updateData.productType = data.productType.trim();
  }
  if (data.quantity !== undefined) {
    if (data.quantity <= 0) {
      throw createError('Quantity must be greater than 0', 400, 'INVALID_QUANTITY');
    }
    updateData.quantity = data.quantity;
  }
  if (data.deliveryDate !== undefined) {
    const d = new Date(data.deliveryDate);
    if (isNaN(d.getTime())) {
      throw createError('Invalid delivery date', 400, 'INVALID_DELIVERY_DATE');
    }
    if (d <= new Date()) {
      throw createError('Delivery date must be in the future', 400, 'INVALID_DELIVERY_DATE');
    }
    updateData.deliveryDate = d;
  }
  if (data.deliveryAddressId !== undefined) {
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
    updateData.deliveryAddressId = data.deliveryAddressId;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes?.trim() || null;
  }

  // When buyer submits after modification request: set status back to PENDING and clear modification fields
  const wasPendingModification = order.status === OrderStatus.PENDING_MODIFICATION;
  if (wasPendingModification) {
    updateData.status = OrderStatus.PENDING;
    updateData.modificationMessage = null;
    updateData.modificationRequestedAt = null;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData as any,
    include: {
      deliveryAddress: true,
    },
  });

  // Notify all admins that buyer has submitted order changes for review
  if (wasPendingModification) {
    await notifyAdmins(
      'BUYER_SUBMITTED_ORDER_CHANGES',
      'Buyer submitted order changes',
      `A buyer has submitted changes to an order that was sent back for modification. Order ID: ${orderId.slice(-8)}. Please review and approve or reject.`,
      { orderId: updated.id }
    ).catch((err) => console.error('[Notification]', err));
  }

  return updated;
}

/**
 * Get all pending orders (for admin)
 */
export async function getPendingOrders() {
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: [OrderStatus.PENDING, OrderStatus.PENDING_MODIFICATION],
      },
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
          deliveryAddresses: {
            select: {
              id: true,
              address: true,
              landmark: true,
              isDefault: true,
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
              id: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      deliveryAddress: true,
    },
  });

  const buyerUserId = updated.buyer.userId;
  await notifyUser(
    buyerUserId,
    'ORDER_APPROVED',
    'Order approved',
    `Your order (${updated.productType}, ${updated.quantity} units) has been approved and is being allocated for delivery on ${new Date(updated.deliveryDate).toLocaleDateString()}.`,
    { orderId: updated.id }
  ).catch((err) => console.error('[Notification]', err));

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
    include: { buyer: true },
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

  await notifyUser(
    order.buyer.userId,
    'ORDER_REJECTED',
    'Order not approved',
    `Your order was not approved. Reason: ${rejectionReason.trim()}`,
    { orderId: updated.id }
  ).catch((err) => console.error('[Notification]', err));

  return updated;
}

/**
 * Request order modification (admin only). Sets order to PENDING_MODIFICATION and notifies buyer (US-ADMIN-010).
 */
export async function requestOrderModification(
  orderId: string,
  adminId: string,
  messageToBuyer: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: {
        include: {
          user: {
            select: { id: true, email: true, phone: true },
          },
        },
      },
      deliveryAddress: true,
    },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== OrderStatus.PENDING) {
    throw createError(
      `Cannot request modification for order with status: ${order.status}. Only PENDING orders can be sent back for modification.`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const trimmedMessage = messageToBuyer.trim();
  if (trimmedMessage.length === 0) {
    throw createError('Message to buyer is required', 400, 'MESSAGE_REQUIRED');
  }
  if (trimmedMessage.length > 500) {
    throw createError('Message to buyer must be at most 500 characters', 400, 'MESSAGE_TOO_LONG');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.PENDING_MODIFICATION,
      modificationRequestedAt: new Date(),
      modificationMessage: trimmedMessage,
    },
    include: {
      buyer: {
        include: {
          user: {
            select: { id: true, email: true, phone: true },
          },
        },
      },
      deliveryAddress: true,
    },
  });

  await notifyUser(
    order.buyer.userId,
    'ORDER_MODIFICATION_REQUESTED',
    'Admin requested order changes',
    `The admin has requested changes to your order. Message: ${trimmedMessage}`,
    { orderId: updated.id }
  ).catch((err) => console.error('[Notification]', err));

  return updated;
}

export interface CreateOrderByAdminData {
  buyerId: string;
  productType: string;
  quantity: number;
  orderType: OrderType;
  deliveryDate: Date;
  deliveryAddressId: string;
  notes?: string;
}

/**
 * Create an order on behalf of a buyer (admin only)
 */
export async function createOrderByAdmin(_adminId: string, data: CreateOrderByAdminData) {
  const buyer = await prisma.buyer.findUnique({
    where: { id: data.buyerId },
    include: { user: true },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  if (buyer.user.status !== UserStatus.ACTIVE) {
    throw createError('Buyer account is not active', 400, 'BUYER_NOT_ACTIVE');
  }

  const address = await prisma.deliveryAddress.findFirst({
    where: {
      id: data.deliveryAddressId,
      buyerId: data.buyerId,
    },
  });

  if (!address) {
    throw createError(
      'Delivery address not found or does not belong to this buyer',
      404,
      'ADDRESS_NOT_FOUND'
    );
  }

  if (data.quantity <= 0) {
    throw createError('Quantity must be greater than 0', 400, 'INVALID_QUANTITY');
  }

  const deliveryDate = new Date(data.deliveryDate);
  if (isNaN(deliveryDate.getTime())) {
    throw createError('Invalid delivery date', 400, 'INVALID_DELIVERY_DATE');
  }

  const order = await prisma.order.create({
    data: {
      buyerId: data.buyerId,
      productType: data.productType.trim(),
      quantity: data.quantity,
      orderType: data.orderType,
      deliveryDate,
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

export interface UpdateOrderByAdminData {
  productType?: string;
  quantity?: number;
  deliveryDate?: Date;
  deliveryAddressId?: string;
  notes?: string;
}

/**
 * Update an order (admin only). Only PENDING or PENDING_MODIFICATION orders can be updated.
 */
export async function updateOrderByAdmin(
  orderId: string,
  adminId: string,
  data: UpdateOrderByAdminData
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: true },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.PENDING_MODIFICATION
  ) {
    throw createError(
      `Cannot update order with status: ${order.status}. Only PENDING or PENDING_MODIFICATION orders can be updated.`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const updateData: Record<string, unknown> = {};

  if (data.productType !== undefined) {
    updateData.productType = data.productType.trim();
  }
  if (data.quantity !== undefined) {
    if (data.quantity <= 0) {
      throw createError('Quantity must be greater than 0', 400, 'INVALID_QUANTITY');
    }
    updateData.quantity = data.quantity;
  }
  if (data.deliveryDate !== undefined) {
    const d = new Date(data.deliveryDate);
    if (isNaN(d.getTime())) {
      throw createError('Invalid delivery date', 400, 'INVALID_DELIVERY_DATE');
    }
    updateData.deliveryDate = d;
  }
  if (data.deliveryAddressId !== undefined) {
    const address = await prisma.deliveryAddress.findFirst({
      where: {
        id: data.deliveryAddressId,
        buyerId: order.buyerId,
      },
    });
    if (!address) {
      throw createError(
        'Delivery address not found or does not belong to this buyer',
        404,
        'ADDRESS_NOT_FOUND'
      );
    }
    updateData.deliveryAddressId = data.deliveryAddressId;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes?.trim() || null;
  }

  // When admin updates an order that was in PENDING_MODIFICATION: set status back to PENDING and clear modification fields; notify buyer
  const wasPendingModification = order.status === OrderStatus.PENDING_MODIFICATION;
  if (wasPendingModification) {
    updateData.status = OrderStatus.PENDING;
    updateData.modificationMessage = null;
    updateData.modificationRequestedAt = null;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData as any,
    include: {
      buyer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      },
      deliveryAddress: true,
    },
  });

  // Notify buyer that admin has updated their order and it is pending approval again
  if (wasPendingModification && updated.buyer?.user) {
    await notifyUser(
      updated.buyer.user.id,
      'ADMIN_UPDATED_ORDER',
      'Admin updated your order',
      'The admin has updated your order. It is pending approval again. You can view the changes in your order details.',
      { orderId: updated.id }
    ).catch((err) => console.error('[Notification]', err));
  }

  return updated;
}

/**
 * Delete an order (admin only). Only PENDING or PENDING_MODIFICATION orders can be deleted.
 */
export async function deleteOrderByAdmin(orderId: string, _adminId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { assignments: true },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.PENDING_MODIFICATION
  ) {
    throw createError(
      `Cannot delete order with status: ${order.status}. Only PENDING or PENDING_MODIFICATION orders can be deleted.`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  await prisma.order.delete({
    where: { id: orderId },
  });

  return { deleted: true, orderId };
}

