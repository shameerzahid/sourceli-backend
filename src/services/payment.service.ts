import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { PaymentStatus, PaymentMethod, AssignmentStatus } from '@prisma/client';

export interface RecordPaymentData {
  farmerId: string;
  deliveryAssignmentId?: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes?: string;
}

/**
 * Calculate amount owed to a farmer from confirmed deliveries
 */
export async function calculateAmountOwed(farmerId: string) {
  // Get all delivered assignments for the farmer
  const deliveredAssignments = await prisma.deliveryAssignment.findMany({
    where: {
      farmerId,
      status: AssignmentStatus.DELIVERED,
    },
    include: {
      order: true,
    },
  });

  // Calculate total owed (this would typically use pricing, but for MVP we'll use a simple calculation)
  // In a real system, you'd calculate: quantity * price per unit
  // For now, we'll just sum up the assigned quantities as a placeholder
  const totalOwed = deliveredAssignments.reduce((sum, assignment) => {
    // TODO: Replace with actual pricing calculation
    // For MVP, we'll use a simple calculation based on quantity
    const pricePerUnit = 100; // Placeholder price
    return sum + (assignment.assignedQuantity * pricePerUnit);
  }, 0);

  // Get total paid
  const payments = await prisma.payment.findMany({
    where: {
      farmerId,
    },
  });

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amountPaid, 0);

  return {
    totalOwed,
    totalPaid,
    outstandingBalance: totalOwed - totalPaid,
    deliveredAssignments: deliveredAssignments.length,
  };
}

/**
 * Record an offline payment
 * Admin only
 */
export async function recordPayment(
  adminId: string,
  data: RecordPaymentData
) {
  // Verify farmer exists
  const farmer = await prisma.farmer.findUnique({
    where: { id: data.farmerId },
    include: { user: true },
  });

  if (!farmer) {
    throw createError('Farmer not found', 404, 'FARMER_NOT_FOUND');
  }

  // If delivery assignment is provided, verify it exists and belongs to farmer
  if (data.deliveryAssignmentId) {
    const assignment = await prisma.deliveryAssignment.findFirst({
      where: {
        id: data.deliveryAssignmentId,
        farmerId: data.farmerId,
      },
    });

    if (!assignment) {
      throw createError(
        'Delivery assignment not found or does not belong to this farmer',
        404,
        'ASSIGNMENT_NOT_FOUND'
      );
    }
  }

  // Validate amount
  if (data.amountPaid <= 0) {
    throw createError(
      'Payment amount must be greater than 0',
      400,
      'INVALID_AMOUNT'
    );
  }

  // Calculate amount owed
  const { totalOwed, totalPaid } = await calculateAmountOwed(data.farmerId);
  const amountOwed = totalOwed - totalPaid;

  // Determine payment status
  let paymentStatus: PaymentStatus;
  const newTotalPaid = totalPaid + data.amountPaid;

  if (newTotalPaid >= totalOwed) {
    paymentStatus = PaymentStatus.PAID;
  } else if (newTotalPaid > 0) {
    paymentStatus = PaymentStatus.PARTIALLY_PAID;
  } else {
    paymentStatus = PaymentStatus.NOT_PAID;
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      farmerId: data.farmerId,
      deliveryAssignmentId: data.deliveryAssignmentId,
      amountOwed: amountOwed,
      amountPaid: data.amountPaid,
      paymentStatus,
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
      recordedBy: adminId,
      notes: data.notes?.trim(),
    },
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
      assignment: {
        include: {
          order: true,
        },
      },
    },
  });

  return payment;
}

/**
 * Get payment records for a farmer
 * Read-only for farmers
 */
export async function getFarmerPayments(farmerId: string) {
  const payments = await prisma.payment.findMany({
    where: {
      farmerId,
    },
    orderBy: {
      paymentDate: 'desc',
    },
    include: {
      assignment: {
        include: {
          order: {
            select: {
              id: true,
              productType: true,
              quantity: true,
              deliveryDate: true,
            },
          },
        },
      },
    },
  });

  // Get outstanding balance
  const balance = await calculateAmountOwed(farmerId);

  return {
    payments,
    balance,
  };
}

/**
 * Get payment reports (admin only)
 * Can filter by date range or farmer
 */
export async function getPaymentReports(filters?: {
  farmerId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentStatus?: PaymentStatus;
}) {
  const where: any = {};

  if (filters?.farmerId) {
    where.farmerId = filters.farmerId;
  }

  if (filters?.paymentStatus) {
    where.paymentStatus = filters.paymentStatus;
  }

  if (filters?.startDate || filters?.endDate) {
    where.paymentDate = {};
    if (filters.startDate) {
      where.paymentDate.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.paymentDate.lte = filters.endDate;
    }
  }

  const payments = await prisma.payment.findMany({
    where,
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
      assignment: {
        include: {
          order: {
            select: {
              id: true,
              productType: true,
              quantity: true,
            },
          },
        },
      },
    },
    orderBy: {
      paymentDate: 'desc',
    },
  });

  // Calculate summary statistics
  const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalOwed = payments.reduce((sum, p) => sum + p.amountOwed, 0);

  return {
    payments,
    summary: {
      totalPayments: payments.length,
      totalPaid,
      totalOwed,
      outstandingBalance: totalOwed - totalPaid,
    },
  };
}

/**
 * Get outstanding balance for a farmer
 */
export async function getOutstandingBalance(farmerId: string) {
  return await calculateAmountOwed(farmerId);
}

