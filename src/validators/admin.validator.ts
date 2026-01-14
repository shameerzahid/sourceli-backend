import { z } from 'zod';
import { UserStatus } from '@prisma/client';

/**
 * Schema for approving a farmer application
 */
export const approveFarmerSchema = z.object({
  adminNotes: z.string().max(1000).optional(),
});

/**
 * Schema for rejecting a farmer application
 */
export const rejectFarmerSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
  adminNotes: z.string().max(1000).optional(),
});

/**
 * Schema for approving a buyer registration
 */
export const approveBuyerSchema = z.object({
  adminNotes: z.string().max(1000).optional(),
});

/**
 * Schema for rejecting a buyer registration
 */
export const rejectBuyerSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
  adminNotes: z.string().max(1000).optional(),
});

/**
 * Schema for updating farmer status
 */
export const updateFarmerStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: 'Invalid status value' }),
  }),
});

/**
 * Schema for updating buyer status
 */
export const updateBuyerStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: 'Invalid status value' }),
  }),
});

/**
 * Schema for query parameters when listing farmers
 */
export const listFarmersQuerySchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  region: z.string().max(100).optional(),
  produceCategory: z.string().max(50).optional(),
});

/**
 * Schema for query parameters when listing buyers
 */
export const listBuyersQuerySchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  buyerType: z.string().optional(),
});


