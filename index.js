const express = require('express');
const app = express();
const PORT = 3000;

// --- Import authentication ---
const { authenticateAPI } = require('./auth');

// --- Import and use rateService ---
const rateService = require('./rateService');

// Import and start the DividentSyncJob scheduler
const DividentSyncJob = require('./DividentSyncJob');
DividentSyncJob.startScheduler();

// Middleware
app.use(express.json());

app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`POST ${req.originalUrl} body:`, req.body);
  }
  next();
});

app.use((req, res, next) => {
  if (req.method === 'POST') {
    const originalSend = res.send;
    res.send = function (body) {
      console.log(`POST ${req.originalUrl} response body:`, body);
      originalSend.apply(res, arguments);
    };
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Authentication routes (no auth required)
app.use('/auth', require('./authRoutes'));

// Root endpoint with authentication info
app.get('/', (req, res) => {
  res.json({
    message: 'Portfolio API Server',
    version: '2.0.0',
    authentication: {
      type: 'client_credentials',
      required: true,
      token_endpoint: '/auth/token',
      info_page: '/auth/info',
      documentation: 'Use client credentials to get Bearer token, then include in Authorization header'
    },
    endpoints: {
      authentication: '/auth/*',
      portfolio: '/api/v1/portfolio/*',
      expenses: '/api/v1/expense/*',
      companies: '/api/v1/companies/*'
    }
  });
});

// Protected API routes (require authentication)
app.use('/api/v1/portfolio', authenticateAPI, require('./portfolio'));
app.use('/api/v1/companies', authenticateAPI, require('./companies'));
app.use('/api/v1/expense', authenticateAPI, require('./expense'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Initial fetch of the USD rate when the server starts
  rateService.refreshUsdRate();
  // Schedule the daily 9 AM refresh
  rateService.scheduleDailyRateRefresh();
});
