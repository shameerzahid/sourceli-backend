import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { OrderStatus, AssignmentStatus, UserStatus, QualityResult } from '@prisma/client';
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
      assignments: {
        include: {
          farmer: {
            select: {
              id: true,
              fullName: true,
              farmName: true,
            },
          },
        },
      },
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
      feedingMethod: farmer.feedingMethod,
      userStatus: farmer.user.status,
      weeklyCapacityMin: farmer.weeklyCapacityMin,
      weeklyCapacityMax: farmer.weeklyCapacityMax,
      weeklyAvailability: availability.map((av) => ({
        id: av.id,
        productType: av.productType,
        quantityAvailable: av.quantityAvailable,
        avgWeight: av.avgWeight,
        readyDate: av.readyDate.toISOString(),
        isLate: av.isLate,
      })),
      user: farmer.user,
    };
  });

  return {
    pendingOrders: orders,
    availableFarmers: farmersWithAvailability,
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

/**
 * Confirm a delivery assignment (US-ADMIN-008)
 * Admin confirms delivery and quality, updates assignment status
 */
export interface ConfirmDeliveryData {
  delivered: boolean; // Yes/No
  quantityDelivered?: number;
  qualityResult?: 'PASS' | 'PARTIAL' | 'FAIL';
  notes?: string;
}

export async function confirmDelivery(
  assignmentId: string,
  adminId: string,
  data: ConfirmDeliveryData
) {
  const assignment = await prisma.deliveryAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      order: {
        include: {
          assignments: true,
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
  });

  if (!assignment) {
    throw createError('Delivery assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  // Validate quantity delivered
  if (data.delivered && data.quantityDelivered !== undefined) {
    if (data.quantityDelivered < 0) {
      throw createError(
        'Quantity delivered cannot be negative',
        400,
        'INVALID_QUANTITY'
      );
    }
    if (data.quantityDelivered > assignment.assignedQuantity) {
      throw createError(
        `Quantity delivered (${data.quantityDelivered}) cannot exceed assigned quantity (${assignment.assignedQuantity})`,
        400,
        'INVALID_QUANTITY'
      );
    }
  }

  // Update assignment status and confirmation fields
  const status = data.delivered ? AssignmentStatus.DELIVERED : AssignmentStatus.FAILED;
  
  const updated = await prisma.deliveryAssignment.update({
    where: { id: assignmentId },
    data: {
      status,
      quantityDelivered: data.quantityDelivered ?? (data.delivered ? assignment.assignedQuantity : null),
      qualityResult: data.qualityResult ?? null,
      confirmationNotes: data.notes ?? null,
      confirmedBy: adminId,
      confirmedAt: new Date(),
    },
    include: {
      order: {
        include: {
          assignments: true,
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
      deliveryAddress: true,
    },
  });

  // Check if all assignments for this order are delivered
  const allAssignments = updated.order.assignments;
  const allDelivered = allAssignments.every(a => a.status === AssignmentStatus.DELIVERED);
  const anyFailed = allAssignments.some(a => a.status === AssignmentStatus.FAILED);
  
  // Update order status if all deliveries are confirmed
  if (allDelivered && allAssignments.length > 0) {
    await prisma.order.update({
      where: { id: updated.orderId },
      data: {
        status: OrderStatus.DELIVERED,
      },
    });
  } else if (anyFailed && allAssignments.every(a => 
    a.status === AssignmentStatus.DELIVERED || a.status === AssignmentStatus.FAILED
  )) {
    // If all assignments are either delivered or failed, mark order as delivered (partial delivery)
    await prisma.order.update({
      where: { id: updated.orderId },
      data: {
        status: OrderStatus.DELIVERED,
      },
    });
  }

  // Update farmer performance score after delivery confirmation
  try {
    const { updatePerformanceScore } = await import('./performance.service.js');
    const reason = data.delivered 
      ? `Delivery confirmed: ${data.qualityResult || 'Quality not assessed'}`
      : 'Delivery failed';
    await updatePerformanceScore(
      updated.farmerId,
      reason,
      assignmentId,
      adminId
    );
  } catch (error) {
    // Log error but don't fail the delivery confirmation
    console.error('Error updating performance score:', error);
  }

  return updated;
}

/**
 * Get all delivery assignments for admin (pending and completed)
 */
export async function getAllDeliveryAssignments(filters?: {
  status?: AssignmentStatus;
  orderId?: string;
  farmerId?: string;
}) {
  const where: any = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.orderId) {
    where.orderId = filters.orderId;
  }

  if (filters?.farmerId) {
    where.farmerId = filters.farmerId;
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
    orderBy: {
      deliveryDate: 'asc',
    },
  });

  return assignments;
}

