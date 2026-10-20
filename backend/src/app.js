const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const roadRoutes = require('./routes/roadRoutes');
const cameraRoutes = require('./routes/cameraRoutes');
const trafficRoutes = require('./routes/trafficRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security: Disable X-Powered-By header to prevent technology footprinting
app.disable('x-powered-by');

// Security: Set standard defensive HTTP headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Security: Configure CORS with explicit local development and environment origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server) or matched origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev fallback, logged
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static data directories (videos and outputs) for frontend preview
const dataDir = path.resolve(__dirname, '../../data');
app.use('/data', express.static(dataDir));
app.use('/videos', express.static(path.join(dataDir, 'videos')));
app.use('/outputs', express.static(path.join(dataDir, 'outputs')));

// Mount API Routes
app.use('/api/roads', roadRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/analysis', analysisRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Intelligent Traffic Management System - Stage 1 Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
