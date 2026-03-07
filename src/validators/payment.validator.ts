import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

/**
 * Record payment schema
 */
export const recordPaymentSchema = z.object({
  farmerId: z.string().min(1, 'Farmer ID is required'),
  deliveryAssignmentId: z.string().optional(),
  amountPaid: z
    .number()
    .positive('Payment amount must be greater than 0'),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  paymentDate: z
    .string()
    .datetime('Payment date must be a valid date')
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
  notes: z
    .string()
    .max(500, 'Notes are too long')
    .trim()
    .optional(),
});

/**
 * Payment report filters schema
 */
export const paymentReportFiltersSchema = z.object({
  farmerId: z.string().optional(),
  startDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .optional(),
  paymentStatus: z.enum(['NOT_PAID', 'PARTIALLY_PAID', 'PAID']).optional(),
});

/**
 * Update payment schema (admin only)
 */
export const updatePaymentSchema = z.object({
  amountPaid: z.number().positive('Amount must be greater than 0').optional(),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }).optional(),
  paymentDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .optional(),
  notes: z.string().max(500).trim().optional().nullable(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type PaymentReportFiltersInput = z.infer<typeof paymentReportFiltersSchema>;







