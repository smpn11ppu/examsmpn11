const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Load database and optionally create demo data. In production, seeding is
// opt-in and should be disabled after the first successful initialization.
let dbAvailable = false;
try {
  const db = require('./db');
  dbAvailable = Boolean(db && db.dbAvailable);
} catch (e) {
  console.error('Database initialisation failed:', e.message);
}

const seedDemoEnabled = process.env.NODE_ENV !== 'production' || process.env.CBTKU_SEED_DEMO === 'true';
if (dbAvailable && seedDemoEnabled) {
  try {
    require('./seed');
  } catch (e) {
    console.error('Seed notice:', e.message);
  }
}
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to abort if DB is unavailable (e.g., read‑only on Vercel)
app.use((req, res, next) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database CBTKU belum tersedia di server. Database SQLite lokal tidak dapat menjadi penyimpanan persisten di Vercel. Konfigurasikan database produksi terlebih dahulu.' });
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static uploads directory if any
const uploadDir = path.resolve(process.env.CBTKU_UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads'));
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CBTKU - Aplikasi Ujian Online Terproteksi',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// Serve frontend build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` CBTKU Backend Server running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });
}

// Global error handler – always return JSON
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
