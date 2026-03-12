require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── SSE (Server-Sent Events) ───────────────────────────
const sseClients = [];
app.locals.sseClients = sseClients;

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Add to clients
  sseClients.push(res);
  console.log(`[SSE] Client connected (${sseClients.length} total)`);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', time: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
    console.log(`[SSE] Client disconnected (${sseClients.length} total)`);
  });
});

// ─── Auth middleware for sync routes ────────────────────
const { requireApiKey } = require('./middleware/auth');

// ─── API Routes ─────────────────────────────────────────
app.use('/api/meta', require('./routes/meta'));
app.use('/api/sync', requireApiKey, require('./routes/sync'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/health', require('./routes/health'));
app.use('/api/risk', require('./routes/risk'));
app.use('/api/pending', require('./routes/pending'));
app.use('/api/trends', require('./routes/trends'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/funnel', require('./routes/funnel'));
app.use('/api/heatmap', require('./routes/heatmap'));
app.use('/api/rows', require('./routes/rows'));
app.use('/api/teams', require('./routes/teams'));

// ─── Catchall: serve frontend ───────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ─── Cron Job auto pull from n8n ────────────────────────
const { startCronJob } = require('./cron');
startCronJob();

// ─── Start ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🌻 Sunflower Dashboard Backend`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  API:     http://localhost:${PORT}/api/meta`);
  console.log(`  SSE:     http://localhost:${PORT}/events`);
  console.log(`  Sync:    POST http://localhost:${PORT}/api/sync`);
  console.log(`  ─────────────────────────────\n`);
});
