import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import {
  getPendingFarmerApplicationsHandler,
  getFarmerApplicationByIdHandler,
  approveFarmerApplicationHandler,
  rejectFarmerApplicationHandler,
  createSupplierHandler,
  getPendingBuyerRegistrationsHandler,
  getBuyerRegistrationByIdHandler,
  approveBuyerRegistrationHandler,
  rejectBuyerRegistrationHandler,
  createBuyerHandler,
  getAllFarmersHandler,
  getAllBuyersHandler,
  updateFarmerStatusHandler,
  updateBuyerStatusHandler,
  getAdminStatsHandler,
  getPendingOrdersHandler,
  approveOrderHandler,
  rejectOrderHandler,
  requestOrderModificationHandler,
} from '../controllers/admin.controller.js';
import {
  getAllocationDataHandler,
  createAssignmentsHandler,
  updateAssignmentHandler,
  deleteAssignmentHandler,
  getAllDeliveryAssignmentsHandler,
  confirmDeliveryHandler,
} from '../controllers/allocation.controller.js';
import {
  recordPaymentHandler,
  getPaymentReportsHandler,
} from '../controllers/payment.controller.js';
import {
  getPerformanceRulesHandler,
  updatePerformanceRulesHandler,
  overridePerformanceHandler,
  getPricingBandsHandler,
  updatePricingBandHandler,
  createProduceCategoryHandler,
  getAuditLogsHandler,
  getSupportTicketsHandler,
  getSupportTicketByIdHandler,
  respondToSupportTicketHandler,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use((req, res, next) => {
  console.log(`[ADMIN ROUTE] ${req.method} ${req.path}`);
  next();
});

router.use(authenticate);
router.use(requireAdmin()); // Call requireAdmin() to get the middleware function

// Admin dashboard stats
router.get('/stats', (req, res, next) => {
  console.log(`[ADMIN ROUTE] GET /stats - Request received`);
  next();
}, getAdminStatsHandler);

// Farmer Application Management
router.get('/farmers/applications', getPendingFarmerApplicationsHandler);
router.get('/farmers/applications/:id', getFarmerApplicationByIdHandler);
router.post('/farmers/applications/:id/approve', approveFarmerApplicationHandler);
router.post('/farmers/applications/:id/reject', rejectFarmerApplicationHandler);

// Buyer Registration Management
router.get('/buyers/registrations', getPendingBuyerRegistrationsHandler);
router.get('/buyers/registrations/:id', getBuyerRegistrationByIdHandler);
router.post('/buyers/registrations/:id/approve', approveBuyerRegistrationHandler);
router.post('/buyers/registrations/:id/reject', rejectBuyerRegistrationHandler);

// User Management
router.get('/farmers', getAllFarmersHandler);
router.post('/farmers', createSupplierHandler);
router.put('/farmers/:id/status', updateFarmerStatusHandler);
router.get('/buyers', getAllBuyersHandler);
router.post('/buyers', createBuyerHandler);
router.put('/buyers/:id/status', updateBuyerStatusHandler);

// Order Management
router.get('/orders/pending', getPendingOrdersHandler);
router.post('/orders/:id/approve', approveOrderHandler);
router.post('/orders/:id/reject', rejectOrderHandler);
router.post('/orders/:id/request-modification', requestOrderModificationHandler);

// Allocation Management
router.get('/allocations', getAllocationDataHandler);
router.post('/allocations', createAssignmentsHandler);
router.put('/allocations/:id', updateAssignmentHandler);
router.delete('/allocations/:id', deleteAssignmentHandler);

// Delivery Confirmation (US-ADMIN-008)
router.get('/deliveries', getAllDeliveryAssignmentsHandler);
router.post('/deliveries/:id/confirm', confirmDeliveryHandler);

// Payment Management
router.post('/payments', recordPaymentHandler);
router.get('/payments', getPaymentReportsHandler);

// Performance rules (US-ADMIN-006) and override (US-ADMIN-009)
router.get('/performance-rules', getPerformanceRulesHandler);
router.put('/performance-rules', updatePerformanceRulesHandler);
router.post('/performance/override', overridePerformanceHandler);

// Pricing bands (US-ADMIN-005) and produce categories
router.get('/pricing-bands', getPricingBandsHandler);
router.put('/pricing-bands', updatePricingBandHandler);
router.post('/produce-categories', createProduceCategoryHandler);

// Audit logs (reportable, US-SYS-003)
router.get('/audit-logs', getAuditLogsHandler);

// Support tickets
router.get('/support-tickets', getSupportTicketsHandler);
router.get('/support-tickets/:id', getSupportTicketByIdHandler);
router.post('/support-tickets/:id/respond', respondToSupportTicketHandler);

export default router;

