import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFarmer } from '../middleware/rbac.js';
import {
  getFarmerDashboardHandler,
  submitAvailabilityHandler,
  getAvailabilityHistoryHandler,
  submitMonthlyAvailabilityHandler,
  getMonthlyAvailabilityHistoryHandler,
  updateMonthlyAvailabilityHandler,
  deleteMonthlyAvailabilityHandler,
  updateAvailabilityHandler,
  deleteAvailabilityHandler,
  getDeliveryAssignmentsHandler,
  getAssignmentByIdHandler,
  updateDeliveryAssignmentHandler,
  cancelDeliveryAssignmentHandler,
  submitDeliveryConfirmationHandler,
  getPerformanceHandler,
  getPerformanceHistoryHandler,
  getPerformanceTrendHandler,
  createSupportTicketHandler,
  getSupportTicketsHandler,
  getSupportTicketByIdHandler,
} from '../controllers/farmer.controller.js';
import {
  getFarmerPaymentsHandler,
  getOutstandingBalanceHandler,
  confirmPaymentReceiptHandler,
  getFarmerBuyerPaymentsHandler,
  confirmBuyerPaymentReceiptHandler,
} from '../controllers/payment.controller.js';
import { getNotificationsHandler } from '../controllers/notification.controller.js';

const router = Router();

// All farmer routes require authentication and farmer role
router.use(authenticate);
router.use(requireFarmer());

/**
 * Farmer Dashboard
 */
router.get('/dashboard', getFarmerDashboardHandler);

/**
 * Farmer Availability Routes
 */
// Submit weekly availability
router.post('/availability', submitAvailabilityHandler);

// Get availability history
router.get('/availability', getAvailabilityHistoryHandler);

// Monthly availability (must be before /availability/:id)
router.get('/availability/monthly', getMonthlyAvailabilityHistoryHandler);
router.post('/availability/monthly', submitMonthlyAvailabilityHandler);
router.patch('/availability/monthly/:id', updateMonthlyAvailabilityHandler);
router.delete('/availability/monthly/:id', deleteMonthlyAvailabilityHandler);

// Update weekly availability by ID
router.patch('/availability/:id', updateAvailabilityHandler);

// Delete weekly availability by ID
router.delete('/availability/:id', deleteAvailabilityHandler);

/**
 * Farmer Payment Routes (Read-only + confirm receipt)
 */
// Get payment history
router.get('/payments', getFarmerPaymentsHandler);

// Get outstanding balance (must be before /:id to avoid "balance" as id)
router.get('/payments/balance', getOutstandingBalanceHandler);

// Confirm receipt of a payment (farmer only, safe: no amount/status change)
router.post('/payments/:id/confirm-receipt', confirmPaymentReceiptHandler);

// Buyer-to-supplier payments (payments from buyers to this farmer)
router.get('/buyer-payments', getFarmerBuyerPaymentsHandler);
router.post('/buyer-payments/:id/confirm-receipt', confirmBuyerPaymentReceiptHandler);

/**
 * Farmer Delivery Assignment Routes (Read-only)
 */
// Get all delivery assignments
router.get('/deliveries', getDeliveryAssignmentsHandler);

// Get specific delivery assignment
router.get('/deliveries/:id', getAssignmentByIdHandler);

// Submit delivery confirmation (must be before PATCH /deliveries/:id)
router.patch('/deliveries/:id/confirmation', submitDeliveryConfirmationHandler);

// Update delivery assignment (estimated time window)
router.patch('/deliveries/:id', updateDeliveryAssignmentHandler);

// Cancel delivery assignment
router.delete('/deliveries/:id', cancelDeliveryAssignmentHandler);

/**
 * Farmer Performance Routes
 * Note: More specific routes must come before less specific ones
 */
// Get performance history (more specific - must come first)
router.get('/performance/history', getPerformanceHistoryHandler);

// Get performance trend (more specific - must come first)
router.get('/performance/trend', getPerformanceTrendHandler);

// Get performance data (less specific - comes last)
router.get('/performance', getPerformanceHandler);

/**
 * Support tickets (request review / dispute performance, general support)
 */
router.post('/support-tickets', createSupportTicketHandler);
router.get('/support-tickets', getSupportTicketsHandler);
router.get('/support-tickets/:id', getSupportTicketByIdHandler);

/**
 * Notifications
 */
router.get('/notifications', getNotificationsHandler);

export default router;

