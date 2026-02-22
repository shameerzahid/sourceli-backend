import { z } from 'zod';
import { UserStatus, PerformanceTier } from '@prisma/client';

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

const tierThresholdsSchema = z.object({
  PROBATIONARY: z.number().min(0).max(100),
  STANDARD: z.number().min(0).max(100),
  PREFERRED: z.number().min(0).max(100),
});

const scoreWeightsSchema = z.object({
  onTimeDelivery: z.number().min(0).max(1),
  quantityAccuracy: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  availabilitySubmission: z.number().min(0).max(1),
}).refine(
  (w) => Math.abs((w.onTimeDelivery + w.quantityAccuracy + w.quality + w.availabilitySubmission) - 1) < 0.01,
  { message: 'Weights must sum to 1' }
);

const penaltiesSchema = z.object({
  lateSubmission: z.number().max(0),
  missedDelivery: z.number().max(0),
  qualityFail: z.number().max(0),
});

const warningTriggersSchema = z.object({
  deliveriesBeforeProbation: z.number().int().min(0).optional(),
}).catchall(z.number().optional());

/**
 * Schema for updating performance rules (admin)
 */
export const updatePerformanceRulesSchema = z.object({
  tierThresholds: tierThresholdsSchema,
  scoreWeights: scoreWeightsSchema,
  penalties: penaltiesSchema,
  warningTriggers: warningTriggersSchema,
});

/**
 * Schema for admin override of farmer performance
 */
export const overridePerformanceSchema = z.object({
  farmerId: z.string().min(1, 'Farmer ID is required'),
  score: z.number().min(0).max(100).int().optional(),
  tier: z.nativeEnum(PerformanceTier, {
    errorMap: () => ({ message: 'Tier must be PROBATIONARY, STANDARD, or PREFERRED' }),
  }).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
}).refine((d) => d.score !== undefined || d.tier !== undefined, {
  message: 'At least one of score or tier must be provided',
});

/**
 * Schema for requesting order modification (US-ADMIN-010)
 */
export const requestOrderModificationSchema = z.object({
  messageToBuyer: z
    .string()
    .min(1, 'Message to buyer is required')
    .max(500, 'Message must be at most 500 characters')
    .transform((s) => s.trim()),
});

/**
 * Schema for updating pricing band for a produce category (US-ADMIN-005)
 */
export const updatePricingBandSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  minPrice: z.number().min(0, 'Min price must be 0 or greater').nullable(),
  maxPrice: z.number().min(0, 'Max price must be 0 or greater').nullable(),
}).refine(
  (d) => {
    if (d.minPrice != null && d.maxPrice != null) return d.minPrice <= d.maxPrice;
    return true;
  },
  { message: 'Min price must be less than or equal to max price', path: ['maxPrice'] }
);
