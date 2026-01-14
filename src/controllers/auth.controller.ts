import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  registerFarmer,
  registerBuyer,
  login,
  getUserProfile,
  refreshAccessToken,
  FarmerRegistrationData,
  BuyerRegistrationData,
} from '../services/auth.service.js';
import {
  generatePasswordResetToken,
  resetPassword,
  changePassword,
  verifyResetToken,
} from '../services/password.service.js';
import {
  farmerRegistrationSchema,
  buyerRegistrationSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/auth.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { prisma } from '../config/database.js';
import { UserRole } from '@prisma/client';
import { uploadImageToCloudinary, validateImageFile } from '../utils/fileUpload.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Register a new farmer
 * POST /api/auth/register/farmer
 * Accepts multipart/form-data with photos
 */
export const registerFarmerHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Parse form data - multer stores fields in req.body
    // Convert string numbers to actual numbers and booleans
    const formData: any = { ...req.body };
    
    // Convert numeric fields
    if (formData.weeklyCapacityMin) {
      formData.weeklyCapacityMin = parseInt(formData.weeklyCapacityMin, 10);
    }
    if (formData.weeklyCapacityMax) {
      formData.weeklyCapacityMax = parseInt(formData.weeklyCapacityMax, 10);
    }
    
    // Convert boolean field (form data sends as string)
    if (formData.termsAccepted !== undefined) {
      formData.termsAccepted = formData.termsAccepted === 'true' || formData.termsAccepted === true;
    }

    // Validate input (excluding photos which are handled separately)
    const validatedData = farmerRegistrationSchema.parse(formData);

    // Handle photo uploads
    const files = req.files as Express.Multer.File[] | undefined;
    const photoUrls: string[] = [];

    if (files && files.length > 0) {
      // Validate and upload each photo
      for (const file of files) {
        validateImageFile(file);
        const uploadResult = await uploadImageToCloudinary(
          file.buffer,
          'farm-photos',
          `farmer-${Date.now()}-${Math.random().toString(36).substring(7)}`
        );
        photoUrls.push(uploadResult.secureUrl);
      }
    }

    // Minimum 1 photo required (per requirements)
    if (photoUrls.length === 0) {
      throw createError(
        'At least one farm photo is required. Please upload photos of your farm, housing, animals, or produce.',
        400,
        'PHOTOS_REQUIRED'
      );
    }

    // Convert to service format
    const registrationData: FarmerRegistrationData = {
      email: validatedData.email.toLowerCase().trim(),
      phone: validatedData.phone.trim(),
      password: validatedData.password,
      fullName: validatedData.fullName.trim(),
      farmName: validatedData.farmName?.trim(),
      region: validatedData.region.trim(),
      town: validatedData.town.trim(),
      weeklyCapacityMin: validatedData.weeklyCapacityMin,
      weeklyCapacityMax: validatedData.weeklyCapacityMax,
      produceCategory: validatedData.produceCategory.trim(),
      feedingMethod: validatedData.feedingMethod.trim(),
      termsAccepted: validatedData.termsAccepted,
      photoUrls,
    };

    // Register farmer
    const result = await registerFarmer(registrationData);

    res.status(201).json({
      success: true,
      message: 'Farmer application submitted successfully. Please wait for admin approval.',
      data: {
        userId: result.userId,
        applicationId: result.applicationId,
        photosUploaded: photoUrls.length,
      },
    });
  }
);

/**
 * Register a new buyer
 * POST /api/auth/register/buyer
 */
export const registerBuyerHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Validate input
    const validatedData = buyerRegistrationSchema.parse(req.body);

    // Convert to service format
    const registrationData: BuyerRegistrationData = {
      email: validatedData.email.toLowerCase().trim(),
      phone: validatedData.phone.trim(),
      password: validatedData.password,
      fullName: validatedData.fullName.trim(),
      businessName: validatedData.businessName?.trim(),
      buyerType: validatedData.buyerType,
      contactPerson: validatedData.contactPerson.trim(),
      estimatedVolume: validatedData.estimatedVolume,
      deliveryAddresses: validatedData.deliveryAddresses.map((addr) => ({
        address: addr.address.trim(),
        landmark: addr.landmark?.trim(),
        isDefault: addr.isDefault,
      })),
    };

    // Register buyer
    const result = await registerBuyer(registrationData);

    res.status(201).json({
      success: true,
      message: 'Buyer registration submitted successfully. Please wait for admin approval.',
      data: {
        userId: result.userId,
        registrationId: result.registrationId,
      },
    });
  }
);

