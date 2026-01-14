import { Router } from 'express';
import {
  registerFarmerHandler,
  registerBuyerHandler,
  loginHandler,
  getMeHandler,
  refreshTokenHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyResetTokenHandler,
  changePasswordHandler,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { uploadFarmPhotos } from '../middleware/upload.js';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Registration routes
// Farmer registration accepts multipart/form-data with photos
router.post('/register/farmer', uploadFarmPhotos, registerFarmerHandler);
router.post('/register/buyer', registerBuyerHandler);

// Login route
router.post('/login', loginHandler);

// Password reset routes
router.post('/forgot-password', forgotPasswordHandler);
router.post('/reset-password', resetPasswordHandler);
router.get('/verify-reset-token/:token', verifyResetTokenHandler);

/**
 * Protected routes (authentication required)
 */

// Get current user profile
router.get('/me', authenticate, getMeHandler);

// Refresh token
router.post('/refresh', refreshTokenHandler);

// Logout
router.post('/logout', authenticate, logoutHandler);

// Change password (authenticated users)
router.post('/change-password', authenticate, changePasswordHandler);

export default router;

