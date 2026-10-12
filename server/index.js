'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const fs = require('node:fs');

// Load whichever database driver server/db.js selects.
let dbAvailable = false;
let databaseLoadError = null;
try {
  const db = require('./db');
  dbAvailable = Boolean(db && db.dbAvailable);
} catch (error) {
  databaseLoadError = error && error.message ? error.message : String(error);
  console.error('Database initialisation failed:', databaseLoadError);
}

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const databaseMode = hasDatabaseUrl ? 'postgresql' : 'sqlite';
const seedDemoEnabled = !isProduction || process.env.CBTKU_SEED_DEMO === 'true';

if (dbAvailable && seedDemoEnabled) {
  try {
    require('./seed');
  } catch (error) {
    console.error('Seed notice:', error && error.message ? error.message : String(error));
  }
}

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health must respond even when the database is unavailable, so deployment
// diagnostics return JSON instead of crashing during module initialization.
app.get('/api/health', (_req, res) => {
  const healthy = Boolean(dbAvailable);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    app: 'CBTKU - Aplikasi Ujian Online Terproteksi',
    version: '1.0.0',
    database: healthy ? 'connected' : 'unavailable',
    databaseMode,
    databaseUrlConfigured: hasDatabaseUrl,
    ...(databaseLoadError ? { databaseError: databaseLoadError } : {}),
    time: new Date().toISOString()
  });
});

// Vercel's /var/task filesystem is read-only. Use /tmp only as a temporary
// fallback for uploads in serverless; it is not persistent storage. For durable
// uploaded files, configure CBTKU_UPLOAD_DIR on a persistent host or object store.
const defaultUploadDir = isProduction
  ? path.join('/tmp', 'cbtku-uploads')
  : path.join(__dirname, '..', 'data', 'uploads');
const uploadDir = path.resolve(process.env.CBTKU_UPLOAD_DIR || defaultUploadDir);
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
  // Don't crash the whole server because optional upload storage is unavailable.
  console.error('Upload directory unavailable:', error && error.message ? error.message : String(error));
}
try {
  if (fs.existsSync(uploadDir)) app.use('/uploads', express.static(uploadDir));
} catch (error) {
  console.error('Unable to mount upload directory:', error && error.message ? error.message : String(error));
}

// Refuse API operations if the backing database is not ready, but return JSON.
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  if (!dbAvailable) {
    return res.status(503).json({
      error: 'Database CBTKU belum tersedia. Pastikan DATABASE_URL Neon terpasang di Environment Variables untuk Production dan deployment terbaru menggunakannya.'
    });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/export', exportRoutes);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('===============================================');
    console.log(` CBTKU Backend Server running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(` Database mode: ${databaseMode}; DATABASE_URL configured: ${hasDatabaseUrl}`);
    console.log('===============================================');
  });
}

module.exports = app;
