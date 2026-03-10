import { prisma } from '../config/database.js';
import { getWeekStartDate, isWithinSubmissionWindow, isLateSubmission } from '../utils/weekCalculation.js';
import {
  getMonthStartDate,
  isWithinMonthlySubmissionWindow,
  isLateMonthlySubmission,
} from '../utils/monthCalculation.js';
import { createError } from '../middleware/errorHandler.js';
import { notifyUser } from './notificationDelivery.service.js';

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

  if (isLate) {
    try {
      const { updatePerformanceScore } = await import('./performance.service.js');
      await updatePerformanceScore(
        farmerId,
        'Late availability submission',
        undefined,
        undefined
      );
    } catch (error) {
      console.error('Error updating performance score:', error);
    }
    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { userId: true },
    });
    if (farmer?.userId) {
      await notifyUser(
        farmer.userId,
        'LATE_AVAILABILITY_WARNING',
        'Late availability submission',
        'Your availability was submitted after the Monday–Tuesday window. Late submissions may affect your performance score.',
        { availabilityId: availability.id, weekStartDate: weekStartDate.toISOString() }
      ).catch((err) => console.error('[Notification]', err));
    }
  }

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
 * Submit monthly availability
 * Submission window: first 5 days of the month; late after that
 */
export async function submitMonthlyAvailability(
  farmerId: string,
  data: SubmitAvailabilityData
) {
  const monthStartDate = getMonthStartDate();

  const existing = await prisma.monthlyAvailability.findUnique({
    where: {
      farmerId_monthStartDate_productType: {
        farmerId,
        monthStartDate,
        productType: data.productType,
      },
    },
  });

  if (existing) {
    throw createError(
      `You have already submitted availability for ${data.productType} this month.`,
      409,
      'DUPLICATE_SUBMISSION'
    );
  }

  const submissionDate = new Date();
  const isLate =
    !isWithinMonthlySubmissionWindow(submissionDate) ||
    isLateMonthlySubmission(submissionDate, monthStartDate);

  if (data.quantityAvailable <= 0) {
    throw createError(
      'Quantity available must be greater than 0',
      400,
      'INVALID_QUANTITY'
    );
  }

  if (data.readyDate <= new Date()) {
    throw createError(
      'Ready date must be in the future',
      400,
      'INVALID_READY_DATE'
    );
  }

  const availability = await prisma.monthlyAvailability.create({
    data: {
      farmerId,
      monthStartDate,
      productType: data.productType.trim(),
      quantityAvailable: data.quantityAvailable,
      avgWeight: data.avgWeight,
      readyDate: data.readyDate,
      isLate,
    },
  });

  if (isLate) {
    try {
      const { updatePerformanceScore } = await import('./performance.service.js');
      await updatePerformanceScore(
        farmerId,
        'Late monthly availability submission',
        undefined,
        undefined
      );
    } catch (error) {
      console.error('Error updating performance score:', error);
    }
    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { userId: true },
    });
    if (farmer?.userId) {
      await notifyUser(
        farmer.userId,
        'LATE_AVAILABILITY_WARNING',
        'Late monthly availability submission',
        'Your monthly availability was submitted after the submission window. Late submissions may affect your performance score.',
        { availabilityId: availability.id, monthStartDate: monthStartDate.toISOString() }
      ).catch((err) => console.error('[Notification]', err));
    }
  }

  return availability;
}

/**
 * Get monthly availability history for a farmer
 */
export async function getMonthlyAvailabilityHistory(
  farmerId: string,
  limit: number = 20
) {
  return prisma.monthlyAvailability.findMany({
    where: { farmerId },
    orderBy: { monthStartDate: 'desc' },
    take: limit,
  });
}

/**
 * Get current month availability for a farmer
 */
export async function getCurrentMonthAvailability(farmerId: string) {
  const monthStartDate = getMonthStartDate();
  return prisma.monthlyAvailability.findMany({
    where: {
      farmerId,
      monthStartDate,
    },
  });
}

/**
 * Update an existing monthly availability record.
 * Only the owning farmer; only current or future month.
 */
