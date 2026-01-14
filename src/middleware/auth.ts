import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/**
 * Authentication middleware - Verifies JWT access token
 * Attaches user info to request if token is valid
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    console.log(`[AUTH] ${req.method} ${req.path} - Checking authentication`);
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log(`[AUTH] No authorization header for ${req.path}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization token provided',
      });
      return;
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Use: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      console.log(`[AUTH] Invalid or expired token for ${req.path}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    console.log(`[AUTH] Authenticated user: ${decoded.email} (${decoded.role}) for ${req.path}`);
    
    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token verification failed',
    });
  }
}

/**
 * Optional authentication - Doesn't fail if no token, but attaches user if token exists
 * Useful for endpoints that work with or without authentication
 */
export function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = verifyAccessToken(token);
        if (decoded) {
          req.user = decoded;
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
}

