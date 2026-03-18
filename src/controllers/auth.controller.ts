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
  updateProfileSchema,
} from '../validators/auth.validator.js';
import { wrapAsync } from '../middleware/errorHandler.js';
import { prisma } from '../config/database.js';
import { UserRole } from '@prisma/client';
import { uploadImageToCloudinary, validateImageFile, validateImageOrPdfFile, uploadImageOrPdfToCloudinary } from '../utils/fileUpload.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Upload a single farm photo (for upload-on-add during registration).
 * POST /api/auth/upload/farm-photo
 * Accepts multipart/form-data with single file field "photo". Returns { url }.
 */
export const uploadFarmPhotoHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw createError('No file provided. Send one image or PDF as multipart field "photo".', 400, 'PHOTO_REQUIRED');
    }
    validateImageOrPdfFile(file);
    const fileName = `farmer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const uploadResult = await uploadImageOrPdfToCloudinary(
      file.buffer,
      'farm-photos',
      fileName,
      file.mimetype
    );
    res.status(200).json({
      success: true,
      url: uploadResult.secureUrl,
    });
  }
);

/**
 * Profile picture during registration (farmer/buyer). No auth. Images only.
 * POST /api/auth/upload/register-profile-photo — field "photo"
 */
export const uploadRegisterProfilePhotoHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw createError('No file provided. Send one image as multipart field "photo".', 400, 'PHOTO_REQUIRED');
    }
    validateImageFile(file);
    const uploadResult = await uploadImageToCloudinary(
      file.buffer,
      'avatars',
      `register-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    res.status(200).json({
      success: true,
      url: uploadResult.secureUrl,
    });
  }
);

/**
 * Upload current user's profile picture (avatar).
 * PUT /api/auth/upload/avatar
 * Accepts multipart/form-data with single file field "avatar". Requires auth. Returns { url }.
 */
export const uploadAvatarHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user?.userId) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    const file = req.file;
    if (!file) {
      throw createError('No avatar file provided. Send one image as multipart field "avatar".', 400, 'AVATAR_REQUIRED');
    }
    validateImageFile(file);
    const uploadResult = await uploadImageToCloudinary(
      file.buffer,
      'avatars',
      `user-${req.user.userId}-${Date.now()}`
    );
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { avatarUrl: uploadResult.secureUrl },
    });
    res.status(200).json({
      success: true,
      url: uploadResult.secureUrl,
    });
  }
);

/**
 * Register a new farmer
 * POST /api/auth/register/farmer
 * Accepts either: (1) multipart/form-data with photos, or (2) application/json with photoUrls (pre-uploaded URLs).
 */
