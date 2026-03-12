import { z } from 'zod';
import { UserStatus, PerformanceTier } from '@prisma/client';
import { isValidEmail, isValidPhone, validatePassword } from '../utils/validation.js';

/**
 * Schema for admin creating a supplier (same as farmer registration but photoUrls optional 0-10, termsAccepted optional)
 */
export const createSupplierSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .refine((val) => isValidEmail(val), { message: 'Invalid email format' }),
    phone: z
      .string()
      .min(1, 'Phone number is required')
      .refine((val) => isValidPhone(val), { message: 'Invalid phone number format' }),
    password: z
      .string()
      .min(1, 'Password is required')
      .refine((val) => validatePassword(val).isValid, (val) => ({ message: validatePassword(val).error || 'Invalid password' })),
    fullName: z.string().min(1, 'Full name is required').max(100, 'Full name is too long'),
    farmName: z.string().max(100, 'Farm name is too long').optional(),
    region: z.string().min(1, 'Region is required').max(100, 'Region name is too long'),
    town: z.string().min(1, 'Town is required').max(100, 'Town name is too long'),
    weeklyCapacityMin: z.number().int().min(1).max(100000),
    weeklyCapacityMax: z.number().int().min(1).max(100000),
    produceCategory: z.string().min(1, 'Produce category is required').max(50),
    feedingMethod: z.string().min(1, 'Feeding method is required').max(50),
    termsAccepted: z.boolean().optional(),
    photoUrls: z.array(z.string().url()).max(10).optional(),
    certificateUrls: z.array(z.string().url()).max(10).optional(),
  })
  .refine((data) => data.weeklyCapacityMax >= data.weeklyCapacityMin, {
    message: 'Maximum capacity must be greater than or equal to minimum capacity',
    path: ['weeklyCapacityMax'],
  });

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
 * Schema for admin updating a farmer (all optional; admin can edit anything)
 */
export const updateFarmerSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email format')
      .refine((val) => isValidEmail(val), { message: 'Invalid email format' })
      .optional(),
    phone: z
      .string()
      .refine((val) => !val || isValidPhone(val), { message: 'Invalid phone number format' })
      .optional(),
    password: z
      .string()
      .refine((val) => !val || validatePassword(val).isValid, (val) => ({ message: validatePassword(val).error || 'Invalid password' }))
      .optional(),
    fullName: z.string().min(1).max(100).optional(),
    farmName: z.string().max(100).optional().nullable(),
    region: z.string().min(1).max(100).optional(),
    town: z.string().min(1).max(100).optional(),
    weeklyCapacityMin: z.number().int().min(1).max(100000).optional(),
    weeklyCapacityMax: z.number().int().min(1).max(100000).optional(),
    produceCategory: z.string().min(1).max(50).optional(),
    feedingMethod: z.string().min(1).max(50).optional(),
    photoUrls: z.array(z.string().url()).max(10).optional(),
    certificateUrls: z.array(z.string().url()).max(10).optional(),
  })
  .refine(
    (data) =>
      data.weeklyCapacityMin == null ||
      data.weeklyCapacityMax == null ||
      data.weeklyCapacityMax >= data.weeklyCapacityMin,
    { message: 'Maximum capacity must be >= minimum capacity', path: ['weeklyCapacityMax'] }
  );

/**
 * Schema for admin updating a buyer (all optional)
 */
const deliveryAddressUpdateSchema = z.object({
  id: z.string().cuid().optional(),
  address: z.string().min(1, 'Address is required').max(500),
  landmark: z.string().max(200).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const updateBuyerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .refine((val) => isValidEmail(val), { message: 'Invalid email format' })
    .optional(),
  phone: z
    .string()
    .refine((val) => !val || isValidPhone(val), { message: 'Invalid phone number format' })
    .optional(),
  password: z
    .string()
    .refine((val) => !val || validatePassword(val).isValid, (val) => ({ message: validatePassword(val).error || 'Invalid password' }))
    .optional(),
  fullName: z.string().min(1).max(100).optional(),
  businessName: z.string().max(100).optional().nullable(),
  buyerType: z.enum(['RESTAURANT', 'HOTEL', 'CATERER', 'INDIVIDUAL', 'BUSINESS']).optional(),
  contactPerson: z.string().min(1).max(200).optional(),
  estimatedVolume: z.number().int().min(0).optional().nullable(),
  orderFrequency: z.string().max(50).optional().nullable(),
  deliveryAddresses: z.array(deliveryAddressUpdateSchema).optional(),
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
 * Schema for admin creating an order on behalf of a buyer
 */
export const createOrderByAdminSchema = z.object({
  buyerId: z.string().min(1, 'Buyer is required'),
  productType: z.string().min(1, 'Product type is required').max(100).transform((s) => s.trim()),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1000000),
  orderType: z.enum(['ONE_TIME', 'STANDING'], { required_error: 'Order type is required' }),
  deliveryDate: z.string().min(1, 'Delivery date is required').transform((s) => new Date(s)),
  deliveryAddressId: z.string().min(1, 'Delivery address is required'),
  notes: z.string().max(1000).optional().transform((s) => (s == null || s === '' ? undefined : s.trim())),
});

/**
 * Schema for admin updating an order (partial)
 */
export const updateOrderByAdminSchema = z.object({
  productType: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  quantity: z.number().int().min(1).max(1000000).optional(),
  deliveryDate: z.string().min(1).transform((s) => new Date(s)).optional(),
  deliveryAddressId: z.string().min(1).optional(),
  notes: z.string().max(1000).optional().transform((s) => (s == null || s === '' ? null : s.trim())),
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

/**
 * Schema for creating a produce category (admin)
 */
export const createProduceCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name is too long').transform((s) => s.trim()),
  unitType: z.string().min(1, 'Unit type is required').max(20, 'Unit type is too long').transform((s) => s.trim()),
});
