import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Initialize Prisma client first (required for serverless)
import '../src/config/database.js';

import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// Import routes
import authRoutes from '../src/routes/auth.routes.js';
import adminRoutes from '../src/routes/admin.routes.js';

const app = express();

// CORS configuration - support multiple origins
const getAllowedOrigins = (): string[] => {
  // If CORS_ORIGINS is set, use it (comma-separated)
  if (env.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }
  // Otherwise, use CORS_ORIGIN (single origin)
  return [env.CORS_ORIGIN];
};

const allowedOrigins = getAllowedOrigins();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if the origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // In development, allow localhost with any port
      if (env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      
      // Reject the request
      console.warn(`CORS: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check endpoint (no rate limiting)
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    message: 'Sourceli API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Root endpoint for Vercel
app.get('/', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    message: 'Sourceli API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API info endpoint
app.get('/api', (_req: express.Request, res: express.Response) => {
  res.json({
    message: 'Sourceli API v1.0',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: {
        register: {
          farmer: 'POST /api/auth/register/farmer',
          buyer: 'POST /api/auth/register/buyer',
        },
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/me',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password',
        changePassword: 'POST /api/auth/change-password',
      },
    },
  });
});

// API Routes
// Apply stricter rate limiting to auth routes
app.use('/api/auth', authLimiter, authRoutes);

// Log all admin route requests
app.use('/api/admin', (req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.originalUrl} - Request received`);
  next();
});

// Admin routes (protected by authentication and RBAC middleware)
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${_req.method} ${_req.path} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Export the Express app for Vercel serverless function
export default app;
