import cron from 'node-cron';
import { generateOrdersFromStandingOrders } from '../services/standingOrder.service.js';
import { createAuditLog } from '../utils/auditLog.js';

/**
 * Run the standing order generation job once.
 * Creates orders from active standing orders for the next delivery date.
 */
export async function runStandingOrderGenerationJob(): Promise<void> {
  try {
    const { created, orderIds } = await generateOrdersFromStandingOrders();
    if (created > 0) {
      await createAuditLog({
        actionType: 'STANDING_ORDERS_GENERATED',
        entityType: 'System',
        details: { created, orderIds },
      });
      console.log(`[StandingOrderJob] Generated ${created} order(s) from standing orders.`);
    }
  } catch (error) {
    console.error('[StandingOrderJob] Error generating orders from standing orders:', error);
  }
}

/**
 * Schedule the standing order generation job.
 * Runs every Monday at 01:00 (1am) - generates orders for the week.
 */
export function scheduleStandingOrderJob(): void {
  cron.schedule('0 1 * * 1', () => {
    runStandingOrderGenerationJob();
  });
  console.log('[StandingOrderJob] Scheduled: every Monday at 01:00');
}
