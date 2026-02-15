import { z } from 'zod';

/**
 * Allocation assignment schema
 */
export const allocationAssignmentSchema = z.object({
  farmerId: z.string().min(1, 'Farmer ID is required'),
  assignedQuantity: z
    .number()
    .int('Assigned quantity must be a whole number')
    .positive('Assigned quantity must be greater than 0'),
});

/**
 * Create allocation schema
 */
export const createAllocationSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  assignments: z
    .array(allocationAssignmentSchema)
    .min(1, 'At least one assignment is required'),
});

/**
 * Update assignment schema
 */
export const updateAssignmentSchema = z.object({
  assignedQuantity: z
    .number()
    .int('Assigned quantity must be a whole number')
    .positive('Assigned quantity must be greater than 0'),
});

export type AllocationAssignmentInput = z.infer<typeof allocationAssignmentSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;







