import { prisma } from '../config/database.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { createError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';

// Password reset token storage (in production, use Redis or database)
// For MVP, we'll store in memory with expiration
interface ResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

const resetTokens = new Map<string, ResetToken>();

// Clean up expired tokens every hour
setInterval(() => {
  const now = new Date();
  const tokensToDelete: string[] = [];
  resetTokens.forEach((data, token) => {
    if (data.expiresAt < now) {
      tokensToDelete.push(token);
    }
  });
  tokensToDelete.forEach((token) => resetTokens.delete(token));
}, 60 * 60 * 1000); // 1 hour

/**
 * Generate password reset token
 * @param emailOrPhone - User's email or phone
 * @returns Reset token (to be sent via email/SMS)
 */
export async function generatePasswordResetToken(
  emailOrPhone: string
): Promise<string> {
  // Find user by email or phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    },
  });

  if (!user) {
    // Don't reveal if user exists (security best practice)
    // Return success even if user doesn't exist
    return 'token_generated'; // Dummy token to prevent user enumeration
  }

  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

  // Store token
  resetTokens.set(token, {
    userId: user.id,
    token,
    expiresAt,
  });

  // In production, you would:
  // 1. Store token in database with expiration
  // 2. Send reset link via email/SMS
  // 3. Include token in the link

  return token;
}

/**
 * Reset password using token
 * @param token - Password reset token
 * @param newPassword - New password
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  // Find token
  const tokenData = resetTokens.get(token);

  if (!tokenData) {
    throw createError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }

  // Check if token is expired
  if (tokenData.expiresAt < new Date()) {
    resetTokens.delete(token);
    throw createError('Reset token has expired', 400, 'TOKEN_EXPIRED');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user password
  await prisma.user.update({
    where: { id: tokenData.userId },
    data: { passwordHash },
  });

  // Delete used token
  resetTokens.delete(token);
}

/**
 * Change password (for authenticated users)
 * @param userId - User ID
 * @param currentPassword - Current password
 * @param newPassword - New password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password
  const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw createError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Verify password reset token (without resetting)
 * Useful for checking if token is valid before showing reset form
 */
export function verifyResetToken(token: string): boolean {
  const tokenData = resetTokens.get(token);

  if (!tokenData) {
    return false;
  }

  // Check if expired
  if (tokenData.expiresAt < new Date()) {
    resetTokens.delete(token);
    return false;
  }

  return true;
}

