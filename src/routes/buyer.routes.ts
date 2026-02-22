import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBuyer } from '../middleware/rbac.js';
import {
  getBuyerDashboardHandler,
  getDeliveryAddressesHandler,
  createDeliveryAddressHandler,
  updateDeliveryAddressHandler,
  deleteDeliveryAddressHandler,
  createOrderHandler,
  getOrdersHandler,
  getOrderByIdHandler,
  createStandingOrderHandler,
  getStandingOrdersHandler,
  getStandingOrderByIdHandler,
  updateStandingOrderHandler,
  createSupportTicketHandler,
  getSupportTicketsHandler,
  getSupportTicketByIdHandler,
} from '../controllers/buyer.controller.js';
import { getNotificationsHandler } from '../controllers/notification.controller.js';

const router = Router();

// All buyer routes require authentication and buyer role
router.use(authenticate);
router.use(requireBuyer());

/**
 * Buyer Dashboard
 */
router.get('/dashboard', getBuyerDashboardHandler);

/**
 * Delivery Address Routes
 */
router.get('/delivery-addresses', getDeliveryAddressesHandler);
router.post('/delivery-addresses', createDeliveryAddressHandler);
router.put('/delivery-addresses/:id', updateDeliveryAddressHandler);
router.delete('/delivery-addresses/:id', deleteDeliveryAddressHandler);

/**
 * Order Routes
 */
router.post('/orders', createOrderHandler);
router.get('/orders', getOrdersHandler);
router.get('/orders/:id', getOrderByIdHandler);

/**
 * Standing order routes
 */
router.post('/standing-orders', createStandingOrderHandler);
router.get('/standing-orders', getStandingOrdersHandler);
router.get('/standing-orders/:id', getStandingOrderByIdHandler);
router.put('/standing-orders/:id', updateStandingOrderHandler);

/**
 * Notifications
 */
router.get('/notifications', getNotificationsHandler);

/**
 * Support tickets (buyer only)
 */
router.post('/support-tickets', createSupportTicketHandler);
router.get('/support-tickets', getSupportTicketsHandler);
router.get('/support-tickets/:id', getSupportTicketByIdHandler);

export default router;







