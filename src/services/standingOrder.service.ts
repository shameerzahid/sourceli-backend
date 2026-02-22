import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { OrderStatus, UserStatus } from '@prisma/client';
import { notifyUser } from './notificationDelivery.service.js';
export interface CreateStandingOrderData {
  productType: string;
  quantity: number;
  preferredDeliveryDayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  deliveryAddressId: string;
  startDate: Date;
  endDate?: Date | null;
  notes?: string;
}

export interface UpdateStandingOrderData {
  isActive?: boolean;
}

/**
 * Get buyer by userId (throws if not found or not active)
 */
async function getActiveBuyer(buyerUserId: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerUserId },
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
  return buyer;
}

/**
 * Create a standing (recurring) order.
 * Prevents duplicate: one active standing order per (buyer, productType, deliveryAddress).
 */
export async function createStandingOrder(
  buyerUserId: string,
  data: CreateStandingOrderData
) {
  const buyer = await getActiveBuyer(buyerUserId);

  // Validate delivery address belongs to buyer
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

  if (data.quantity <= 0) {
    throw createError(
      'Quantity must be greater than 0',
      400,
      'INVALID_QUANTITY'
    );
  }

  if (data.preferredDeliveryDayOfWeek < 0 || data.preferredDeliveryDayOfWeek > 6) {
    throw createError(
      'Preferred delivery day must be 0 (Sunday) through 6 (Saturday)',
      400,
      'INVALID_DAY'
    );
  }

  if (data.startDate <= new Date()) {
    throw createError(
      'Start date must be in the future',
      400,
      'INVALID_START_DATE'
    );
  }

  if (data.endDate && data.endDate <= data.startDate) {
    throw createError(
      'End date must be after start date',
      400,
      'INVALID_END_DATE'
    );
  }

  // Check for duplicate: existing standing order with same buyer, product, address
  const existing = await prisma.standingOrder.findUnique({
    where: {
      buyerId_productType_deliveryAddressId: {
        buyerId: buyer.id,
        productType: data.productType.trim(),
        deliveryAddressId: data.deliveryAddressId,
      },
    },
  });

  if (existing) {
    if (existing.isActive) {
      throw createError(
        'You already have an active standing order for this product and delivery address. Pause or cancel it first to create a new one.',
        409,
        'DUPLICATE_STANDING_ORDER'
      );
    }
    // Reactivate and update the existing one instead of creating duplicate
    return prisma.standingOrder.update({
      where: { id: existing.id },
      data: {
        quantity: data.quantity,
        preferredDeliveryDayOfWeek: data.preferredDeliveryDayOfWeek,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        isActive: true,
        notes: data.notes?.trim() ?? null,
      },
      include: {
        buyer: true,
        deliveryAddress: true,
      },
    });
  }

  return prisma.standingOrder.create({
    data: {
      buyerId: buyer.id,
      productType: data.productType.trim(),
      quantity: data.quantity,
      preferredDeliveryDayOfWeek: data.preferredDeliveryDayOfWeek,
      deliveryAddressId: data.deliveryAddressId,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      isActive: true,
      notes: data.notes?.trim(),
    },
    include: {
      buyer: true,
      deliveryAddress: true,
    },
  });
}

/**
 * Get all standing orders for a buyer.
 */
