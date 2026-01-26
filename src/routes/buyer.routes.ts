import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBuyer } from '../middleware/rbac.js';
import {
  getDeliveryAddressesHandler,
  createDeliveryAddressHandler,
  updateDeliveryAddressHandler,
  deleteDeliveryAddressHandler,
  createOrderHandler,
  getOrdersHandler,
  getOrderByIdHandler,
} from '../controllers/buyer.controller.js';

const router = Router();

// All buyer routes require authentication and buyer role
router.use(authenticate);
router.use(requireBuyer());

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

export default router;


