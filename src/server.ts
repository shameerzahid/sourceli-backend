import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import systemRoutes from './routes/system.routes.js';
import farmerRoutes from './routes/farmer.routes.js';
import buyerRoutes from './routes/buyer.routes.js';

const app = express();
const PORT = env.PORT;

// CORS configuration - support multiple origins
const getAllowedOrigins = (): string[] => {
  // If CORS_ORIGINS is set, use it (comma-separated)
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
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
      system: {
        produceCategories: 'GET /api/system/produce-categories',
      },
    },
  });
});

// API Routes
// Auth routes (no rate limiting)
app.use('/api/auth', authRoutes);

// Log all admin route requests
app.use('/api/admin', (req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.originalUrl} - Request received`);
  next();
});

// Admin routes (protected by authentication and RBAC middleware)
app.use('/api/admin', adminRoutes);

// System routes (public - no authentication required)
app.use('/api/system', systemRoutes);

// Farmer routes (protected by authentication and farmer role)
app.use('/api/farmers', farmerRoutes);

// Buyer routes (protected by authentication and buyer role)
app.use('/api/buyers', buyerRoutes);

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

