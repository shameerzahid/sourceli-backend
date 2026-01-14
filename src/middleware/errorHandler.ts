import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Centralized error handling middleware
 * Catches all errors and returns appropriate responses
 */
export function errorHandler(
  err: AppError | ZodError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Custom application errors
  const appError = err as AppError;
  if (appError.statusCode) {
    res.status(appError.statusCode).json({
      error: err.name || 'Error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Prisma errors
  if (appError.code === 'P2002') {
    // Unique constraint violation
    res.status(409).json({
      error: 'Conflict',
      message: 'A record with this information already exists',
    });
    return;
  }

  if (appError.code === 'P2025') {
    // Record not found
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found',
    });
    return;
  }

  // Default error (500)
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Async error wrapper - Catches errors from async route handlers
 * Usage: wrapAsync(async (req, res, next) => { ... })
 */
export function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a custom application error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

