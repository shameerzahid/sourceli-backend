import { prisma } from '../config/database.js';
import { UserStatus, OrderStatus, AssignmentStatus, PaymentStatus } from '@prisma/client';

export interface ApproveFarmerData {
  adminNotes?: string;
}

export interface RejectFarmerData {
  rejectionReason: string;
  adminNotes?: string;
}

export interface ApproveBuyerData {
  adminNotes?: string;
}

export interface RejectBuyerData {
  rejectionReason: string;
  adminNotes?: string;
}

/**
 * Get all pending farmer applications
 */
export async function getPendingFarmerApplications() {
  const applications = await prisma.farmerApplication.findMany({
    where: {
      status: UserStatus.APPLIED,
    },
    include: {
      farmer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          farmPhotos: {
            select: {
              id: true,
              filePath: true,
              fileType: true,
              uploadedAt: true,
            },
          },
        },
      },
    },
    orderBy: {
      submittedAt: 'asc',
    },
  });

  return applications;
}

/**
 * Get a specific farmer application by ID
 */
export async function getFarmerApplicationById(applicationId: string) {
  const application = await prisma.farmerApplication.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      farmer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          farmPhotos: {
            select: {
              id: true,
              filePath: true,
              fileType: true,
              uploadedAt: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    throw new Error('Farmer application not found');
  }

  return application;
}

/**
 * Approve a farmer application
 */
export async function approveFarmerApplication(
  applicationId: string,
  adminId: string,
  data: ApproveFarmerData
) {
  // Get the application
  const application = await prisma.farmerApplication.findUnique({
    where: { id: applicationId },
    include: { farmer: { include: { user: true } } },
  });

  if (!application) {
    throw new Error('Farmer application not found');
  }

  if (application.status !== UserStatus.APPLIED) {
    throw new Error(
      `Cannot approve application with status: ${application.status}`
    );
  }

  // Update application and user status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update farmer application
    const updatedApplication = await tx.farmerApplication.update({
      where: { id: applicationId },
      data: {
        status: UserStatus.PROBATIONARY, // Farmers start in probationary period
        reviewedAt: new Date(),
        adminNotes: data.adminNotes || null,
        rejectionReason: null,
      },
    });

    // Update farmer verification info
    await tx.farmer.update({
      where: { id: application.farmerId },
      data: {
        verificationDate: new Date(),
        verificationAdminId: adminId,
      },
    });

    // Update user status
    await tx.user.update({
      where: { id: application.farmer.userId },
      data: {
        status: UserStatus.PROBATIONARY,
      },
    });

    return updatedApplication;
  });

  return result;
}

/**
 * Reject a farmer application
 */
export async function rejectFarmerApplication(
  applicationId: string,
  adminId: string,
  data: RejectFarmerData
) {
  // Get the application
  const application = await prisma.farmerApplication.findUnique({
    where: { id: applicationId },
    include: { farmer: { include: { user: true } } },
  });

  if (!application) {
    throw new Error('Farmer application not found');
  }

  if (application.status !== UserStatus.APPLIED) {
    throw new Error(
      `Cannot reject application with status: ${application.status}`
    );
  }

  // Update application and user status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update farmer application
    const updatedApplication = await tx.farmerApplication.update({
      where: { id: applicationId },
      data: {
        status: UserStatus.BLOCKED,
        reviewedAt: new Date(),
        adminNotes: data.adminNotes || null,
        rejectionReason: data.rejectionReason,
      },
    });

    // Update user status
    await tx.user.update({
      where: { id: application.farmer.userId },
      data: {
        status: UserStatus.BLOCKED,
      },
    });

    return updatedApplication;
  });

  return result;
}

/**
 * Get all pending buyer registrations
 */
