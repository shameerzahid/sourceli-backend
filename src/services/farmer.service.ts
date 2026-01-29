import { prisma } from '../config/database.js';
import { getWeekStartDate, isWithinSubmissionWindow, isLateSubmission } from '../utils/weekCalculation.js';
import { createError } from '../middleware/errorHandler.js';

export interface SubmitAvailabilityData {
  productType: string;
  quantityAvailable: number;
  avgWeight?: number;
  readyDate: Date;
}

/**
 * Submit weekly availability
 * Enforces Monday-Tuesday submission window
 * Marks late submissions automatically
 */
export async function submitWeeklyAvailability(
  farmerId: string,
  data: SubmitAvailabilityData
) {
  // Get current week start (Monday)
  const weekStartDate = getWeekStartDate();
  
  // Check if already submitted for this week and product type
  const existing = await prisma.weeklyAvailability.findUnique({
    where: {
      farmerId_weekStartDate_productType: {
        farmerId,
        weekStartDate,
        productType: data.productType,
      },
    },
  });

  if (existing) {
    throw createError(
      `You have already submitted availability for ${data.productType} this week.`,
      409,
      'DUPLICATE_SUBMISSION'
    );
  }

  // Check if within submission window (Monday-Tuesday)
  const submissionDate = new Date();
  const isLate = !isWithinSubmissionWindow(submissionDate) || 
                 isLateSubmission(submissionDate, weekStartDate);

  // Validate quantity
  if (data.quantityAvailable <= 0) {
    throw createError(
      'Quantity available must be greater than 0',
      400,
      'INVALID_QUANTITY'
    );
  }

  // Validate ready date is in the future
  if (data.readyDate <= new Date()) {
    throw createError(
      'Ready date must be in the future',
      400,
      'INVALID_READY_DATE'
    );
  }

  // Create availability record
  const availability = await prisma.weeklyAvailability.create({
    data: {
      farmerId,
      weekStartDate,
      productType: data.productType.trim(),
      quantityAvailable: data.quantityAvailable,
      avgWeight: data.avgWeight,
      readyDate: data.readyDate,
      isLate,
    },
  });

  return availability;
}

/**
 * Get availability history for a farmer
 * @param farmerId Farmer ID
 * @param limit Optional limit (default: 20)
 * @returns Array of availability records
 */
export async function getAvailabilityHistory(
  farmerId: string,
  limit: number = 20
) {
  const availability = await prisma.weeklyAvailability.findMany({
    where: {
      farmerId,
    },
    orderBy: {
      weekStartDate: 'desc',
    },
    take: limit,
  });

  return availability;
}

/**
 * Get current week availability status for a farmer
 * Returns availability if submitted, null otherwise
 */
export async function getCurrentWeekAvailability(farmerId: string) {
  const weekStartDate = getWeekStartDate();
  
  const availability = await prisma.weeklyAvailability.findMany({
    where: {
      farmerId,
      weekStartDate,
    },
  });

  return availability;
}

/**
 * Get availability for a specific week
 */
export async function getAvailabilityForWeek(
  farmerId: string,
  weekStartDate: Date
) {
  const availability = await prisma.weeklyAvailability.findMany({
    where: {
      farmerId,
      weekStartDate,
    },
  });

  return availability;
}

/**
 * Get all delivery assignments for a farmer
 * @param farmerId Farmer ID
 * @param filters Optional filters (status, upcoming only)
 * @returns Array of delivery assignments
 */
export async function getDeliveryAssignments(
  farmerId: string,
  filters?: {
    status?: string;
    upcomingOnly?: boolean;
  }
) {
  const where: any = {
    farmerId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.upcomingOnly) {
    where.deliveryDate = {
      gte: new Date(),
    };
  }

  const assignments = await prisma.deliveryAssignment.findMany({
    where,
    include: {
      order: {
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
        },
      },
      deliveryAddress: true,
    },
    orderBy: {
      deliveryDate: 'asc', // Chronological order
    },
  });

  // Format response - anonymize buyer info as per requirements
  return assignments.map((assignment) => ({
    id: assignment.id,
    assignedQuantity: assignment.assignedQuantity,
    deliveryDate: assignment.deliveryDate,
    status: assignment.status,
    createdAt: assignment.createdAt,
    orderProductType: assignment.order.productType,
    orderQuantity: assignment.order.quantity,
    orderType: assignment.order.orderType,
    orderNotes: assignment.order.notes,
    deliveryAddressDetails: {
      address: assignment.deliveryAddress.address,
      landmark: assignment.deliveryAddress.landmark,
    },
    buyerInfo: {
      buyerType: assignment.order.buyer.buyerType,
      // Don't expose buyer contact info to farmers
    },
  }));
}

/**
 * Get a specific delivery assignment by ID
 * @param assignmentId Assignment ID
 * @param farmerId Farmer ID (for authorization)
 * @returns Assignment details
 */
export async function getAssignmentById(
  assignmentId: string,
  farmerId: string
) {
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: {
      id: assignmentId,
      farmerId,
    },
    include: {
      order: {
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
        },
      },
      deliveryAddress: true,
    },
  });

  if (!assignment) {
    throw createError(
      'Delivery assignment not found',
      404,
      'ASSIGNMENT_NOT_FOUND'
    );
  }

  // Format response - anonymize buyer info
  return {
    id: assignment.id,
    assignedQuantity: assignment.assignedQuantity,
    deliveryDate: assignment.deliveryDate,
    status: assignment.status,
    createdAt: assignment.createdAt,
    orderProductType: assignment.order.productType,
    orderQuantity: assignment.order.quantity,
    orderType: assignment.order.orderType,
    orderNotes: assignment.order.notes,
    deliveryAddressDetails: {
      address: assignment.deliveryAddress.address,
      landmark: assignment.deliveryAddress.landmark,
    },
    buyerInfo: {
      buyerType: assignment.order.buyer.buyerType,
      // Don't expose buyer contact info to farmers
    },
  };
}

