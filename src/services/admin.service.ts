import { prisma } from '../config/database.js';
import { UserStatus, UserRole, PerformanceTier, OrderStatus, AssignmentStatus, PaymentStatus, TicketStatus } from '@prisma/client';
import { notifyUser } from './notificationDelivery.service.js';
import { hashPassword } from '../utils/password.js';
import { toE164 } from '../utils/validation.js';
import { createError } from '../middleware/errorHandler.js';
import { createAuditLog } from '../utils/auditLog.js';

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
              avatarUrl: true,
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
          farmCertificates: {
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
              avatarUrl: true,
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
          farmCertificates: {
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

  await notifyUser(
    application.farmer.userId,
    'APPLICATION_REVIEWED',
    'Application approved',
    'Your farmer application has been approved. You can now access your dashboard and submit weekly availability.',
    { applicationId }
  ).catch((err) => console.error('[Notification]', err));

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

  await notifyUser(
    application.farmer.userId,
    'APPLICATION_REJECTED',
    'Application not approved',
    data.rejectionReason || 'Your farmer application was not approved. Please contact support for more information.',
    { applicationId, rejectionReason: data.rejectionReason }
  ).catch((err) => console.error('[Notification]', err));

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
              avatarUrl: true,
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
          buyerDocuments: {
            select: {
              id: true,
              filePath: true,
              fileType: true,
              documentType: true,
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
              avatarUrl: true,
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
          buyerDocuments: {
            select: {
              id: true,
              filePath: true,
              fileType: true,
              documentType: true,
              uploadedAt: true,
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

  await notifyUser(
    registration.buyer.userId,
    'REGISTRATION_APPROVED',
    'Registration approved',
    'Your buyer registration has been approved. You can now place orders.',
    { registrationId }
  ).catch((err) => console.error('[Notification]', err));

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

  await notifyUser(
    registration.buyer.userId,
    'REGISTRATION_REJECTED',
    'Registration not approved',
    data.rejectionReason || 'Your buyer registration was not approved. Please contact support.',
    { registrationId, rejectionReason: data.rejectionReason }
  ).catch((err) => console.error('[Notification]', err));

  return result;
}

export interface CreateSupplierAsAdminData {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  farmName?: string;
  region: string;
  town: string;
  weeklyCapacityMin: number;
  weeklyCapacityMax: number;
  produceCategory: string;
  feedingMethod: string;
  termsAccepted?: boolean;
  photoUrls?: string[];
  certificateUrls?: string[];
  avatarUrl?: string | null;
}

/**
 * Create a supplier (farmer) manually as admin. No approval step: the supplier is created
 * as already approved (User status PROBATIONARY, FarmerApplication PROBATIONARY with reviewedAt,
 * FarmerPerformance score 50). They can log in immediately with the password provided.
 */
export async function createSupplierAsAdmin(
  adminId: string,
  data: CreateSupplierAsAdminData
): Promise<{ userId: string; farmerId: string; applicationId: string }> {
  const phoneE164 = toE164(data.phone);
  if (!phoneE164) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: phoneE164 }, { phone: data.phone }],
    },
  });

  if (existingUser) {
    throw createError(
      'Email or phone number already registered',
      409,
      'DUPLICATE_USER'
    );
  }

  const passwordHash = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        phone: phoneE164,
        passwordHash,
        role: UserRole.FARMER,
        status: UserStatus.PROBATIONARY,
        avatarUrl: data.avatarUrl?.trim() || null,
      },
    });

    const farmer = await tx.farmer.create({
      data: {
        userId: user.id,
        fullName: data.fullName,
        farmName: data.farmName,
        region: data.region,
        town: data.town,
        weeklyCapacityMin: data.weeklyCapacityMin,
        weeklyCapacityMax: data.weeklyCapacityMax,
        produceCategory: data.produceCategory,
        feedingMethod: data.feedingMethod,
        verificationDate: new Date(),
        verificationAdminId: adminId,
      },
    });

    const application = await tx.farmerApplication.create({
      data: {
        farmerId: farmer.id,
        status: UserStatus.PROBATIONARY,
        termsAccepted: data.termsAccepted ?? true,
        termsAcceptedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    await tx.farmerPerformance.create({
      data: {
        farmerId: farmer.id,
        score: 50,
        tier: PerformanceTier.PROBATIONARY,
      },
    });

    await tx.farmerPerformanceBreakdown.create({
      data: {
        farmerId: farmer.id,
        onTimeDeliveryScore: null,
        quantityAccuracyScore: null,
        qualityScore: null,
        availabilitySubmissionScore: null,
      },
    });

    if (data.photoUrls && data.photoUrls.length > 0) {
      await tx.farmPhoto.createMany({
        data: data.photoUrls.map((url) => ({
          farmerId: farmer.id,
          filePath: url,
          fileType: 'image',
        })),
      });
    }

    if (data.certificateUrls && data.certificateUrls.length > 0) {
      await tx.farmCertificate.createMany({
        data: data.certificateUrls.map((url) => ({
          farmerId: farmer.id,
          filePath: url,
          fileType: 'image',
        })),
      });
    }

    return {
      userId: user.id,
      farmerId: farmer.id,
      applicationId: application.id,
    };
  });

  await createAuditLog({
    userId: adminId,
    actionType: 'ADMIN_CREATE_SUPPLIER',
    entityType: 'Farmer',
    entityId: result.farmerId,
    details: { userId: result.userId, applicationId: result.applicationId },
  });

  return result;
}

