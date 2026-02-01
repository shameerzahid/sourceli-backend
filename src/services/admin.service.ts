import { prisma } from '../config/database.js';
import { UserStatus } from '@prisma/client';

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
 * Get admin dashboard statistics
 */
export async function getAdminStats() {
  try {
    console.log("Starting getAdminStats...");
    
    // Get all stats in parallel for better performance
    const [
      pendingApplications,
      pendingRegistrations,
      activeFarmers,
      activeBuyers,
    ] = await Promise.all([
      // Count pending farmer applications
      prisma.farmerApplication.count({
        where: {
          status: UserStatus.APPLIED,
        },
      }).catch((err) => {
        console.error("Error counting pending applications:", err);
        return 0;
      }),
      // Count pending buyer registrations
      prisma.buyerRegistration.count({
        where: {
          status: UserStatus.PENDING,
        },
      }).catch((err) => {
        console.error("Error counting pending registrations:", err);
        return 0;
      }),
      // Count active farmers
      prisma.farmer.count({
        where: {
          user: {
            status: UserStatus.ACTIVE,
          },
        },
      }).catch((err) => {
        console.error("Error counting active farmers:", err);
        return 0;
      }),
      // Count active buyers
      prisma.buyer.count({
        where: {
          user: {
            status: UserStatus.ACTIVE,
          },
        },
      }).catch((err) => {
        console.error("Error counting active buyers:", err);
        return 0;
      }),
    ]);

    const stats = {
      pendingFarmerApplications: pendingApplications,
      pendingBuyerRegistrations: pendingRegistrations,
      activeFarmers,
      activeBuyers,
    };

    console.log("Admin stats calculated:", stats);
    return stats;
  } catch (error) {
    console.error("Error in getAdminStats service:", error);
    throw error;
  }
}

