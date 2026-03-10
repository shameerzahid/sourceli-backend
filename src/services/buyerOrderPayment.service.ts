import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * List buyer's payments to suppliers (BuyerOrderPayment where order belongs to buyer)
 */
export async function getBuyerPaymentsToSuppliers(buyerUserId: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId: buyerUserId },
  });

  if (!buyer) {
    throw createError('Buyer not found', 404, 'BUYER_NOT_FOUND');
  }

  const payments = await prisma.buyerOrderPayment.findMany({
    where: {
      order: { buyerId: buyer.id },
      deliveryAssignmentId: { not: null },
      farmerId: { not: null },
    },
    include: {
      order: {
        select: {
          id: true,
          productType: true,
          quantity: true,
          deliveryDate: true,
          status: true,
        },
      },
      deliveryAssignment: {
        select: {
          id: true,
          assignedQuantity: true,
          deliveryDate: true,
          status: true,
        },
      },
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
    orderBy: { createdAt: 'desc' },
  });

  return payments;
}

/**
 * List all buyer-order-payments (admin). Optional filters: orderId, farmerId.
 */
export async function getAdminBuyerOrderPayments(filters?: {
  orderId?: string;
  farmerId?: string;
}) {
  const where: { orderId?: string; farmerId?: string } = {};
  if (filters?.orderId) where.orderId = filters.orderId;
  if (filters?.farmerId) where.farmerId = filters.farmerId;

  const payments = await prisma.buyerOrderPayment.findMany({
    where: {
      ...where,
      deliveryAssignmentId: { not: null },
      farmerId: { not: null },
    },
    include: {
      order: {
        include: {
          buyer: {
            include: {
              user: { select: { email: true, phone: true } },
            },
          },
          deliveryAddress: true,
        },
      },
      deliveryAssignment: true,
      farmer: {
        include: {
          user: { select: { email: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return payments;
}

/**
 * Admin confirms a buyer payment to supplier.
 */
export async function confirmBuyerOrderPaymentByAdmin(paymentId: string, adminId: string) {
  const payment = await prisma.buyerOrderPayment.findUnique({
    where: { id: paymentId },
    include: { order: true, farmer: true },
  });

  if (!payment) {
    throw createError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (!payment.farmerId || !payment.deliveryAssignmentId) {
    throw createError(
      'This payment is not a buyer-to-supplier payment and cannot be confirmed',
      400,
      'INVALID_PAYMENT_TYPE'
    );
  }

  if (payment.adminConfirmedAt) {
    return prisma.buyerOrderPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: { include: { deliveryAddress: true } },
        deliveryAssignment: true,
        farmer: { include: { user: { select: { email: true, phone: true } } } },
      },
    });
  }

  return prisma.buyerOrderPayment.update({
    where: { id: paymentId },
    data: { adminConfirmedAt: new Date() },
    include: {
      order: { include: { deliveryAddress: true } },
      deliveryAssignment: true,
      farmer: { include: { user: { select: { email: true, phone: true } } } },
    },
  });
}

/**
 * List payments from buyers to this farmer (farmer portal).
 */
export async function getFarmerBuyerPayments(farmerId: string) {
  const payments = await prisma.buyerOrderPayment.findMany({
    where: { farmerId },
    include: {
      order: {
        select: {
          id: true,
          productType: true,
          quantity: true,
          deliveryDate: true,
          status: true,
        },
      },
      deliveryAssignment: {
        select: {
          id: true,
          assignedQuantity: true,
          deliveryDate: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return payments;
}

/**
 * Farmer confirms receipt of a buyer payment. Idempotent.
 */
export async function confirmBuyerPaymentReceiptByFarmer(paymentId: string, farmerId: string) {
  const payment = await prisma.buyerOrderPayment.findFirst({
    where: { id: paymentId, farmerId },
    include: {
      order: { select: { id: true, productType: true, quantity: true, deliveryDate: true } },
      deliveryAssignment: true,
    },
  });

  if (!payment) {
    throw createError('Payment not found or you do not have access to it', 404, 'PAYMENT_NOT_FOUND');
  }

  const wasAlreadyConfirmed = !!payment.supplierConfirmedAt;

  const updated = await prisma.buyerOrderPayment.update({
    where: { id: paymentId },
    data: { supplierConfirmedAt: wasAlreadyConfirmed ? payment.supplierConfirmedAt : new Date() },
    include: {
      order: { select: { id: true, productType: true, quantity: true, deliveryDate: true } },
      deliveryAssignment: true,
    },
  });

  return updated;
}
