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



