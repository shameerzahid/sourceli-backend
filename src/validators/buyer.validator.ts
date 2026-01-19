import { z } from 'zod';
import { OrderType } from '@prisma/client';

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

export type CreateDeliveryAddressInput = z.infer<typeof createDeliveryAddressSchema>;
export type UpdateDeliveryAddressInput = z.infer<typeof updateDeliveryAddressSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