/**
 * Login user
 * POST /api/auth/login
 */
export const loginHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Login
    const authResponse = await login({
      emailOrPhone: validatedData.emailOrPhone.trim(),
      password: validatedData.password,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: authResponse,
    });
  }
);

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getMeHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Get user profile with role-specific data
    const user = await getUserProfile(req.user.userId);

    // Format response based on role
    let profileData: any = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Add role-specific data
    if (user.role === UserRole.FARMER && user.farmer) {
      profileData.farmer = {
        id: user.farmer.id,
        fullName: user.farmer.fullName,
        farmName: user.farmer.farmName,
        region: user.farmer.region,
        town: user.farmer.town,
        weeklyCapacityMin: user.farmer.weeklyCapacityMin,
        weeklyCapacityMax: user.farmer.weeklyCapacityMax,
        produceCategory: user.farmer.produceCategory,
        feedingMethod: user.farmer.feedingMethod,
        application: user.farmer.application
          ? {
              id: user.farmer.application.id,
              status: user.farmer.application.status,
              submittedAt: user.farmer.application.submittedAt,
              reviewedAt: user.farmer.application.reviewedAt,
              rejectionReason: user.farmer.application.rejectionReason,
            }
          : null,
      };
    }

    if (user.role === UserRole.BUYER && user.buyer) {
      profileData.buyer = {
        id: user.buyer.id,
        fullName: user.buyer.fullName,
        businessName: user.buyer.businessName,
        buyerType: user.buyer.buyerType,
        contactPerson: user.buyer.contactPerson,
        estimatedVolume: user.buyer.estimatedVolume,
        registration: user.buyer.registration
          ? {
              id: user.buyer.registration.id,
              status: user.buyer.registration.status,
              submittedAt: user.buyer.registration.submittedAt,
              reviewedAt: user.buyer.registration.reviewedAt,
              rejectionReason: user.buyer.registration.rejectionReason,
            }
          : null,
        deliveryAddresses: user.buyer.deliveryAddresses.map((addr) => ({
          id: addr.id,
          address: addr.address,
          landmark: addr.landmark,
          isDefault: addr.isDefault,
          createdAt: addr.createdAt,
        })),
      };
    }

    res.status(200).json({
      success: true,
      data: profileData,
    });
  }
);

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refreshTokenHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Validate input
    const validatedData = refreshTokenSchema.parse(req.body);

    // Refresh tokens
    const tokens = await refreshAccessToken(validatedData.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens,
    });
  }
);

/**
 * Logout user (client-side token removal, but we can invalidate refresh token here if needed)
 * POST /api/auth/logout
 */
export const logoutHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // In MVP, logout is handled client-side by removing tokens
    // In production, you might want to:
    // 1. Store refresh tokens in database/Redis
    // 2. Invalidate refresh token on logout
    // 3. Add token to blacklist

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
);

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
export const forgotPasswordHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(req.body);

    // Generate reset token
    const token = await generatePasswordResetToken(validatedData.emailOrPhone.trim());

    // In production, send token via email/SMS
    // For MVP, we'll return it (in production, don't return token in response)
    res.status(200).json({
      success: true,
      message:
        'If an account exists with this email/phone, a password reset link has been sent.',
      // In production, remove this:
      ...(process.env.NODE_ENV === 'development' && { resetToken: token }),
    });
  }
);

/**
 * Reset password using token
 * POST /api/auth/reset-password
 */
export const resetPasswordHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Validate input
    const validatedData = resetPasswordSchema.parse(req.body);

    // Reset password
    await resetPassword(validatedData.token, validatedData.newPassword);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  }
);

/**
 * Verify reset token (check if token is valid before showing reset form)
 * GET /api/auth/verify-reset-token/:token
 */
export const verifyResetTokenHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Reset token is required',
      });
      return;
    }

    const isValid = verifyResetToken(token);

    if (!isValid) {
      res.status(400).json({
        error: 'Invalid Token',
        message: 'Reset token is invalid or has expired',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Reset token is valid',
    });
  }
);

/**
 * Change password (for authenticated users)
 * POST /api/auth/change-password
 */
export const changePasswordHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Validate input
    const validatedData = changePasswordSchema.parse(req.body);

    // Change password
    await changePassword(
      req.user.userId,
      validatedData.currentPassword,
      validatedData.newPassword
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  }
);

