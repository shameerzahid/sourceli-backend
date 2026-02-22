import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { AssignmentStatus } from '@prisma/client';
import { notifyUser } from '../services/notificationDelivery.service.js';

/**
 * Notify farmers of deliveries due in ~24 hours.
 */
export async function runDeliveryReminderJob(): Promise<void> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const assignments = await prisma.deliveryAssignment.findMany({
    where: {
      status: AssignmentStatus.PENDING,
      deliveryDate: {
        gte: in24h,
        lt: in25h,
      },
    },
    include: {
      farmer: { select: { userId: true } },
      order: { select: { productType: true } },
    },
  });

  for (const a of assignments) {
    await notifyUser(
      a.farmer.userId,
      'DELIVERY_REMINDER',
      'Delivery tomorrow',
      `Reminder: You have a delivery of ${a.assignedQuantity} units of ${a.order.productType} scheduled for tomorrow.`,
      { deliveryAssignmentId: a.id }
    ).catch((err) => console.error('[DeliveryReminderJob]', err));
  }

  if (assignments.length > 0) {
    console.log(`[DeliveryReminderJob] Sent ${assignments.length} delivery reminder(s).`);
  }
}

/**
 * Schedule delivery reminder job - runs daily at 08:00.
 */
export function scheduleDeliveryReminderJob(): void {
  cron.schedule('0 8 * * *', () => {
    runDeliveryReminderJob();
  });
  console.log('[DeliveryReminderJob] Scheduled: daily at 08:00');
}