export async function updateMonthlyAvailability(
  availabilityId: string,
  farmerId: string,
  data: UpdateAvailabilityData
) {
  const existing = await prisma.monthlyAvailability.findUnique({
    where: { id: availabilityId },
  });

  if (!existing) {
    throw createError('Availability record not found', 404, 'NOT_FOUND');
  }

  if (existing.farmerId !== farmerId) {
    throw createError('You can only update your own availability', 403, 'FORBIDDEN');
  }

  const monthStartDate = getMonthStartDate();
  if (existing.monthStartDate < monthStartDate) {
    throw createError(
      'You can only update availability for the current month or future months',
      400,
      'PAST_MONTH'
    );
  }

  const updateData: Record<string, unknown> = {};

  if (data.quantityAvailable !== undefined) {
    if (data.quantityAvailable <= 0) {
      throw createError(
        'Quantity available must be greater than 0',
        400,
        'INVALID_QUANTITY'
      );
    }
    updateData.quantityAvailable = data.quantityAvailable;
  }

  if (data.avgWeight !== undefined) {
    updateData.avgWeight = data.avgWeight;
  }

  if (data.readyDate !== undefined) {
    if (data.readyDate <= new Date()) {
      throw createError(
        'Ready date must be in the future',
        400,
        'INVALID_READY_DATE'
      );
    }
    updateData.readyDate = data.readyDate;
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(
      'Provide at least one field to update (quantityAvailable, avgWeight, or readyDate)',
      400,
      'NO_CHANGES'
    );
  }

  return prisma.monthlyAvailability.update({
    where: { id: availabilityId },
    data: updateData,
  });
}

/**
 * Delete a monthly availability record.
 * Only the owning farmer; only current or future month.
 */
export async function deleteMonthlyAvailability(
  availabilityId: string,
  farmerId: string
) {
  const existing = await prisma.monthlyAvailability.findUnique({
    where: { id: availabilityId },
  });

  if (!existing) {
    throw createError('Availability record not found', 404, 'NOT_FOUND');
  }

  if (existing.farmerId !== farmerId) {
    throw createError('You can only delete your own availability', 403, 'FORBIDDEN');
  }

  const monthStartDate = getMonthStartDate();
  if (existing.monthStartDate < monthStartDate) {
    throw createError(
      'You can only delete availability for the current month or future months',
      400,
      'PAST_MONTH'
    );
  }

  await prisma.monthlyAvailability.delete({
    where: { id: availabilityId },
  });

  return { deleted: true, id: availabilityId };
}

export interface UpdateAvailabilityData {
  quantityAvailable?: number;
  avgWeight?: number | null;
  readyDate?: Date;
}

/**
 * Update an existing weekly availability record.
 * Only the owning farmer can update; optional: restrict to current/future week.
 */
export async function updateWeeklyAvailability(
  availabilityId: string,
  farmerId: string,
  data: UpdateAvailabilityData
) {
  const existing = await prisma.weeklyAvailability.findUnique({
    where: { id: availabilityId },
  });

  if (!existing) {
    throw createError('Availability record not found', 404, 'NOT_FOUND');
  }

  if (existing.farmerId !== farmerId) {
    throw createError('You can only update your own availability', 403, 'FORBIDDEN');
  }

  const weekStartDate = getWeekStartDate();
  if (existing.weekStartDate < weekStartDate) {
    throw createError(
      'You can only update availability for the current week or future weeks',
      400,
      'PAST_WEEK'
    );
  }

  const updateData: Record<string, unknown> = {};

  if (data.quantityAvailable !== undefined) {
    if (data.quantityAvailable <= 0) {
      throw createError(
        'Quantity available must be greater than 0',
        400,
        'INVALID_QUANTITY'
      );
    }
    updateData.quantityAvailable = data.quantityAvailable;
  }

  if (data.avgWeight !== undefined) {
    updateData.avgWeight = data.avgWeight;
  }

  if (data.readyDate !== undefined) {
    if (data.readyDate <= new Date()) {
      throw createError(
        'Ready date must be in the future',
        400,
        'INVALID_READY_DATE'
      );
    }
    updateData.readyDate = data.readyDate;
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(
      'Provide at least one field to update (quantityAvailable, avgWeight, or readyDate)',
      400,
      'NO_CHANGES'
    );
  }

  const updated = await prisma.weeklyAvailability.update({
    where: { id: availabilityId },
    data: updateData,
  });

  return updated;
}

