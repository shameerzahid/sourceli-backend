import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import {
  getPendingFarmerApplicationsHandler,
  getFarmerApplicationByIdHandler,
  approveFarmerApplicationHandler,
  rejectFarmerApplicationHandler,
  getPendingBuyerRegistrationsHandler,
  getBuyerRegistrationByIdHandler,
  approveBuyerRegistrationHandler,
  rejectBuyerRegistrationHandler,
  getAllFarmersHandler,
  getAllBuyersHandler,
  updateFarmerStatusHandler,
  updateBuyerStatusHandler,
  getAdminStatsHandler,
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
router.put('/farmers/:id/status', updateFarmerStatusHandler);
router.get('/buyers', getAllBuyersHandler);
router.put('/buyers/:id/status', updateBuyerStatusHandler);

export default router;

