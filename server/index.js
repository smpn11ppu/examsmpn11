const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Ensure db and initial seeds
// Initialise database (read‑only in Vercel). The DB module may throw if the file is missing or read‑only.
let dbInitialized = true;
try {
  require('./db');
} catch (e) {
  dbInitialized = false;
  console.error('❌ Database initialisation failed:', e.message);
}
// Run seed data only in development (NODE_ENV !== 'production')
if (process.env.NODE_ENV !== 'production') {
  try {
    require('./seed');
  } catch (e) {
    console.error('Seed notice (dev):', e.message);
  }
}

const { dbAvailable } = require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to abort if DB is unavailable (e.g., read‑only on Vercel)
app.use((req, res, next) => {
  if (!dbAvailable) {
    console.error('❌ DB not available for request', req.path);
    return res.status(503).json({ error: 'Database not available in this environment' });
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
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
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
