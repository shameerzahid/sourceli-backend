import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { OrderStatus, AssignmentStatus, UserStatus } from '@prisma/client';
import { getWeekStartDate } from '../utils/weekCalculation.js';

export interface AllocationAssignment {
  farmerId: string;
  assignedQuantity: number;
}

export interface CreateAllocationData {
  orderId: string;
  assignments: AllocationAssignment[];
}

/**
 * Get allocation screen data
 * Returns pending orders with available farmers and their availability
 */
export async function getAllocationData() {
  // Get all pending orders (status: ALLOCATION)
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.ALLOCATION,
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
    orderBy: {
      deliveryDate: 'asc',
    },
  });

  // Get current week start for availability lookup
  const currentWeekStart = getWeekStartDate();

  // Get all active farmers with their current week availability
  const farmers = await prisma.farmer.findMany({
    where: {
      user: {
        status: {
          in: [UserStatus.ACTIVE, UserStatus.PROBATIONARY],
        },
      },
    },
    include: {
      user: {
        select: {
          email: true,
          phone: true,
          status: true,
        },
      },
      weeklyAvailability: {
        where: {
          weekStartDate: currentWeekStart,
        },
      },
    },
  });

  // Format farmers with availability data
  const farmersWithAvailability = farmers.map((farmer) => {
    const availability = farmer.weeklyAvailability || [];
    return {
      id: farmer.id,
      fullName: farmer.fullName,
      farmName: farmer.farmName,
      region: farmer.region,
      town: farmer.town,
      produceCategory: farmer.produceCategory,
      weeklyCapacityMin: farmer.weeklyCapacityMin,
      weeklyCapacityMax: farmer.weeklyCapacityMax,
      availability: availability.map((av) => ({
        productType: av.productType,
        quantityAvailable: av.quantityAvailable,
        avgWeight: av.avgWeight,
        readyDate: av.readyDate,
        isLate: av.isLate,
      })),
      user: farmer.user,
    };
  });

  return {
    orders,
    farmers: farmersWithAvailability,
    currentWeekStart,
  };
}

/**
 * Create delivery assignments from allocation
 * Validates that total assigned quantity doesn't exceed order quantity
 */
export async function createDeliveryAssignments(
  orderId: string,
  adminId: string,
  data: CreateAllocationData
) {
  // Verify order exists and is in ALLOCATION status
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: {
        include: {
          user: true,
        },
      },
      deliveryAddress: true,
      assignments: true,
    },
  });

  if (!order) {
    throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== OrderStatus.ALLOCATION) {
    throw createError(
      `Order is not in ALLOCATION status. Current status: ${order.status}`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  // Check if order already has assignments
  if (order.assignments.length > 0) {
    throw createError(
      'Order already has assignments. Use update endpoint to modify.',
      400,
      'ALREADY_ALLOCATED'
    );
  }

  // Validate assignments
  const totalAssigned = data.assignments.reduce(
    (sum, assignment) => sum + assignment.assignedQuantity,
    0
  );

  if (totalAssigned > order.quantity) {
    throw createError(
      `Total assigned quantity (${totalAssigned}) exceeds order quantity (${order.quantity})`,
      400,
      'OVER_ALLOCATION'
    );
  }

  if (totalAssigned <= 0) {
    throw createError(
      'Total assigned quantity must be greater than 0',
      400,
      'INVALID_QUANTITY'
    );
  }

  // Verify all farmers exist and are active
  const farmerIds = data.assignments.map((a) => a.farmerId);
  const farmers = await prisma.farmer.findMany({
    where: {
      id: { in: farmerIds },
      user: {
        status: {
          in: [UserStatus.ACTIVE, UserStatus.PROBATIONARY],
        },
      },
    },
    include: {
      user: {
        select: {
          status: true,
        },
      },
    },
  });

  if (farmers.length !== farmerIds.length) {
    const foundIds = farmers.map((f) => f.id);
    const missingIds = farmerIds.filter((id) => !foundIds.includes(id));
    throw createError(
      `Some farmers not found or not active: ${missingIds.join(', ')}`,
      404,
      'FARMER_NOT_FOUND'
    );
  }

  // Create delivery assignments in a transaction
  const assignments = await prisma.$transaction(
    data.assignments.map((assignment) =>
      prisma.deliveryAssignment.create({
        data: {
          orderId: order.id,
          farmerId: assignment.farmerId,
          assignedQuantity: assignment.assignedQuantity,
          deliveryDate: order.deliveryDate,
          deliveryAddressId: order.deliveryAddressId,
          status: AssignmentStatus.PENDING,
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
          deliveryAddress: true,
        },
      })
    )
  );

  return {
    order,
    assignments,
    totalAssigned,
    remainingQuantity: order.quantity - totalAssigned,
  };
}

/**
 * Update an existing assignment
 */
export async function updateAssignment(
  assignmentId: string,
  adminId: string,
  assignedQuantity: number
) {
  const assignment = await prisma.deliveryAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      order: true,
      farmer: true,
    },
  });

  if (!assignment) {
    throw createError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  // Can only update if status is PENDING
  if (assignment.status !== AssignmentStatus.PENDING) {
    throw createError(
      `Cannot update assignment with status: ${assignment.status}`,
      400,
      'INVALID_ASSIGNMENT_STATUS'
    );
  }

  // Validate quantity
  if (assignedQuantity <= 0) {
    throw createError(
      'Assigned quantity must be greater than 0',
      400,
      'INVALID_QUANTITY'
    );
  }

  // Calculate total assigned quantity for the order
  const allAssignments = await prisma.deliveryAssignment.findMany({
    where: {
      orderId: assignment.orderId,
      id: { not: assignmentId },
    },
  });

  const totalOtherAssignments = allAssignments.reduce(
    (sum, a) => sum + a.assignedQuantity,
    0
  );
  const newTotal = totalOtherAssignments + assignedQuantity;

  if (newTotal > assignment.order.quantity) {
    throw createError(
      `Total assigned quantity (${newTotal}) would exceed order quantity (${assignment.order.quantity})`,
      400,
      'OVER_ALLOCATION'
    );
  }

  // Update assignment
  const updated = await prisma.deliveryAssignment.update({
    where: { id: assignmentId },
    data: {
      assignedQuantity,
    },
    include: {
      order: true,
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
      deliveryAddress: true,
    },
  });

  return updated;
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(assignmentId: string, adminId: string) {
  const assignment = await prisma.deliveryAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw createError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  // Can only delete if status is PENDING
  if (assignment.status !== AssignmentStatus.PENDING) {
    throw createError(
      `Cannot delete assignment with status: ${assignment.status}`,
      400,
      'INVALID_ASSIGNMENT_STATUS'
    );
  }

  await prisma.deliveryAssignment.delete({
    where: { id: assignmentId },
  });

  return { success: true };
}

