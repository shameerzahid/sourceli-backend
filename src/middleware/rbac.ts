import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * Role-based access control middleware
 * Checks if user has required role(s)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or '),
      });
      return;
    }

    next();
  };
}

/**
 * Status-based access control middleware
 * Blocks users with certain statuses from accessing protected routes
 */
export function requireStatus(...allowedStatuses: UserStatus[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userStatus = req.user.status as UserStatus;

    if (!allowedStatuses.includes(userStatus)) {
      // Map status to user-friendly message
      const statusMessages: Record<UserStatus, string> = {
        PENDING: 'Your account is pending approval',
        APPLIED: 'Your application is under review',
        ACTIVE: 'Your account is active',
        PROBATIONARY: 'Your account is in probation period',
        SUSPENDED: 'Your account has been suspended',
        BLOCKED: 'Your account has been blocked',
      };

      res.status(403).json({
        error: 'Account Status Restriction',
        message: statusMessages[userStatus] || 'Your account cannot access this resource',
        currentStatus: userStatus,
      });
      return;
    }

    next();
  };
}

/**
 * Combined middleware - Requires authentication, specific role, and allowed status
 * This is the most common pattern for protected routes
 */
export function requireAuthAndRole(
  ...allowedRoles: UserRole[]
): (req: AuthRequest, res: Response, next: NextFunction) => void {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // First check authentication
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Check role
    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or '),
      });
      return;
    }

    // Check status - Only allow ACTIVE and PROBATIONARY users
    const userStatus = req.user.status as UserStatus;
    const allowedStatuses: UserStatus[] = [UserStatus.ACTIVE, UserStatus.PROBATIONARY];

    if (!allowedStatuses.includes(userStatus)) {
      const statusMessages: Record<UserStatus, string> = {
        PENDING: 'Your account is pending approval. Please wait for admin approval.',
        APPLIED: 'Your application is under review. Please wait for admin approval.',
        ACTIVE: 'Your account is active',
        PROBATIONARY: 'Your account is in probation period',
        SUSPENDED: 'Your account has been suspended. Contact support for assistance.',
        BLOCKED: 'Your account has been blocked. Contact support for assistance.',
      };

      res.status(403).json({
        error: 'Account Status Restriction',
        message: statusMessages[userStatus] || 'Your account cannot access this resource',
        currentStatus: userStatus,
      });
      return;
    }

    next();
  };
}

/**
 * Admin-only middleware - Shortcut for admin routes
 */
export function requireAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    console.log(`[RBAC] Checking admin access for ${req.path}`);
    console.log(`[RBAC] User from request:`, req.user ? {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
    } : 'No user');
    
    // First check authentication
    if (!req.user) {
      console.log(`[RBAC] No user in request for ${req.path}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Check role
    if (req.user.role !== UserRole.ADMIN) {
      console.log(`[RBAC] User ${req.user.email} is not ADMIN (role: ${req.user.role})`);
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions. Required role: ADMIN',
      });
      return;
    }

    // Check status - Only allow ACTIVE and PROBATIONARY users
    const userStatus = req.user.status as UserStatus;
    console.log(`[RBAC] User status check: ${userStatus} (allowed: ACTIVE, PROBATIONARY)`);
    const allowedStatuses: UserStatus[] = [UserStatus.ACTIVE, UserStatus.PROBATIONARY];

    if (!allowedStatuses.includes(userStatus)) {
      console.log(`[RBAC] User ${req.user.email} has status ${userStatus}, not allowed`);
      const statusMessages: Record<UserStatus, string> = {
        PENDING: 'Your account is pending approval. Please wait for admin approval.',
        APPLIED: 'Your application is under review. Please wait for admin approval.',
        ACTIVE: 'Your account is active',
        PROBATIONARY: 'Your account is in probation period',
        SUSPENDED: 'Your account has been suspended. Contact support for assistance.',
        BLOCKED: 'Your account has been blocked. Contact support for assistance.',
      };

      res.status(403).json({
        error: 'Account Status Restriction',
        message: statusMessages[userStatus] || 'Your account cannot access this resource',
        currentStatus: userStatus,
      });
      return;
    }

    console.log(`[RBAC] Admin access granted for ${req.user.email} (status: ${userStatus}) on ${req.path}`);
    next();
  };
}

/**
 * Farmer-only middleware - Shortcut for farmer routes
 */
export function requireFarmer() {
  return requireAuthAndRole(UserRole.FARMER);
}

/**
 * Buyer-only middleware - Shortcut for buyer routes
 */
export function requireBuyer() {
  return requireAuthAndRole(UserRole.BUYER);
}

