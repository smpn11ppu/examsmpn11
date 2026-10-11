const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'cbtku-secure-jwt-key-2026';

function authenticate(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token autentikasi tidak ditemukan. Silakan login kembali.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, full_name, role, class_id, status, must_change_password FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi admin sekolah.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi kedaluwarsa atau token tidak valid.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Akses ditolak. Peran tidak memiliki izin.' });
    }
    next();
  };
}

function logAudit(userId, action, details, ip) {
  try {
    db.prepare('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)').run(
      userId || null,
      action,
      typeof details === 'object' ? JSON.stringify(details) : String(details),
      ip || '127.0.0.1'
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// Simple in-memory rate limiter for login and token check
const rateLimitMap = new Map();
function rateLimiter(limit = 10, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'ip';
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
    } else {
      entry.count += 1;
    }

    rateLimitMap.set(ip, entry);

    if (entry.count > limit) {
      return res.status(429).json({ error: 'Terlalu banyak percobaan. Harap tunggu beberapa saat.' });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticate,
  requireRole,
  logAudit,
  rateLimiter
};
