import { z } from 'zod';

/**
 * Weekly availability submission schema
 */
export const weeklyAvailabilitySchema = z.object({
  productType: z
    .string()
    .min(1, 'Product type is required')
    .trim(),
  quantityAvailable: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  avgWeight: z
    .number()
    .positive('Average weight must be positive')
    .optional(),
  pricePerUnit: z
    .number()
    .positive('Price per unit must be positive')
    .optional()
    .nullable(),
  readyDate: z
    .string()
    .datetime('Ready date must be a valid date')
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((date) => date > new Date(), {
      message: 'Ready date must be in the future',
    }),
});

export type WeeklyAvailabilityInput = z.infer<typeof weeklyAvailabilitySchema>;

/**
 * Weekly availability update schema (partial; at least one field required)
 */
export const weeklyAvailabilityUpdateSchema = z
  .object({
    quantityAvailable: z
      .number()
      .int('Quantity must be a whole number')
      .positive('Quantity must be greater than 0')
      .optional(),
    avgWeight: z
      .number()
      .positive('Average weight must be positive')
      .optional()
      .nullable(),
    pricePerUnit: z
      .number()
      .positive('Price per unit must be positive')
      .optional()
      .nullable(),
    readyDate: z
      .string()
      .datetime('Ready date must be a valid date')
      .or(z.date())
      .transform((val) => (typeof val === 'string' ? new Date(val) : val))
      .refine((date) => date > new Date(), {
        message: 'Ready date must be in the future',
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.quantityAvailable !== undefined ||
      data.avgWeight !== undefined ||
      data.readyDate !== undefined ||
      data.pricePerUnit !== undefined,
    { message: 'At least one field (quantityAvailable, avgWeight, pricePerUnit, or readyDate) is required' }
  );

export type WeeklyAvailabilityUpdateInput = z.infer<typeof weeklyAvailabilityUpdateSchema>;

/**
 * Monthly availability submission schema (same shape as weekly)
 */
export const monthlyAvailabilitySchema = z.object({
  productType: z
    .string()
    .min(1, 'Product type is required')
    .trim(),
  quantityAvailable: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  avgWeight: z
    .number()
    .positive('Average weight must be positive')
    .optional(),
  pricePerUnit: z
    .number()
    .positive('Price per unit must be positive')
    .optional()
    .nullable(),
  readyDate: z
    .string()
    .datetime('Ready date must be a valid date')
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((date) => date > new Date(), {
      message: 'Ready date must be in the future',
    }),
});

export type MonthlyAvailabilityInput = z.infer<typeof monthlyAvailabilitySchema>;

/**
 * Monthly availability update schema (partial; at least one field required)
 */
export const monthlyAvailabilityUpdateSchema = z
  .object({
    quantityAvailable: z
      .number()
      .int('Quantity must be a whole number')
      .positive('Quantity must be greater than 0')
      .optional(),
    avgWeight: z
      .number()
      .positive('Average weight must be positive')
      .optional()
      .nullable(),
    pricePerUnit: z
      .number()
      .positive('Price per unit must be positive')
      .optional()
      .nullable(),
    readyDate: z
      .string()
      .datetime('Ready date must be a valid date')
      .or(z.date())
      .transform((val) => (typeof val === 'string' ? new Date(val) : val))
      .refine((date) => date > new Date(), {
        message: 'Ready date must be in the future',
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.quantityAvailable !== undefined ||
      data.avgWeight !== undefined ||
      data.readyDate !== undefined ||
      data.pricePerUnit !== undefined,
    { message: 'At least one field (quantityAvailable, avgWeight, pricePerUnit, or readyDate) is required' }
  );

export type MonthlyAvailabilityUpdateInput = z.infer<typeof monthlyAvailabilityUpdateSchema>;

/**
 * Delivery assignment update (farmer can set estimated time window only)
 */
export const deliveryAssignmentUpdateSchema = z.object({
  estimatedTimeWindow: z
    .string()
    .max(50, 'Estimated time window must be at most 50 characters')
    .optional()
    .nullable(),
});

export type DeliveryAssignmentUpdateInput = z.infer<typeof deliveryAssignmentUpdateSchema>;

/**
 * Farmer submit delivery confirmation (quantity delivered + notes)
 */
export const deliveryConfirmationSchema = z.object({
  quantityDelivered: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity delivered cannot be negative'),
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional()
    .nullable(),
});

export type DeliveryConfirmationInput = z.infer<typeof deliveryConfirmationSchema>;

