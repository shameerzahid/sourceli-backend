import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { TicketStatus } from '@prisma/client';

export interface CreateSupportTicketData {
  subject: string;
  message: string;
}

export interface RespondToTicketData {
  adminResponse: string;
  status?: TicketStatus;
}

/**
 * Create a support ticket (buyer only - enforced at route level).
 */
export async function createSupportTicket(
  userId: string,
  data: CreateSupportTicketData
) {
  return prisma.supportTicket.create({
    data: {
      userId,
      subject: data.subject.trim(),
      message: data.message.trim(),
      status: TicketStatus.OPEN,
    },
  });
}

/**
 * List support tickets for a buyer (own tickets only).
 */
export async function listSupportTicketsByBuyer(userId: string, options?: { status?: TicketStatus; limit?: number }) {
  const limit = Math.min(options?.limit ?? 50, 100);
  const where: { userId: string; status?: TicketStatus } = { userId };
  if (options?.status) where.status = options.status;

  return prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get a single support ticket by ID (buyer: must own it).
 */
export async function getSupportTicketByIdForBuyer(ticketId: string, userId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) {
    throw createError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }
  return ticket;
}

export interface UpdateSupportTicketByBuyerData {
  subject?: string;
  message?: string;
}

/**
 * Buyer updates own ticket (subject and/or message). Allowed only when admin has not responded yet.
 */
export async function updateSupportTicketByBuyer(
  ticketId: string,
  userId: string,
  data: UpdateSupportTicketByBuyerData
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) {
    throw createError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }
  if (ticket.adminResponse != null) {
    throw createError('Cannot edit ticket after admin has responded', 400, 'TICKET_ALREADY_RESPONDED');
  }

  const updateData: { subject?: string; message?: string } = {};
  if (data.subject !== undefined) updateData.subject = data.subject.trim();
  if (data.message !== undefined) updateData.message = data.message.trim();
  if (Object.keys(updateData).length === 0) {
    throw createError('At least one of subject or message is required', 400, 'VALIDATION_ERROR');
  }

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: updateData,
  });
}

/**
 * Buyer deletes own ticket. Allowed only when admin has not responded yet.
 */
export async function deleteSupportTicketByBuyer(ticketId: string, userId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) {
    throw createError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }
  if (ticket.adminResponse != null) {
    throw createError('Cannot delete ticket after admin has responded', 400, 'TICKET_ALREADY_RESPONDED');
  }

  await prisma.supportTicket.delete({
    where: { id: ticketId },
  });
  return { deleted: true };
}

/**
 * List all support tickets (admin). Optional filter by status.
 */
export async function listAllSupportTickets(options?: { status?: TicketStatus; limit?: number }) {
  const limit = Math.min(options?.limit ?? 100, 200);
  const where: { status?: TicketStatus } = {};
  if (options?.status) where.status = options.status;

  return prisma.supportTicket.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get a support ticket by ID (admin - any ticket).
 */
export async function getSupportTicketByIdForAdmin(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
        },
      },
    },
  });
  if (!ticket) {
    throw createError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }
  return ticket;
}

/**
 * Admin respond to a support ticket (set response, status, resolvedAt when RESOLVED).
 */
export async function respondToSupportTicket(
  ticketId: string,
  adminId: string,
  data: RespondToTicketData
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw createError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      adminResponse: data.adminResponse.trim(),
      adminRespondedBy: adminId,
      adminRespondedAt: new Date(),
      status: data.status ?? ticket.status,
    },
  });

  return updated;
}

export interface UpdateSupportTicketData {
  status?: TicketStatus;
  adminResponse?: string;
}

/**
 * Admin update a support ticket (status and/or response). At least one field required.
 * Used for edit response, close/cancel, escalate.
 */
export async function updateSupportTicket(
  ticketId: string,
  adminId: string,
  data: UpdateSupportTicketData
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw createError('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.adminResponse !== undefined) {
    updateData.adminResponse = data.adminResponse.trim();
    updateData.adminRespondedBy = adminId;
    updateData.adminRespondedAt = new Date();
  }

  if (Object.keys(updateData).length === 0) {
    throw createError('At least one of status or adminResponse is required', 400, 'VALIDATION_ERROR');
  }

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
        },
      },
    },
  });
}

/**
 * Admin create a support ticket on behalf of a user.
 */
export async function createSupportTicketByAdmin(
  userId: string,
  data: CreateSupportTicketData
) {
  return prisma.supportTicket.create({
    data: {
      userId,
      subject: data.subject.trim(),
      message: data.message.trim(),
      status: TicketStatus.OPEN,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
        },
      },
    },
  });
}
