import { prisma } from '../config/database.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt.js';
import { UserRole, UserStatus, BuyerType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

// Registration DTOs
export interface FarmerRegistrationData {
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
  termsAccepted: boolean; // Platform rules agreement
  photoUrls?: string[]; // Cloudinary URLs for farm photos
}

export interface BuyerRegistrationData {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  businessName?: string;
  buyerType: BuyerType;
  contactPerson: string;
  estimatedVolume?: number;
  deliveryAddresses: {
    address: string;
    landmark?: string;
    isDefault?: boolean;
  }[];
}

// Login DTOs
export interface LoginCredentials {
  emailOrPhone: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
  };
}

/**
 * Register a new farmer
 */
export async function registerFarmer(
  data: FarmerRegistrationData
): Promise<{ userId: string; farmerId: string; applicationId: string }> {
  // Check if email or phone already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: data.phone }],
    },
  });

  if (existingUser) {
    throw createError(
      'Email or phone number already registered',
      409,
      'DUPLICATE_USER'
    );
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user, farmer, and application in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: UserRole.FARMER,
        status: UserStatus.APPLIED, // Starts as APPLIED, needs admin approval
      },
    });

    // Create farmer profile
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
      },
    });

    // Create farmer application
    const application = await tx.farmerApplication.create({
      data: {
        farmerId: farmer.id,
        status: UserStatus.APPLIED,
        termsAccepted: data.termsAccepted || false,
        termsAcceptedAt: data.termsAccepted ? new Date() : null,
      },
    });

    // Create farm photos if provided
    if (data.photoUrls && data.photoUrls.length > 0) {
      await tx.farmPhoto.createMany({
        data: data.photoUrls.map((url) => ({
          farmerId: farmer.id,
          filePath: url, // Store Cloudinary URL
          fileType: 'image', // Can be enhanced to detect actual type
        })),
      });
    }

    return { userId: user.id, farmerId: farmer.id, applicationId: application.id };
  });

  return result;
}

/**
 * Register a new buyer
 */
export async function registerBuyer(
  data: BuyerRegistrationData
): Promise<{ userId: string; buyerId: string; registrationId: string }> {
  // Check if email or phone already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: data.phone }],
    },
  });

  if (existingUser) {
    throw createError(
      'Email or phone number already registered',
      409,
      'DUPLICATE_USER'
    );
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user, buyer, registration, and delivery addresses in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: UserRole.BUYER,
        status: UserStatus.PENDING, // Starts as PENDING, needs admin approval
      },
    });

    // Create buyer profile
    const buyer = await tx.buyer.create({
      data: {
        userId: user.id,
        fullName: data.fullName,
        businessName: data.businessName,
        buyerType: data.buyerType,
        contactPerson: data.contactPerson,
        estimatedVolume: data.estimatedVolume,
      },
    });

    // Create buyer registration
    const registration = await tx.buyerRegistration.create({
      data: {
        buyerId: buyer.id,
        status: UserStatus.PENDING,
      },
    });

    // Create delivery addresses if provided
    if (data.deliveryAddresses && data.deliveryAddresses.length > 0) {
      await tx.deliveryAddress.createMany({
        data: data.deliveryAddresses.map((addr, index) => ({
          buyerId: buyer.id,
          address: addr.address,
          landmark: addr.landmark,
          isDefault: addr.isDefault || (index === 0 && !addr.isDefault), // First one is default if none specified
        })),
      });
    }

    return {
      userId: user.id,
      buyerId: buyer.id,
      registrationId: registration.id,
    };
  });

  return result;
}

/**
 * Login user with email/phone and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { emailOrPhone, password } = credentials;

  // Find user by email or phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    },
    include: {
      farmer: true,
      buyer: true,
    },
  });

  if (!user) {
    throw createError('Invalid email/phone or password', 401, 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw createError('Invalid email/phone or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if user is allowed to login (must be ACTIVE or PROBATIONARY)
  if (
    user.status !== UserStatus.ACTIVE &&
    user.status !== UserStatus.PROBATIONARY
  ) {
    const statusMessages: Record<UserStatus, string> = {
      PENDING: 'Your account is pending approval',
      APPLIED: 'Your application is under review',
      ACTIVE: '',
      PROBATIONARY: '',
      SUSPENDED: 'Your account has been suspended',
      BLOCKED: 'Your account has been blocked',
    };

    throw createError(
      statusMessages[user.status] || 'Your account cannot access the platform',
      403,
      'ACCOUNT_NOT_ACTIVE'
    );
  }

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    role: user.role,
    status: user.status,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  };
}

/**
 * Get user profile with role-specific data
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      farmer: {
        include: {
          application: true,
        },
      },
      buyer: {
        include: {
          registration: true,
          deliveryAddresses: true,
        },
      },
    },
  });

  if (!user) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  return user;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw createError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
  }

  // Get user to verify they still exist and are active
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Check if user is still allowed to access
  if (
    user.status !== UserStatus.ACTIVE &&
    user.status !== UserStatus.PROBATIONARY
  ) {
    throw createError(
      'Account is not active',
      403,
      'ACCOUNT_NOT_ACTIVE'
    );
  }

  // Generate new tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    role: user.role,
    status: user.status,
    email: user.email,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

