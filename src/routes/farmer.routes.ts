import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFarmer } from '../middleware/rbac.js';
import {
  submitAvailabilityHandler,
  getAvailabilityHistoryHandler,
  getDeliveryAssignmentsHandler,
  getAssignmentByIdHandler,
} from '../controllers/farmer.controller.js';
import {
  getFarmerPaymentsHandler,
  getOutstandingBalanceHandler,
} from '../controllers/payment.controller.js';

const router = Router();

// All farmer routes require authentication and farmer role
router.use(authenticate);
router.use(requireFarmer());

/**
 * Farmer Availability Routes
 */
// Submit weekly availability
router.post('/availability', submitAvailabilityHandler);

// Get availability history
router.get('/availability', getAvailabilityHistoryHandler);

/**
 * Farmer Payment Routes (Read-only)
 */
// Get payment history
router.get('/payments', getFarmerPaymentsHandler);

// Get outstanding balance
router.get('/payments/balance', getOutstandingBalanceHandler);

/**
 * Farmer Delivery Assignment Routes (Read-only)
 */
// Get all delivery assignments
router.get('/deliveries', getDeliveryAssignmentsHandler);

// Get specific delivery assignment
router.get('/deliveries/:id', getAssignmentByIdHandler);

export default router;