export async function getPendingBuyerRegistrations() {
  const registrations = await prisma.buyerRegistration.findMany({
    where: {
      status: UserStatus.PENDING,
    },
    include: {
      buyer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          deliveryAddresses: {
            select: {
              id: true,
              address: true,
              landmark: true,
              isDefault: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: {
      submittedAt: 'asc',
    },
  });

  return registrations;
}

/**
 * Get a specific buyer registration by ID
 */
export async function getBuyerRegistrationById(registrationId: string) {
  const registration = await prisma.buyerRegistration.findUnique({
    where: {
      id: registrationId,
    },
    include: {
      buyer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          deliveryAddresses: {
            select: {
              id: true,
              address: true,
              landmark: true,
              isDefault: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!registration) {
    throw new Error('Buyer registration not found');
  }

  return registration;
}

/**
 * Approve a buyer registration
 */
export async function approveBuyerRegistration(
  registrationId: string,
  adminId: string,
  data: ApproveBuyerData
) {
  // Get the registration
  const registration = await prisma.buyerRegistration.findUnique({
    where: { id: registrationId },
    include: { buyer: { include: { user: true } } },
  });

  if (!registration) {
    throw new Error('Buyer registration not found');
  }

  if (registration.status !== UserStatus.PENDING) {
    throw new Error(
      `Cannot approve registration with status: ${registration.status}`
    );
  }

  // Update registration and user status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update buyer registration
    const updatedRegistration = await tx.buyerRegistration.update({
      where: { id: registrationId },
      data: {
        status: UserStatus.ACTIVE,
        reviewedAt: new Date(),
        adminNotes: data.adminNotes || null,
        rejectionReason: null,
      },
    });

    // Update buyer verification info
    await tx.buyer.update({
      where: { id: registration.buyerId },
      data: {
        verificationDate: new Date(),
        verificationAdminId: adminId,
      },
    });

    // Update user status
    await tx.user.update({
      where: { id: registration.buyer.userId },
      data: {
        status: UserStatus.ACTIVE,
      },
    });

    return updatedRegistration;
  });

  return result;
}

/**
 * Reject a buyer registration
 */
export async function rejectBuyerRegistration(
  registrationId: string,
  adminId: string,
  data: RejectBuyerData
) {
  // Get the registration
  const registration = await prisma.buyerRegistration.findUnique({
    where: { id: registrationId },
    include: { buyer: { include: { user: true } } },
  });

  if (!registration) {
    throw new Error('Buyer registration not found');
  }

  if (registration.status !== UserStatus.PENDING) {
    throw new Error(
      `Cannot reject registration with status: ${registration.status}`
    );
  }

  // Update registration and user status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update buyer registration
    const updatedRegistration = await tx.buyerRegistration.update({
      where: { id: registrationId },
      data: {
        status: UserStatus.BLOCKED,
        reviewedAt: new Date(),
        adminNotes: data.adminNotes || null,
        rejectionReason: data.rejectionReason,
      },
    });

    // Update user status
    await tx.user.update({
      where: { id: registration.buyer.userId },
      data: {
        status: UserStatus.BLOCKED,
      },
    });

    return updatedRegistration;
  });

  return result;
}

/**
 * Get all farmers with their status
 */
export async function getAllFarmers(filters?: {
  status?: UserStatus;
  region?: string;
  produceCategory?: string;
}) {
  const where: any = {};

  if (filters?.status) {
    where.user = { status: filters.status };
  }
  if (filters?.region) {
    where.region = filters.region;
  }
  if (filters?.produceCategory) {
    where.produceCategory = filters.produceCategory;
  }

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      application: {
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
        },
      },
      performance: true,
      performanceBreakdown: true,
    },
    orderBy: {
      user: {
        createdAt: 'desc',
      },
    },
  });

  return farmers;
}

/**
 * Get all buyers with their status
 */
export async function getAllBuyers(filters?: {
  status?: UserStatus;
  buyerType?: string;
}) {
  const where: any = {};

  if (filters?.status) {
    where.user = { status: filters.status };
  }
  if (filters?.buyerType) {
    where.buyerType = filters.buyerType;
  }

  const buyers = await prisma.buyer.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      registration: {
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
        },
      },
    },
    orderBy: {
      user: {
        createdAt: 'desc',
      },
    },
  });

  return buyers;
}

/**
 * Update farmer status (admin action)
 */
export async function updateFarmerStatus(
  farmerId: string,
  newStatus: UserStatus,
  adminId: string
) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: { user: true },
  });

  if (!farmer) {
    throw new Error('Farmer not found');
  }

  // Update user status
  const updatedUser = await prisma.user.update({
    where: { id: farmer.userId },
    data: {
      status: newStatus,
    },
  });

  // If status is ACTIVE or PROBATIONARY, update verification info
  if (newStatus === UserStatus.ACTIVE || newStatus === UserStatus.PROBATIONARY) {
    await prisma.farmer.update({
      where: { id: farmerId },
      data: {
        verificationDate: new Date(),
        verificationAdminId: adminId,
      },
    });
  }

  return updatedUser;
}

/**
 * Update buyer status (admin action)
 */