export const registerFarmerHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Parse form data - multer stores fields in req.body (multipart) or use req.body (JSON)
    const formData: any = { ...req.body };

    // When sent as JSON, photoUrls is already an array; when multipart, we get files and need to coerce types
    if (formData.weeklyCapacityMin) {
      formData.weeklyCapacityMin = parseInt(formData.weeklyCapacityMin, 10);
    }
    if (formData.weeklyCapacityMax) {
      formData.weeklyCapacityMax = parseInt(formData.weeklyCapacityMax, 10);
    }
    if (formData.termsAccepted !== undefined) {
      formData.termsAccepted = formData.termsAccepted === 'true' || formData.termsAccepted === true;
    }

    // Validate input (photoUrls optional here; we resolve photos below)
    const validatedData = farmerRegistrationSchema.parse(formData);

    const files = req.files as Express.Multer.File[] | undefined;
    let photoUrls: string[] = [];

    // Pre-uploaded URLs (JSON body from frontend upload-on-add flow)
    if (Array.isArray(validatedData.photoUrls) && validatedData.photoUrls.length > 0) {
      photoUrls = validatedData.photoUrls;
    }

    // Otherwise upload from multipart files
    if (photoUrls.length === 0 && files && files.length > 0) {
      for (const file of files) {
        validateImageOrPdfFile(file);
        const fileName = `farmer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const uploadResult = await uploadImageOrPdfToCloudinary(
          file.buffer,
          'farm-photos',
          fileName,
          file.mimetype
        );
        photoUrls.push(uploadResult.secureUrl);
      }
    }

    if (photoUrls.length === 0) {
      throw createError(
        'At least one farm photo is required. Please upload photos of your farm, housing, animals, or produce.',
        400,
        'PHOTOS_REQUIRED'
      );
    }

    const certificateUrls = Array.isArray(validatedData.certificateUrls)
      ? validatedData.certificateUrls
      : [];

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
      certificateUrls: certificateUrls.length > 0 ? certificateUrls : undefined,
      avatarUrl: validatedData.avatarUrl?.trim() || undefined,
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
      orderFrequency: validatedData.orderFrequency,
      companyRegistrationUrls: validatedData.companyRegistrationUrls,
      supportingDocUrls: validatedData.supportingDocUrls,
      deliveryAddresses: validatedData.deliveryAddresses.map((addr) => ({
        address: addr.address.trim(),
        landmark: addr.landmark?.trim(),
        isDefault: addr.isDefault,
      })),
      avatarUrl: validatedData.avatarUrl?.trim() || undefined,
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
      avatarUrl: user.avatarUrl ?? null,
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
        orderFrequency: user.buyer.orderFrequency ?? null,
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
 * Update current user profile
 * PATCH /api/auth/me
 */
export const updateMeHandler = wrapAsync(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    const userId = req.user.userId;
    const validated = updateProfileSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { farmer: true, buyer: true },
    });
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (validated.email !== undefined) {
      const existing = await prisma.user.findFirst({
        where: { email: validated.email.trim(), id: { not: userId } },
      });
      if (existing) {
        throw createError('Email already in use', 409, 'DUPLICATE_EMAIL');
      }
    }
    if (validated.phone !== undefined) {
      const existing = await prisma.user.findFirst({
        where: { phone: validated.phone.trim(), id: { not: userId } },
      });
      if (existing) {
        throw createError('Phone already in use', 409, 'DUPLICATE_PHONE');
      }
    }

    const userUpdate: { email?: string; phone?: string } = {};
    if (validated.email !== undefined) userUpdate.email = validated.email.trim();
    if (validated.phone !== undefined) userUpdate.phone = validated.phone.trim();
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    if (user.role === UserRole.FARMER && user.farmer) {
      const farmerData: Record<string, unknown> = {};
      if (validated.fullName !== undefined) farmerData.fullName = validated.fullName.trim();
      if (validated.farmName !== undefined) farmerData.farmName = validated.farmName?.trim() ?? null;
      if (validated.region !== undefined) farmerData.region = validated.region.trim();
      if (validated.town !== undefined) farmerData.town = validated.town.trim();
      if (validated.weeklyCapacityMin !== undefined) farmerData.weeklyCapacityMin = validated.weeklyCapacityMin;
      if (validated.weeklyCapacityMax !== undefined) farmerData.weeklyCapacityMax = validated.weeklyCapacityMax;
      if (validated.produceCategory !== undefined) farmerData.produceCategory = validated.produceCategory.trim();
      if (validated.feedingMethod !== undefined) farmerData.feedingMethod = validated.feedingMethod.trim();
      if (Object.keys(farmerData).length > 0) {
        await prisma.farmer.update({
          where: { id: user.farmer.id },
          data: farmerData as any,
        });
      }
    }

    if (user.role === UserRole.BUYER && user.buyer) {
      const buyerData: Record<string, unknown> = {};
      if (validated.fullName !== undefined) buyerData.fullName = validated.fullName.trim();
      if (validated.businessName !== undefined) buyerData.businessName = validated.businessName?.trim() ?? null;
      if (validated.buyerType !== undefined) buyerData.buyerType = validated.buyerType;
      if (validated.contactPerson !== undefined) buyerData.contactPerson = validated.contactPerson.trim();
      if (validated.estimatedVolume !== undefined) buyerData.estimatedVolume = validated.estimatedVolume;
      if (validated.orderFrequency !== undefined) buyerData.orderFrequency = validated.orderFrequency ?? null;
      if (Object.keys(buyerData).length > 0) {
        await prisma.buyer.update({
          where: { id: user.buyer.id },
          data: buyerData as any,
        });
      }
    }

    const updated = await getUserProfile(userId);
    let profileData: any = {
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      status: updated.status,
      avatarUrl: updated.avatarUrl ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
    if (updated.role === UserRole.FARMER && updated.farmer) {
      profileData.farmer = {
        id: updated.farmer.id,
        fullName: updated.farmer.fullName,
        farmName: updated.farmer.farmName,
        region: updated.farmer.region,
        town: updated.farmer.town,
        weeklyCapacityMin: updated.farmer.weeklyCapacityMin,
        weeklyCapacityMax: updated.farmer.weeklyCapacityMax,
        produceCategory: updated.farmer.produceCategory,
        feedingMethod: updated.farmer.feedingMethod,
        application: updated.farmer.application
          ? {
              id: updated.farmer.application.id,
              status: updated.farmer.application.status,
              submittedAt: updated.farmer.application.submittedAt,
              reviewedAt: updated.farmer.application.reviewedAt,
              rejectionReason: updated.farmer.application.rejectionReason,
            }
          : null,
      };
    }
    if (updated.role === UserRole.BUYER && updated.buyer) {
      profileData.buyer = {
        id: updated.buyer.id,
        fullName: updated.buyer.fullName,
        businessName: updated.buyer.businessName,
        buyerType: updated.buyer.buyerType,
        contactPerson: updated.buyer.contactPerson,
        estimatedVolume: updated.buyer.estimatedVolume,
        orderFrequency: updated.buyer.orderFrequency ?? null,
        registration: updated.buyer.registration
          ? {
              id: updated.buyer.registration.id,
              status: updated.buyer.registration.status,
              submittedAt: updated.buyer.registration.submittedAt,
              reviewedAt: updated.buyer.registration.reviewedAt,
              rejectionReason: updated.buyer.registration.rejectionReason,
            }
          : null,
        deliveryAddresses: updated.buyer.deliveryAddresses.map((addr) => ({
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

