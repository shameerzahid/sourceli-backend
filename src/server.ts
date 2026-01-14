import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
const PORT = env.PORT;

// Middleware
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`🔐 CORS Origin: ${env.CORS_ORIGIN}`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   POST /api/auth/register/farmer - Register as farmer`);
  console.log(`   POST /api/auth/register/buyer - Register as buyer`);
  console.log(`   POST /api/auth/login - Login`);
  console.log(`   GET  /api/auth/me - Get current user profile`);
  console.log(`   POST /api/auth/refresh - Refresh access token`);
  console.log(`   POST /api/auth/logout - Logout`);
});