export async function updateBuyerStatus(
  buyerId: string,
  newStatus: UserStatus,
  adminId: string
) {
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    include: { user: true },
  });

  if (!buyer) {
    throw new Error('Buyer not found');
  }

  // Update user status
  const updatedUser = await prisma.user.update({
    where: { id: buyer.userId },
    data: {
      status: newStatus,
    },
  });

  // If status is ACTIVE, update verification info
  if (newStatus === UserStatus.ACTIVE) {
    await prisma.buyer.update({
      where: { id: buyerId },
      data: {
        verificationDate: new Date(),
        verificationAdminId: adminId,
      },
    });
  }

  return updatedUser;
}

/**
 * Get admin dashboard statistics with comprehensive data and charts
 */
export async function getAdminStats() {
  try {
    console.log("Starting getAdminStats...");
    
    // Calculate date ranges for charts (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get all stats in parallel for better performance
    const [
      pendingApplications,
      pendingRegistrations,
      activeFarmers,
      activeBuyers,
      totalFarmers,
      totalBuyers,
      // Order stats
      pendingOrders,
      approvedOrders,
      deliveredOrders,
      failedOrders,
      totalOrders,
      // Delivery stats
      pendingDeliveries,
      deliveredDeliveries,
      failedDeliveries,
      totalDeliveries,
      // Payment stats
      totalPayments,
      totalPaid,
      totalOwed,
      outstandingBalance,
      // Chart data - registrations over time
      farmerRegistrationsData,
      buyerRegistrationsData,
      // Chart data - orders over time
      ordersData,
      // Chart data - deliveries over time
      deliveriesData,
    ] = await Promise.all([
      // Count pending farmer applications
      prisma.farmerApplication.count({
        where: { status: UserStatus.APPLIED },
      }).catch(() => 0),
      // Count pending buyer registrations
      prisma.buyerRegistration.count({
        where: { status: UserStatus.PENDING },
      }).catch(() => 0),
      // Count active farmers
      prisma.farmer.count({
        where: { user: { status: UserStatus.ACTIVE } },
      }).catch(() => 0),
      // Count active buyers
      prisma.buyer.count({
        where: { user: { status: UserStatus.ACTIVE } },
      }).catch(() => 0),
      // Total farmers (all statuses)
      prisma.farmer.count().catch(() => 0),
      // Total buyers (all statuses)
      prisma.buyer.count().catch(() => 0),
      // Order stats
      prisma.order.count({ where: { status: OrderStatus.PENDING } }).catch(() => 0),
      prisma.order.count({ where: { status: OrderStatus.APPROVED } }).catch(() => 0),
      prisma.order.count({ where: { status: OrderStatus.DELIVERED } }).catch(() => 0),
      prisma.order.count({ where: { status: OrderStatus.FAILED } }).catch(() => 0),
      prisma.order.count().catch(() => 0),
      // Delivery stats
      prisma.deliveryAssignment.count({ where: { status: AssignmentStatus.PENDING } }).catch(() => 0),
      prisma.deliveryAssignment.count({ where: { status: AssignmentStatus.DELIVERED } }).catch(() => 0),
      prisma.deliveryAssignment.count({ where: { status: AssignmentStatus.FAILED } }).catch(() => 0),
      prisma.deliveryAssignment.count().catch(() => 0),
      // Payment stats
      prisma.payment.count().catch(() => 0),
      prisma.payment.aggregate({
        _sum: { amountPaid: true },
      }).then(r => r._sum.amountPaid || 0).catch(() => 0),
      prisma.payment.aggregate({
        _sum: { amountOwed: true },
      }).then(r => r._sum.amountOwed || 0).catch(() => 0),
      prisma.payment.aggregate({
        _sum: { amountOwed: true, amountPaid: true },
      }).then(r => (r._sum.amountOwed || 0) - (r._sum.amountPaid || 0)).catch(() => 0),
      // Get farmer registrations over last 30 days (grouped by day)
      getRegistrationsChartData('farmer', thirtyDaysAgo, now),
      // Get buyer registrations over last 30 days (grouped by day)
      getRegistrationsChartData('buyer', thirtyDaysAgo, now),
      // Get orders over last 30 days (grouped by day)
      getOrdersChartData(thirtyDaysAgo, now),
      // Get deliveries over last 30 days (grouped by day)
      getDeliveriesChartData(thirtyDaysAgo, now),
    ]);

    const stats = {
      // User stats
      pendingFarmerApplications: pendingApplications,
      pendingBuyerRegistrations: pendingRegistrations,
      activeFarmers,
      activeBuyers,
      totalFarmers,
      totalBuyers,
      // Order stats
      orders: {
        pending: pendingOrders,
        approved: approvedOrders,
        delivered: deliveredOrders,
        failed: failedOrders,
        total: totalOrders,
      },
      // Delivery stats
      deliveries: {
        pending: pendingDeliveries,
        delivered: deliveredDeliveries,
        failed: failedDeliveries,
        total: totalDeliveries,
      },
      // Payment stats
      payments: {
        total: totalPayments,
        totalPaid,
        totalOwed,
        outstandingBalance,
      },
      // Chart data
      charts: {
        farmerRegistrations: farmerRegistrationsData,
        buyerRegistrations: buyerRegistrationsData,
        orders: ordersData,
        deliveries: deliveriesData,
      },
    };

    console.log("Admin stats calculated:", stats);
    return stats;
  } catch (error) {
    console.error("Error in getAdminStats service:", error);
    throw error;
  }
}

