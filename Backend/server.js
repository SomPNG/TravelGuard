const express = require('express');
const cors = require('cors');
const config = require('./src/config');

// ─── ROUTES ────────────────────────────────────────────────────────
const platformRoutes = require('./src/routes/platform');
const operatorRoutes = require('./src/routes/operator');
const tripRoutes = require('./src/routes/trip');

const app = express();

// ─── MIDDLEWARE ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── API ROUTES ────────────────────────────────────────────────────
app.use('/api/platform', platformRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/trip', tripRoutes);

// ─── CONTRACT INFO (top-level convenience route) ───────────────────
const algorand = require('./src/services/algorand');
app.get('/api/contract-info', async (req, res, next) => {
  try {
    const globalState = await algorand.getGlobalState();
    res.json({
      success: true,
      data: {
        totalTrips: globalState.totalTrips ?? 0,
        platformBalance: globalState.platformBalance ?? 0,
        appId: config.appId,
        network: 'testnet',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── HEALTH CHECK ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appId: config.appId,
    network: 'testnet',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── ERROR HANDLER ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

// ─── START ─────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🛡️  TravelGuard API running on http://localhost:${config.port}`);
  console.log(`📡 Connected to Algorand TestNet (App ID: ${config.appId})`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /api/health`);
  console.log(`  GET /api/contract-info`);
  console.log(`  GET /api/platform/info`);
  console.log(`  GET /api/platform/boxes`);
  console.log(`  GET /api/operator/:address`);
  console.log(`  GET /api/trip/:tripId/:operatorAddress`);
  console.log(`  GET /api/trip/:tripId/:operatorAddress/refund-estimate`);
  console.log();
});
