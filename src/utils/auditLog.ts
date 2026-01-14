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


