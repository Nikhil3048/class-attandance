require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const compression = require('compression');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const attendanceRoutes = require('./routes/attendance');
const requestsRoutes   = require('./routes/requests');

const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Security HTTP headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration - restrict origins in production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin SPA)
      if (!origin || !allowedOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('CORS policy: Access denied for this origin'));
    },
    credentials: true,
  })
);

// Global API Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Strict Rate Limiter for sensitive authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 attempts per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

// Compression middleware
app.use(compression());

// Middleware & Payload limits (prevent payload flood DoS)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(globalLimiter);

// Apply strict rate limiting on login & signup request submissions
app.use('/api/auth/login', authLimiter);
app.use('/api/requests', (req, res, next) => {
  if (req.method === 'POST') {
    return authLimiter(req, res, next);
  }
  next();
});

// Serve static files from public directory with 1-day cache for assets
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d',
  etag: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/requests',   requestsRoutes);

// Serve frontend for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler (sanitizes 500 error outputs)
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const errorMessage = status === 500 && isProd
    ? 'Internal Server Error'
    : (err.message || 'An unexpected error occurred');

  res.status(status).json({ error: errorMessage });
});

// Only start the server locally (Vercel serverless handles this automatically)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Attendance Management Server running at http://localhost:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
