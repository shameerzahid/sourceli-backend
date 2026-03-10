import { z } from 'zod';
import { TicketStatus } from '@prisma/client';

export const createSupportTicketSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject is too long')
    .trim(),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message is too long')
    .trim(),
});

export const respondToSupportTicketSchema = z.object({
  adminResponse: z
    .string()
    .min(1, 'Response is required')
    .max(2000, 'Response is too long')
    .trim(),
  status: z
    .nativeEnum(TicketStatus, {
      errorMap: () => ({ message: 'Status must be OPEN, IN_PROGRESS, or RESOLVED' }),
    })
    .optional(),
});

export const updateSupportTicketSchema = z
  .object({
    status: z
      .nativeEnum(TicketStatus, {
        errorMap: () => ({ message: 'Status must be OPEN, IN_PROGRESS, or RESOLVED' }),
      })
      .optional(),
    adminResponse: z
      .string()
      .max(2000, 'Response is too long')
      .trim()
      .optional(),
  })
  .refine((data) => data.status !== undefined || (data.adminResponse !== undefined && data.adminResponse !== ''), {
    message: 'At least one of status or adminResponse is required',
  });

export const createSupportTicketByAdminSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject is too long')
    .trim(),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message is too long')
    .trim(),
});

/** Buyer update own ticket (subject and/or message). At least one required. */
export const updateSupportTicketByBuyerSchema = z
  .object({
    subject: z
      .string()
      .min(1, 'Subject cannot be empty')
      .max(200, 'Subject is too long')
      .trim()
      .optional(),
    message: z
      .string()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message is too long')
      .trim()
      .optional(),
  })
  .refine((data) => (data.subject !== undefined && data.subject !== '') || (data.message !== undefined && data.message !== ''), {
    message: 'At least one of subject or message is required',
  });

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type RespondToSupportTicketInput = z.infer<typeof respondToSupportTicketSchema>;
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
export type CreateSupportTicketByAdminInput = z.infer<typeof createSupportTicketByAdminSchema>;
export type UpdateSupportTicketByBuyerInput = z.infer<typeof updateSupportTicketByBuyerSchema>;