export interface CreateBuyerAsAdminData {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  businessName?: string;
  buyerType: 'RESTAURANT' | 'HOTEL' | 'CATERER' | 'INDIVIDUAL';
  contactPerson: string;
  estimatedVolume?: number;
  orderFrequency?: string;
  companyRegistrationUrls?: string[];
  supportingDocUrls?: string[];
  deliveryAddresses: {
    address: string;
    landmark?: string;
    region?: string;
    isDefault?: boolean;
  }[];
  avatarUrl?: string | null;
}

/**
 * Create a buyer manually as admin. No approval step: the buyer is created
 * as already approved (User status ACTIVE, BuyerRegistration ACTIVE with reviewedAt).
 * They can log in immediately with the password provided.
 */
export async function createBuyerAsAdmin(
  adminId: string,
  data: CreateBuyerAsAdminData
): Promise<{ userId: string; buyerId: string; registrationId: string }> {
  const phoneE164 = toE164(data.phone);
  if (!phoneE164) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: phoneE164 }, { phone: data.phone }],
    },
  });

  if (existingUser) {
    throw createError(
      'Email or phone number already registered',
      409,
      'DUPLICATE_USER'
    );
  }

  const passwordHash = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        phone: phoneE164,
        passwordHash,
        role: UserRole.BUYER,
        status: UserStatus.ACTIVE,
        avatarUrl: data.avatarUrl?.trim() || null,
      },
    });

    const buyer = await tx.buyer.create({
      data: {
        userId: user.id,
        fullName: data.fullName,
        businessName: data.businessName,
        buyerType: data.buyerType,
        contactPerson: data.contactPerson,
        estimatedVolume: data.estimatedVolume,
        orderFrequency: data.orderFrequency,
        verificationDate: new Date(),
        verificationAdminId: adminId,
      },
    });

    const registration = await tx.buyerRegistration.create({
      data: {
        buyerId: buyer.id,
        status: UserStatus.ACTIVE,
        reviewedAt: new Date(),
      },
    });

    if (data.deliveryAddresses && data.deliveryAddresses.length > 0) {
      const { getDeliveryCoverageRegions } = await import('./system.service.js');
      const allowedRegions = getDeliveryCoverageRegions();
      for (const addr of data.deliveryAddresses) {
        if (allowedRegions.length > 0) {
          const region = addr.region?.trim();
          if (!region) {
            throw createError(
              'Region is required. We currently deliver to: ' + allowedRegions.join(', '),
              400,
              'REGION_REQUIRED'
            );
          }
          if (!allowedRegions.includes(region)) {
            throw createError(
              `We don't deliver to "${region}". Currently delivered regions: ${allowedRegions.join(', ')}`,
              400,
              'REGION_NOT_IN_COVERAGE'
            );
          }
        }
      }
      await tx.deliveryAddress.createMany({
        data: data.deliveryAddresses.map((addr, index) => ({
          buyerId: buyer.id,
          address: addr.address,
          landmark: addr.landmark,
          region: addr.region?.trim() || null,
          isDefault: addr.isDefault ?? (index === 0),
        })),
      });
    }

    if (data.companyRegistrationUrls && data.companyRegistrationUrls.length > 0) {
      await tx.buyerDocument.createMany({
        data: data.companyRegistrationUrls.map((url) => ({
          buyerId: buyer.id,
          filePath: url,
          fileType: 'image',
          documentType: 'COMPANY_REGISTRATION',
        })),
      });
    }
    if (data.supportingDocUrls && data.supportingDocUrls.length > 0) {
      await tx.buyerDocument.createMany({
        data: data.supportingDocUrls.map((url) => ({
          buyerId: buyer.id,
          filePath: url,
          fileType: 'image',
          documentType: 'SUPPORTING',
        })),
      });
    }

    return {
      userId: user.id,
      buyerId: buyer.id,
      registrationId: registration.id,
    };
  });

  await createAuditLog({
    userId: adminId,
    actionType: 'ADMIN_CREATE_BUYER',
    entityType: 'Buyer',
    entityId: result.buyerId,
    details: { userId: result.userId, registrationId: result.registrationId },
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
          avatarUrl: true,
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
 * Get a single farmer by ID (admin)
 */
export async function getFarmerById(farmerId: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          avatarUrl: true,
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
      farmPhotos: {
        select: {
          id: true,
          filePath: true,
          fileType: true,
          uploadedAt: true,
        },
      },
      farmCertificates: {
        select: {
          id: true,
          filePath: true,
          fileType: true,
          uploadedAt: true,
        },
      },
    },
  });
  if (!farmer) {
    throw new Error('Farmer not found');
  }
  return farmer;
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
          avatarUrl: true,
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
      deliveryAddresses: {
        select: {
          id: true,
          address: true,
          landmark: true,
          isDefault: true,
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
 * Get a single buyer by ID (admin)
 */
export async function getBuyerById(buyerId: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          avatarUrl: true,
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
      deliveryAddresses: {
        select: {
          id: true,
          address: true,
          landmark: true,
          region: true,
          isDefault: true,
        },
      },
      buyerDocuments: {
        select: {
          id: true,
          filePath: true,
          fileType: true,
          documentType: true,
          uploadedAt: true,
        },
      },
    },
  });
  if (!buyer) {
    throw new Error('Buyer not found');
  }
  return buyer;
}

