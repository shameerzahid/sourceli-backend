import { z } from 'zod';
import { OrderType, PaymentMethod } from '@prisma/client';

/**
 * Create delivery address schema
 */
export const createDeliveryAddressSchema = z.object({
  address: z
    .string()
    .min(1, 'Address is required')
    .max(500, 'Address is too long')
    .trim(),
  landmark: z
    .string()
    .max(200, 'Landmark is too long')
    .trim()
    .optional(),
  region: z
    .string()
    .max(100, 'Region is too long')
    .trim()
    .optional(),
  isDefault: z
    .boolean()
    .optional(),
});

/**
 * Update delivery address schema
 */
export const updateDeliveryAddressSchema = z.object({
  address: z
    .string()
    .min(1, 'Address is required')
    .max(500, 'Address is too long')
    .trim()
    .optional(),
  landmark: z
    .string()
    .max(200, 'Landmark is too long')
    .trim()
    .optional(),
  region: z
    .string()
    .max(100, 'Region is too long')
    .trim()
    .optional(),
  isDefault: z
    .boolean()
    .optional(),
});

/**
 * Create order schema
 */
export const createOrderSchema = z.object({
  productType: z
    .string()
    .min(1, 'Product type is required')
    .trim(),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  orderType: z
    .nativeEnum(OrderType, {
      errorMap: () => ({ message: 'Order type must be ONE_TIME or STANDING' }),
    }),
  deliveryDate: z
    .string()
    .datetime('Delivery date must be a valid date')
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((date) => date > new Date(), {
      message: 'Delivery date must be in the future',
    }),
  deliveryAddressId: z
    .string()
    .min(1, 'Delivery address is required'),
  notes: z
    .string()
    .max(500, 'Notes are too long')
    .trim()
    .optional(),
});

/**
 * Update order by buyer (partial). Only PENDING or PENDING_MODIFICATION.
 */
export const updateOrderSchema = z.object({
  productType: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  quantity: z.number().int().min(1).max(1000000).optional(),
  deliveryDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((date) => date > new Date(), { message: 'Delivery date must be in the future' })
    .optional(),
  deliveryAddressId: z.string().min(1).optional(),
  notes: z.string().max(1000).optional().transform((s) => (s == null || s === '' ? null : s.trim())),
});

/**
 * Record buyer payment to supplier (per delivery assignment). Only ALLOCATION or DELIVERED orders.
 */
export const recordBuyerOrderPaymentSchema = z.object({
  deliveryAssignmentId: z.string().min(1, 'Delivery assignment is required'),
  amountPaid: z.number().positive('Amount must be greater than 0'),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  paymentDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
  notes: z.string().max(500).trim().optional(),
});

/**
 * Create standing order schema
 * preferredDeliveryDayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday
 */
export const createStandingOrderSchema = z.object({
  productType: z
    .string()
    .min(1, 'Product type is required')
    .trim(),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  preferredDeliveryDayOfWeek: z
    .number()
    .int()
    .min(0, 'Day must be 0 (Sunday) to 6 (Saturday)')
    .max(6, 'Day must be 0 (Sunday) to 6 (Saturday)'),
  deliveryAddressId: z
    .string()
    .min(1, 'Delivery address is required'),
  startDate: z
    .string()
    .datetime('Start date must be a valid date')
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((date) => date > new Date(), {
      message: 'Start date must be in the future',
    }),
  endDate: z
    .union([z.string().datetime(), z.date(), z.null()])
    .optional()
    .transform((val) =>
      val == null ? undefined : typeof val === 'string' ? new Date(val) : val
    ),
  notes: z
    .string()
    .max(500, 'Notes are too long')
    .trim()
    .optional(),
});

/**
 * Update standing order (amend details and/or pause/resume)
 */
export const updateStandingOrderSchema = z.object({
  isActive: z.boolean().optional(),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0')
    .optional(),
  preferredDeliveryDayOfWeek: z
    .number()
    .int()
    .min(0, 'Day must be 0 (Sunday) to 6 (Saturday)')
    .max(6, 'Day must be 0 (Sunday) to 6 (Saturday)')
    .optional(),
  deliveryAddressId: z.string().min(1, 'Delivery address is required').optional(),
  startDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .optional(),
  endDate: z
    .union([z.string().datetime(), z.date(), z.null()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val == null ? null : typeof val === 'string' ? new Date(val) : val
    ),
  notes: z.string().max(500, 'Notes are too long').trim().optional(),
});

export type CreateDeliveryAddressInput = z.infer<typeof createDeliveryAddressSchema>;
export type UpdateDeliveryAddressInput = z.infer<typeof updateDeliveryAddressSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateStandingOrderInput = z.infer<typeof createStandingOrderSchema>;
export type UpdateStandingOrderInput = z.infer<typeof updateStandingOrderSchema>;







