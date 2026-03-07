import { prisma } from '../config/database.js';

export interface AuditLogData {
  userId?: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  details: Record<string, any>;
  ipAddress?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        actionType: data.actionType,
        entityType: data.entityType,
        entityId: data.entityId || null,
        details: data.details,
        ipAddress: data.ipAddress || null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters?: {
  userId?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.actionType) {
    where.actionType = filters.actionType;
  }
  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters?.entityId) {
    where.entityId = filters.entityId;
  }
  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate;
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: filters?.limit || 100,
    skip: filters?.offset || 0,
  });

  return logs;
}

/**
 * Get total count of audit logs matching filters (for pagination)
 */
export async function getAuditLogsCount(filters?: {
  userId?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: any = {};

  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.actionType) {
    where.actionType = filters.actionType;
  }
  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters?.entityId) {
    where.entityId = filters.entityId;
  }
  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate;
    }
  }

  return prisma.auditLog.count({ where });
}

/**
 * Get a single audit log by ID (for admin review)
 */
export async function getAuditLogById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

/**
 * Update an audit log (admin only). Only details can be updated (e.g. correction/note).
 */
export async function updateAuditLog(
  id: string,
  data: { details: Record<string, any> }
) {
  return prisma.auditLog.update({
    where: { id },
    data: { details: data.details },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

/**
 * Create an audit log entry and return it (admin manual entry). Uses provided userId (e.g. current admin).
 */
export async function createAuditLogEntry(data: AuditLogData) {
  return prisma.auditLog.create({
    data: {
      userId: data.userId || null,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId || null,
      details: data.details,
      ipAddress: data.ipAddress || null,
      timestamp: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });
}