/**
 * Update farmer (admin can edit anything)
 */
export async function updateFarmer(
  farmerId: string,
  data: {
    email?: string;
    phone?: string;
    password?: string;
    fullName?: string;
    farmName?: string | null;
    region?: string;
    town?: string;
    weeklyCapacityMin?: number;
    weeklyCapacityMax?: number;
    produceCategory?: string;
    feedingMethod?: string;
    photoUrls?: string[];
    certificateUrls?: string[];
  }
) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: { user: true },
  });
  if (!farmer) {
    throw new Error('Farmer not found');
  }

  const userData: { email?: string; phone?: string; passwordHash?: string } = {};
  if (data.email != null) userData.email = data.email.trim();
  if (data.phone != null) {
    const phoneE164 = toE164(data.phone);
    if (!phoneE164) throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
    userData.phone = phoneE164;
  }
  if (data.password != null && data.password !== '') {
    userData.passwordHash = await hashPassword(data.password);
  }

  const farmerData: Record<string, unknown> = {};
  if (data.fullName != null) farmerData.fullName = data.fullName.trim();
  if (data.farmName !== undefined) farmerData.farmName = data.farmName?.trim() || null;
  if (data.region != null) farmerData.region = data.region.trim();
  if (data.town != null) farmerData.town = data.town.trim();
  if (data.weeklyCapacityMin != null) farmerData.weeklyCapacityMin = data.weeklyCapacityMin;
  if (data.weeklyCapacityMax != null) farmerData.weeklyCapacityMax = data.weeklyCapacityMax;
  if (data.produceCategory != null) farmerData.produceCategory = data.produceCategory.trim();
  if (data.feedingMethod != null) farmerData.feedingMethod = data.feedingMethod.trim();

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: farmer.userId },
        data: userData,
      });
    }
    if (Object.keys(farmerData).length > 0) {
      await tx.farmer.update({
        where: { id: farmerId },
        data: farmerData,
      });
    }
    if (data.photoUrls != null) {
      await tx.farmPhoto.deleteMany({ where: { farmerId } });
      if (data.photoUrls.length > 0) {
        await tx.farmPhoto.createMany({
          data: data.photoUrls.map((url) => ({
            farmerId,
            filePath: url.trim(),
            fileType: 'image',
          })),
        });
      }
    }
    if (data.certificateUrls != null) {
      await tx.farmCertificate.deleteMany({ where: { farmerId } });
      if (data.certificateUrls.length > 0) {
        await tx.farmCertificate.createMany({
          data: data.certificateUrls.map((url) => ({
            farmerId,
            filePath: url.trim(),
            fileType: 'image',
          })),
        });
      }
    }
  });

  return getFarmerById(farmerId);
}

