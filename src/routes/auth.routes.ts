import { Router } from 'express';
import {
  registerFarmerHandler,
  registerBuyerHandler,
  loginHandler,
  getMeHandler,
  updateMeHandler,
  refreshTokenHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyResetTokenHandler,
  changePasswordHandler,
  uploadFarmPhotoHandler,
  uploadRegisterProfilePhotoHandler,
  uploadAvatarHandler,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { uploadFarmPhotos, uploadSingleFarmPhoto, uploadSingleAvatar } from '../middleware/upload.js';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Single farm photo upload (for upload-on-add during registration). Returns { url }.
router.post('/upload/farm-photo', uploadSingleFarmPhoto, uploadFarmPhotoHandler);

// Profile photo during registration (no auth). Returns { url }.
router.post(
  '/upload/register-profile-photo',
  uploadSingleFarmPhoto,
  uploadRegisterProfilePhotoHandler
);

// Farmer registration: multipart (with photos) or JSON (with pre-uploaded photoUrls)
router.post(
  '/register/farmer',
  (req, res, next) => {
    if (req.is('multipart/form-data')) {
      return uploadFarmPhotos(req, res, next);
    }
    next();
  },
  registerFarmerHandler
);
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

// Update current user profile
router.patch('/me', authenticate, updateMeHandler);

// Upload profile picture (authenticated)
router.put('/upload/avatar', authenticate, uploadSingleAvatar, uploadAvatarHandler);

// Refresh token
router.post('/refresh', refreshTokenHandler);

// Logout
router.post('/logout', authenticate, logoutHandler);

// Change password (authenticated users)
router.post('/change-password', authenticate, changePasswordHandler);

export default router;

