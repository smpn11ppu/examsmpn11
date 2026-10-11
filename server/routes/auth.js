const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { dbAvailable } = require('../db');
const { JWT_SECRET, authenticate, logAudit, rateLimiter } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', rateLimiter(15, 60000), (req, res) => {
  if (!db || !dbAvailable) {
    console.error('❌ DB not available for login');
    return res.status(503).json({ error: 'Database not available in this environment' });
  }
  const { username, password } = req.body;
  // duplicate removed
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const user = db.prepare(`
    SELECT u.id, u.username, u.password_hash, u.full_name, u.role, u.class_id, u.status, u.must_change_password, c.name as class_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    WHERE u.username = ?
  `).get(username.trim());

  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Akun ini dinonaktifkan oleh administrator.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  logAudit(user.id, 'LOGIN', `User ${user.username} login sukses`, req.ip);

  res.json({
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      class_id: user.class_id,
      class_name: user.class_name,
      must_change_password: Boolean(user.must_change_password)
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.class_id, u.status, u.must_change_password, c.name as class_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      class_id: user.class_id,
      class_name: user.class_name,
      must_change_password: Boolean(user.must_change_password)
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 5) {
    return res.status(400).json({ error: 'Password baru minimal 5 karakter.' });
  }

  const user = db.prepare('SELECT id, password_hash, username FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }

  if (currentPassword) {
    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Password saat ini salah.' });
    }
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, req.user.id);

  logAudit(req.user.id, 'CHANGE_PASSWORD', `User ${user.username} mengubah password`, req.ip);

  res.json({ message: 'Password berhasil diperbarui. Anda dapat melanjutkan.' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout berhasil' });
});

module.exports = router;