/**
 * Get registrations chart data grouped by day
 */
async function getRegistrationsChartData(
  type: 'farmer' | 'buyer',
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; count: number }>> {
  try {
    let data: Array<{ submittedAt: Date }>;
    
    if (type === 'farmer') {
      data = await prisma.farmerApplication.findMany({
        where: {
          submittedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { submittedAt: true },
      });
    } else {
      data = await prisma.buyerRegistration.findMany({
        where: {
          submittedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { submittedAt: true },
      });
    }

    // Group by day
    const grouped = new Map<string, number>();
    data.forEach((item) => {
      const dateKey = item.submittedAt.toISOString().split('T')[0];
      grouped.set(dateKey, (grouped.get(dateKey) || 0) + 1);
    });

    // Fill in missing days with 0
    const result: Array<{ date: string; count: number }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        count: grouped.get(dateKey) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error(`Error getting ${type} registrations chart data:`, error);
    return [];
  }
}

/**
 * Get orders chart data grouped by day
 */
async function getOrdersChartData(
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; pending: number; approved: number; delivered: number; failed: number }>> {
  try {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    // Group by day and status
    const grouped = new Map<string, { pending: number; approved: number; delivered: number; failed: number }>();
    
    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = grouped.get(dateKey) || { pending: 0, approved: 0, delivered: 0, failed: 0 };
      
      switch (order.status) {
        case OrderStatus.PENDING:
          existing.pending++;
          break;
        case OrderStatus.APPROVED:
        case OrderStatus.ALLOCATION:
          existing.approved++;
          break;
        case OrderStatus.DELIVERED:
          existing.delivered++;
          break;
        case OrderStatus.FAILED:
        case OrderStatus.REJECTED:
          existing.failed++;
          break;
      }
      
      grouped.set(dateKey, existing);
    });

    // Fill in missing days
    const result: Array<{ date: string; pending: number; approved: number; delivered: number; failed: number }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const data = grouped.get(dateKey) || { pending: 0, approved: 0, delivered: 0, failed: 0 };
      result.push({
        date: dateKey,
        ...data,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error("Error getting orders chart data:", error);
    return [];
  }
}

/**
 * Get deliveries chart data grouped by day
 */
async function getDeliveriesChartData(
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; pending: number; delivered: number; failed: number }>> {
  try {
    const deliveries = await prisma.deliveryAssignment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    // Group by day and status
    const grouped = new Map<string, { pending: number; delivered: number; failed: number }>();
    
    deliveries.forEach((delivery) => {
      const dateKey = delivery.createdAt.toISOString().split('T')[0];
      const existing = grouped.get(dateKey) || { pending: 0, delivered: 0, failed: 0 };
      
      switch (delivery.status) {
        case AssignmentStatus.PENDING:
          existing.pending++;
          break;
        case AssignmentStatus.DELIVERED:
          existing.delivered++;
          break;
        case AssignmentStatus.FAILED:
          existing.failed++;
          break;
      }
      
      grouped.set(dateKey, existing);
    });

    // Fill in missing days
    const result: Array<{ date: string; pending: number; delivered: number; failed: number }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const data = grouped.get(dateKey) || { pending: 0, delivered: 0, failed: 0 };
      result.push({
        date: dateKey,
        ...data,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error("Error getting deliveries chart data:", error);
    return [];
  }
}

