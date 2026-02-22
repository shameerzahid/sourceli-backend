import { prisma } from '../config/database.js';
import { AssignmentStatus, OrderStatus } from '@prisma/client';
import { getPerformanceData } from './performance.service.js';
import { getUnreadCount } from './notification.service.js';

/**
 * Dashboard stats for farmer (upcoming deliveries, score/tier, notifications).
 * Requires userId (from auth). Resolves farmer by userId.
 */
export async function getFarmerDashboard(userId: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { userId },
  });

  if (!farmer) {
    return null;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [upcomingDeliveriesCount, performanceData, unreadNotificationsCount] =
    await Promise.all([
      prisma.deliveryAssignment.count({
        where: {
          farmerId: farmer.id,
          status: AssignmentStatus.PENDING,
          deliveryDate: { gte: startOfToday },
        },
      }),
      getPerformanceData(farmer.id),
      getUnreadCount(userId),
    ]);

  const performance = performanceData?.performance ?? null;
  return {
    upcomingDeliveriesCount,
    score: performance?.score ?? null,
    tier: performance?.tier ?? null,
    unreadNotificationsCount,
  };
}

/**
 * Dashboard stats for buyer (active orders, standing orders, notifications).
 * Requires userId (from auth). Resolves buyer by userId.
 */
export async function getBuyerDashboard(userId: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { userId },
  });

  if (!buyer) {
    return null;
  }

  const [activeOrdersCount, standingOrdersCount, unreadNotificationsCount] =
    await Promise.all([
      prisma.order.count({
        where: {
          buyerId: buyer.id,
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.APPROVED,
              OrderStatus.ALLOCATION,
            ],
          },
        },
      }),
      prisma.standingOrder.count({
        where: {
          buyerId: buyer.id,
          isActive: true,
        },
      }),
      getUnreadCount(userId),
    ]);

  return {
    activeOrdersCount,
    standingOrdersCount,
    unreadNotificationsCount,
  };
}