export async function getStandingOrdersByBuyer(buyerUserId: string) {
  const buyer = await getActiveBuyer(buyerUserId);
  return prisma.standingOrder.findMany({
    where: { buyerId: buyer.id },
    include: {
      deliveryAddress: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single standing order by ID (must belong to buyer).
 */
export async function getStandingOrderById(
  standingOrderId: string,
  buyerUserId: string
) {
  const buyer = await getActiveBuyer(buyerUserId);
  const so = await prisma.standingOrder.findFirst({
    where: {
      id: standingOrderId,
      buyerId: buyer.id,
    },
    include: {
      deliveryAddress: true,
      generatedOrders: {
        orderBy: { deliveryDate: 'desc' },
        take: 10,
      },
    },
  });
  if (!so) {
    throw createError('Standing order not found', 404, 'STANDING_ORDER_NOT_FOUND');
  }
  return so;
}

/**
 * Pause or cancel standing order (set isActive = false).
 * Optionally resume (set isActive = true).
 */
export async function updateStandingOrder(
  standingOrderId: string,
  buyerUserId: string,
  data: UpdateStandingOrderData
) {
  const buyer = await getActiveBuyer(buyerUserId);
  const so = await prisma.standingOrder.findFirst({
    where: {
      id: standingOrderId,
      buyerId: buyer.id,
    },
  });
  if (!so) {
    throw createError('Standing order not found', 404, 'STANDING_ORDER_NOT_FOUND');
  }

  return prisma.standingOrder.update({
    where: { id: standingOrderId },
    data: {
      isActive: data.isActive ?? so.isActive,
    },
    include: {
      deliveryAddress: true,
    },
  });
}

// --- Weekly order generation ---

/**
 * Get the next delivery date for a standing order (preferred day of week, on or after fromDate, within endDate if set).
 */
function getNextDeliveryDate(
  so: { startDate: Date; endDate: Date | null; preferredDeliveryDayOfWeek: number },
  fromDate: Date
): Date | null {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);

  let candidate = new Date(so.startDate);
  candidate.setHours(0, 0, 0, 0);

  if (candidate < from) {
    candidate = new Date(from);
  }

  const candidateDay = candidate.getDay(); // 0 = Sun, 6 = Sat
  let daysToAdd =
    (so.preferredDeliveryDayOfWeek - candidateDay + 7) % 7;
  if (daysToAdd === 0 && candidate < from) {
    daysToAdd = 7;
  }
  candidate.setDate(candidate.getDate() + daysToAdd);

  if (so.endDate) {
    const end = new Date(so.endDate);
    end.setHours(23, 59, 59, 999);
    if (candidate > end) return null;
  }

  return candidate >= from ? candidate : null;
}

/**
 * Generate orders from active standing orders for the next occurrence (weekly job).
 * Creates one order per standing order for the next delivery date if not already created.
 */
export async function generateOrdersFromStandingOrders(): Promise<{
  created: number;
  orderIds: string[];
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = await prisma.standingOrder.findMany({
    where: { isActive: true },
    include: {
      buyer: { include: { user: true } },
      deliveryAddress: true,
    },
  });

  const orderIds: string[] = [];

  for (const so of active) {
    if (so.buyer.user.status !== UserStatus.ACTIVE) continue;

    const nextDate = getNextDeliveryDate(so, today);
    if (!nextDate) continue;

    const dayStart = new Date(nextDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(nextDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    dayEnd.setUTCHours(0, 0, 0, 0);

    const existing = await prisma.order.findFirst({
      where: {
        standingOrderId: so.id,
        deliveryDate: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    });

    if (existing) continue;

    const order = await prisma.order.create({
      data: {
        buyerId: so.buyerId,
        productType: so.productType,
        quantity: so.quantity,
        orderType: 'STANDING',
        deliveryDate: nextDate,
        deliveryAddressId: so.deliveryAddressId,
        status: OrderStatus.PENDING,
        standingOrderId: so.id,
        notes: so.notes ?? undefined,
      },
    });
    orderIds.push(order.id);

    await notifyUser(
      so.buyer.userId,
      'STANDING_ORDER_GENERATED',
      'New order from standing order',
      `A new order has been created from your standing order: ${so.quantity} units of ${so.productType} for delivery on ${nextDate.toLocaleDateString()}. It is pending admin approval.`,
      { orderId: order.id, standingOrderId: so.id }
    ).catch((err) => console.error('[Notification]', err));
  }

  return { created: orderIds.length, orderIds };
}
