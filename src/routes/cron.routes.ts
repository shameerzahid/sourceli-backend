import { Router, Request, Response } from 'express';
import { runStandingOrderGenerationJob } from '../jobs/standingOrderJob.js';
import { runDeliveryReminderJob } from '../jobs/deliveryReminderJob.js';

const router = Router();
const CRON_SECRET = process.env.CRON_SECRET;

function cronAuth(req: Request, res: Response, next: () => void) {
  if (!CRON_SECRET) {
    return next();
  }
  const auth = req.headers.authorization;
  const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-cron-secret'];
  if (secret !== CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

async function runStandingOrders(_req: Request, res: Response) {
  try {
    await runStandingOrderGenerationJob();
    res.status(200).json({ ok: true, message: 'Standing order job completed.' });
  } catch (error) {
    console.error('[Cron] standing-orders:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Job failed.' });
  }
}

async function runDeliveryReminders(_req: Request, res: Response) {
  try {
    await runDeliveryReminderJob();
    res.status(200).json({ ok: true, message: 'Delivery reminder job completed.' });
  } catch (error) {
    console.error('[Cron] delivery-reminders:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Job failed.' });
  }
}

/**
 * /api/cron/standing-orders – generate orders from standing orders (weekly).
 * Public if CRON_SECRET is not set. GET or POST.
 */
router.get('/standing-orders', cronAuth, runStandingOrders);
router.post('/standing-orders', cronAuth, runStandingOrders);

/**
 * /api/cron/delivery-reminders – send delivery reminders (daily).
 * Public if CRON_SECRET is not set. GET or POST.
 */
router.get('/delivery-reminders', cronAuth, runDeliveryReminders);
router.post('/delivery-reminders', cronAuth, runDeliveryReminders);

export default router;