/**
 * Delete a weekly availability record.
 * Only the owning farmer can delete; only current or future week.
 */
export async function deleteWeeklyAvailability(
  availabilityId: string,
  farmerId: string
) {
  const existing = await prisma.weeklyAvailability.findUnique({
    where: { id: availabilityId },
  });

  if (!existing) {
    throw createError('Availability record not found', 404, 'NOT_FOUND');
  }

  if (existing.farmerId !== farmerId) {
    throw createError('You can only delete your own availability', 403, 'FORBIDDEN');
  }

  const weekStartDate = getWeekStartDate();
  if (existing.weekStartDate < weekStartDate) {
    throw createError(
      'You can only delete availability for the current week or future weeks',
      400,
      'PAST_WEEK'
    );
  }

  await prisma.weeklyAvailability.delete({
    where: { id: availabilityId },
  });

  return { deleted: true, id: availabilityId };
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
    estimatedTimeWindow: assignment.estimatedTimeWindow,
    quantityDelivered: assignment.quantityDelivered,
    confirmationNotes: assignment.confirmationNotes,
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
    estimatedTimeWindow: assignment.estimatedTimeWindow,
    quantityDelivered: assignment.quantityDelivered,
    confirmationNotes: assignment.confirmationNotes,
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

/**
 * Update a delivery assignment (farmer can only set estimated time window).
 * Only PENDING assignments; only the assigned farmer.
 */
export async function updateDeliveryAssignment(
  assignmentId: string,
  farmerId: string,
  data: { estimatedTimeWindow?: string | null }
) {
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { id: assignmentId, farmerId },
  });

  if (!assignment) {
    throw createError('Delivery assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  if (assignment.status !== 'PENDING') {
    throw createError(
      'Only pending deliveries can be updated',
      400,
      'NOT_PENDING'
    );
  }

  const updateData: { estimatedTimeWindow?: string | null } = {};
  if (data.estimatedTimeWindow !== undefined) {
    updateData.estimatedTimeWindow =
      data.estimatedTimeWindow === '' || data.estimatedTimeWindow === null
        ? null
        : String(data.estimatedTimeWindow).trim();
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(
      'Provide estimatedTimeWindow to update',
      400,
      'NO_CHANGES'
    );
  }

  return prisma.deliveryAssignment.update({
    where: { id: assignmentId },
    data: updateData,
  });
}

/**
 * Cancel (decline) a delivery assignment.
 * Only PENDING assignments; only the assigned farmer.
 */
export async function cancelDeliveryAssignment(assignmentId: string, farmerId: string) {
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { id: assignmentId, farmerId },
  });

  if (!assignment) {
    throw createError('Delivery assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  if (assignment.status !== 'PENDING') {
    throw createError(
      'Only pending deliveries can be cancelled',
      400,
      'NOT_PENDING'
    );
  }

  return prisma.deliveryAssignment.update({
    where: { id: assignmentId },
    data: { status: 'CANCELLED' },
  });
}

/**
 * Submit delivery confirmation (quantity delivered + notes).
 * Farmer submits for admin to confirm; status stays PENDING.
 * Only PENDING assignments; only the assigned farmer.
 */
export async function submitDeliveryConfirmation(
  assignmentId: string,
  farmerId: string,
  data: { quantityDelivered: number; notes?: string | null }
) {
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { id: assignmentId, farmerId },
  });

  if (!assignment) {
    throw createError('Delivery assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  if (assignment.status !== 'PENDING') {
    throw createError(
      'Only pending deliveries can have confirmation submitted',
      400,
      'NOT_PENDING'
    );
  }

  const { quantityDelivered, notes } = data;
  if (quantityDelivered < 0) {
    throw createError('Quantity delivered cannot be negative', 400, 'INVALID_QUANTITY');
  }
  if (quantityDelivered > assignment.assignedQuantity) {
    throw createError(
      `Quantity delivered cannot exceed assigned quantity (${assignment.assignedQuantity})`,
      400,
      'INVALID_QUANTITY'
    );
  }

  return prisma.deliveryAssignment.update({
    where: { id: assignmentId },
    data: {
      quantityDelivered,
      confirmationNotes: notes === '' || notes === undefined ? null : String(notes).trim(),
    },
  });
}

