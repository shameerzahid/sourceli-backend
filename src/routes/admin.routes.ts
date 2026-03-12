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
  getFarmerByIdHandler,
  updateFarmerHandler,
  getAllBuyersHandler,
  getBuyerByIdHandler,
  updateBuyerHandler,
  updateFarmerStatusHandler,
  updateBuyerStatusHandler,
  getAdminStatsHandler,
  getPendingOrdersHandler,
  approveOrderHandler,
  rejectOrderHandler,
  requestOrderModificationHandler,
  createOrderHandler,
  updateOrderHandler,
  deleteOrderHandler,
  getBuyerOrderPaymentsHandler,
  confirmBuyerOrderPaymentHandler,
} from '../controllers/admin.controller.js';
import {
  getAllocationDataHandler,
  createAssignmentsHandler,
  updateAssignmentHandler,
  deleteAssignmentHandler,
  getAllDeliveryAssignmentsHandler,
  getDeliveryAssignmentByIdHandler,
  createDeliveryByAdminHandler,
  confirmDeliveryHandler,
} from '../controllers/allocation.controller.js';
import {
  recordPaymentHandler,
  getPaymentReportsHandler,
  getPaymentByIdHandler,
  updatePaymentHandler,
  deletePaymentHandler,
} from '../controllers/payment.controller.js';
import {
  getPerformanceRulesHandler,
  updatePerformanceRulesHandler,
  getPerformanceByFarmerIdHandler,
  overridePerformanceHandler,
  getPricingBandsHandler,
  updatePricingBandHandler,
  createProduceCategoryHandler,
  getAuditLogsHandler,
  getAuditLogByIdHandler,
  updateAuditLogHandler,
  createAuditLogManualHandler,
  getSupportTicketsHandler,
  getSupportTicketByIdHandler,
  respondToSupportTicketHandler,
  updateSupportTicketHandler,
  createSupportTicketByAdminHandler,
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
router.get('/farmers/:id', getFarmerByIdHandler);
router.patch('/farmers/:id', updateFarmerHandler);
router.post('/farmers', createSupplierHandler);
router.put('/farmers/:id/status', updateFarmerStatusHandler);
router.get('/buyers', getAllBuyersHandler);
router.get('/buyers/:id', getBuyerByIdHandler);
router.patch('/buyers/:id', updateBuyerHandler);
router.post('/buyers', createBuyerHandler);
router.put('/buyers/:id/status', updateBuyerStatusHandler);

// Order Management
router.get('/orders/pending', getPendingOrdersHandler);
router.post('/orders', createOrderHandler);
router.patch('/orders/:id', updateOrderHandler);
router.delete('/orders/:id', deleteOrderHandler);
router.post('/orders/:id/approve', approveOrderHandler);
router.post('/orders/:id/reject', rejectOrderHandler);
router.post('/orders/:id/request-modification', requestOrderModificationHandler);

// Allocation Management
router.get('/allocations', getAllocationDataHandler);
router.post('/allocations', createAssignmentsHandler);
router.put('/allocations/:id', updateAssignmentHandler);
router.delete('/allocations/:id', deleteAssignmentHandler);

// Deliveries: list, get one, create, update, delete, confirm
router.get('/deliveries', getAllDeliveryAssignmentsHandler);
router.get('/deliveries/:id', getDeliveryAssignmentByIdHandler);
router.post('/deliveries', createDeliveryByAdminHandler);
router.patch('/deliveries/:id', updateAssignmentHandler);
router.delete('/deliveries/:id', deleteAssignmentHandler);
router.post('/deliveries/:id/confirm', confirmDeliveryHandler);

// Payment Management
router.get('/payments', getPaymentReportsHandler);
router.get('/payments/:id', getPaymentByIdHandler);
router.post('/payments', recordPaymentHandler);
router.patch('/payments/:id', updatePaymentHandler);
router.delete('/payments/:id', deletePaymentHandler);

// Buyer-to-supplier payments (buyer recorded; admin confirms)
router.get('/buyer-order-payments', getBuyerOrderPaymentsHandler);
router.post('/buyer-order-payments/:id/confirm', confirmBuyerOrderPaymentHandler);

// Performance rules (US-ADMIN-006), review, and override (US-ADMIN-009)
router.get('/performance-rules', getPerformanceRulesHandler);
router.put('/performance-rules', updatePerformanceRulesHandler);
router.get('/performance/:farmerId', getPerformanceByFarmerIdHandler);
router.post('/performance/override', overridePerformanceHandler);

// Pricing bands (US-ADMIN-005) and produce categories
router.get('/pricing-bands', getPricingBandsHandler);
router.put('/pricing-bands', updatePricingBandHandler);
router.post('/produce-categories', createProduceCategoryHandler);

// Audit logs (reportable, US-SYS-003)
router.get('/audit-logs', getAuditLogsHandler);
router.get('/audit-logs/:id', getAuditLogByIdHandler);
router.patch('/audit-logs/:id', updateAuditLogHandler);
router.post('/audit-logs', createAuditLogManualHandler);

// Support tickets
router.get('/support-tickets', getSupportTicketsHandler);
router.post('/support-tickets', createSupportTicketByAdminHandler);
router.get('/support-tickets/:id', getSupportTicketByIdHandler);
router.patch('/support-tickets/:id', updateSupportTicketHandler);
router.post('/support-tickets/:id/respond', respondToSupportTicketHandler);

export default router;

