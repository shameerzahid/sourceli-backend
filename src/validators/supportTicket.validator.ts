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

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type RespondToSupportTicketInput = z.infer<typeof respondToSupportTicketSchema>;