/**
 * Update buyer (admin can edit anything)
 */
export async function updateBuyer(
  buyerId: string,
  data: {
    email?: string;
    phone?: string;
    password?: string;
    fullName?: string;
    businessName?: string | null;
    buyerType?: string;
    contactPerson?: string;
    estimatedVolume?: number | null;
    orderFrequency?: string | null;
    deliveryAddresses?: Array<{
      id?: string;
      address: string;
      landmark?: string | null;
      region?: string | null;
      isDefault?: boolean;
    }>;
  }
) {
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    include: { user: true, deliveryAddresses: true },
  });
  if (!buyer) {
    throw new Error('Buyer not found');
  }

  const userData: { email?: string; phone?: string; passwordHash?: string } = {};
  if (data.email != null) userData.email = data.email.trim();
  if (data.phone != null) {
    const phoneE164 = toE164(data.phone);
    if (!phoneE164) throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
    userData.phone = phoneE164;
  }
  if (data.password != null && data.password !== '') {
    userData.passwordHash = await hashPassword(data.password);
  }

  const buyerData: Record<string, unknown> = {};
  if (data.fullName != null) buyerData.fullName = data.fullName.trim();
  if (data.businessName !== undefined) buyerData.businessName = data.businessName?.trim() || null;
  if (data.buyerType != null) buyerData.buyerType = data.buyerType;
  if (data.contactPerson != null) buyerData.contactPerson = data.contactPerson.trim();
  if (data.estimatedVolume !== undefined) buyerData.estimatedVolume = data.estimatedVolume;
  if (data.orderFrequency !== undefined) buyerData.orderFrequency = data.orderFrequency;

  if (Object.keys(userData).length > 0) {
    await prisma.user.update({
      where: { id: buyer.userId },
      data: userData,
    });
  }
  if (Object.keys(buyerData).length > 0) {
    await prisma.buyer.update({
      where: { id: buyerId },
      data: buyerData,
    });
  }

  if (data.deliveryAddresses != null) {
    const existingIds = new Set(buyer.deliveryAddresses.map((a) => a.id));
    const incomingIds = new Set(
      data.deliveryAddresses.filter((a) => 'id' in a && a.id).map((a) => a.id as string)
    );
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    for (const id of toDelete) {
      await prisma.deliveryAddress.delete({ where: { id } });
    }
    for (let i = 0; i < data.deliveryAddresses.length; i++) {
      const addr = data.deliveryAddresses[i];
      const payload = {
        address: addr.address.trim(),
        landmark: addr.landmark?.trim() || null,
        region: (addr as { region?: string }).region?.trim() || null,
        isDefault: addr.isDefault ?? (i === 0),
      };
      if (addr.id && existingIds.has(addr.id)) {
        await prisma.deliveryAddress.update({
          where: { id: addr.id },
          data: payload,
        });
      } else {
        await prisma.deliveryAddress.create({
          data: { buyerId, ...payload },
        });
      }
    }
  }

  return getBuyerById(buyerId);
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
      // Support ticket counts (M3)
      supportTicketsOpen,
      supportTicketsInProgress,
      supportTicketsResolved,
      supportTicketsTotal,
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
      // Support ticket counts
      prisma.supportTicket.count({ where: { status: TicketStatus.OPEN } }).catch(() => 0),
      prisma.supportTicket.count({ where: { status: TicketStatus.IN_PROGRESS } }).catch(() => 0),
      prisma.supportTicket.count({ where: { status: TicketStatus.RESOLVED } }).catch(() => 0),
      prisma.supportTicket.count().catch(() => 0),
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
      // Support ticket stats (M3)
      supportTickets: {
        open: supportTicketsOpen,
        inProgress: supportTicketsInProgress,
        resolved: supportTicketsResolved,
        total: supportTicketsTotal,
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

/**
 * Get all produce categories with pricing bands (US-ADMIN-005)
 */
export async function getPricingBands() {
  return prisma.produceCategory.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      unitType: true,
      minPrice: true,
      maxPrice: true,
      createdAt: true,
    },
  });
}

/**
 * Update pricing band for a produce category
 */
export async function updatePricingBand(
  categoryId: string,
  data: { minPrice: number | null; maxPrice: number | null }
) {
  const category = await prisma.produceCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    throw new Error('Produce category not found');
  }
  return prisma.produceCategory.update({
    where: { id: categoryId },
    data: {
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
    },
  });
}

