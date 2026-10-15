const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const xlsx = require('xlsx');
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { DEFAULT_ROTATION_MINUTES, MIN_ROTATION_MINUTES, MAX_ROTATION_MINUTES, normalizeRotationMinutes, getRecoveryToken } = require('../recovery-token');
const {
  isCloudinaryImageRef, cloudinaryPublicIdFromRef, uploadQuestionImage, resolveImageDisplayUrl, deleteStoredImage,
  ALLOWED_CONTENT_TYPES, MAX_QUESTION_IMAGE_BYTES
} = require('../image-storage');

// All routes in this router require admin role
router.use(authenticate, requireRole('admin'));

// Existing import endpoints use memory storage. Question images have their own strict limit.
const upload = multer({ storage: multer.memoryStorage() });
const questionImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_QUESTION_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_CONTENT_TYPES, file.mimetype)) {
      return callback(new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.'));
    }
    callback(null, true);
  }
});

// --- 1. DASHBOARD STATS ---
router.get('/dashboard', (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'active'").get().count;
  const totalClasses = db.prepare("SELECT COUNT(*) as count FROM classes WHERE status = 'active'").get().count;
  const totalSubjects = db.prepare("SELECT COUNT(*) as count FROM subjects WHERE status = 'active'").get().count;
  const totalQuestions = db.prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'active'").get().count;
  const totalExams = db.prepare("SELECT COUNT(*) as count FROM exams").get().count;

  const now = new Date().toISOString();
  const upcomingExams = db.prepare("SELECT COUNT(*) as count FROM exams WHERE start_time > ? AND status = 'published'").get(now).count;
  const ongoingExams = db.prepare("SELECT COUNT(*) as count FROM exams WHERE start_time <= ? AND end_time >= ? AND status = 'published'").get(now, now).count;
  const completedExams = db.prepare("SELECT COUNT(*) as count FROM exams WHERE end_time < ? OR status = 'archived'").get(now).count;

  const attemptsStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN status = 'timed_out' THEN 1 ELSE 0 END) as timed_out
    FROM exam_attempts
  `).get();

  const recentViolations = db.prepare(`
    SELECT v.id, v.violation_type, v.message, v.created_at, u.full_name as student_name, e.title as exam_title
    FROM violation_logs v
    JOIN users u ON v.user_id = u.id
    JOIN exam_attempts a ON v.attempt_id = a.id
    JOIN exams e ON a.exam_id = e.id
    ORDER BY v.created_at DESC LIMIT 6
  `).all();

  const recentAudit = db.prepare(`
    SELECT a.id, a.action, a.details, a.created_at, u.username
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 6
  `).all();

  res.json({
    counts: {
      students: totalStudents,
      classes: totalClasses,
      subjects: totalSubjects,
      questions: totalQuestions,
      exams: totalExams
    },
    exams: {
      upcoming: upcomingExams,
      ongoing: ongoingExams,
      completed: completedExams
    },
    attempts: {
      in_progress: attemptsStats.in_progress || 0,
      submitted: attemptsStats.submitted || 0,
      timed_out: attemptsStats.timed_out || 0
    },
    recentViolations,
    recentAudit
  });
});

// --- 2. CLASSES CRUD ---
router.get('/classes', (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, COUNT(u.id) as student_count
    FROM classes c
    LEFT JOIN users u ON c.id = u.class_id AND u.role = 'student' AND u.status = 'active'
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  res.json({ classes });
});

router.post('/classes', (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Kode dan Nama Kelas wajib diisi' });

  try {
    const info = db.prepare('INSERT INTO classes (code, name) VALUES (?, ?)').run(code.trim().toUpperCase(), name.trim());
    logAudit(req.user.id, 'CREATE_CLASS', `Membuat kelas ${name} (${code})`, req.ip);
    res.json({ message: 'Kelas berhasil ditambahkan', id: info.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kode kelas sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/classes/:id', (req, res) => {
  const { code, name, status } = req.body;
  const { id } = req.params;
  try {
    db.prepare('UPDATE classes SET code = ?, name = ?, status = ? WHERE id = ?').run(
      code.trim().toUpperCase(),
      name.trim(),
      status || 'active',
      id
    );
    logAudit(req.user.id, 'UPDATE_CLASS', `Update kelas id ${id}`, req.ip);
    res.json({ message: 'Kelas berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/classes/:id', (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE classes SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END WHERE id = ?").run(id);
  res.json({ message: 'Status kelas berhasil diubah' });
});

// --- 3. STUDENTS CRUD & EXCEL IMPORT ---
router.get('/students', (req, res) => {
  const { class_id, search } = req.query;
  let sql = `
    SELECT u.id, u.username, u.full_name, u.role, u.class_id, u.status, u.must_change_password, u.created_at, c.name as class_name, c.code as class_code
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    WHERE u.role = 'student'
  `;
  const params = [];

  if (class_id) {
    sql += ' AND u.class_id = ?';
    params.push(class_id);
  }

  if (search) {
    sql += ' AND (u.username LIKE ? OR u.full_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY u.full_name ASC';
  const students = db.prepare(sql).all(...params);
  res.json({ students });
});

router.post('/students', (req, res) => {
  const { username, full_name, class_id } = req.body;
  if (!username || !full_name) {
    return res.status(400).json({ error: 'Username dan Nama Lengkap wajib diisi' });
  }

  const initialPasswordHash = bcrypt.hashSync('siswa11', 10);
  try {
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, class_id, status, must_change_password)
      VALUES (?, ?, ?, 'student', ?, 'active', 1)
    `).run(username.trim().toLowerCase(), initialPasswordHash, full_name.trim(), class_id || null);

    logAudit(req.user.id, 'CREATE_STUDENT', `Menambah murid ${full_name} (${username})`, req.ip);
    res.json({ message: 'Murid berhasil didaftarkan dengan password awal siswa11', id: info.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username murid sudah terdaftar' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/students/:id', (req, res) => {
  const { username, full_name, class_id, status } = req.body;
  const { id } = req.params;
  try {
    db.prepare(`
      UPDATE users 
      SET username = ?, full_name = ?, class_id = ?, status = ?
      WHERE id = ? AND role = 'student'
    `).run(username.trim().toLowerCase(), full_name.trim(), class_id || null, status || 'active', id);

    logAudit(req.user.id, 'UPDATE_STUDENT', `Update murid id ${id}`, req.ip);
    res.json({ message: 'Data murid berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete a student only when they have no exam history.
// Historical attempts and violation records are intentionally protected.
router.delete('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID murid tidak valid.' });
  }

  const student = db.prepare(
    "SELECT id, username, full_name FROM users WHERE id = ? AND role = 'student'"
  ).get(id);

  if (!student) {
    return res.status(404).json({ error: 'Murid tidak ditemukan.' });
  }

  try {
    const attemptCount = Number(
      db.prepare('SELECT COUNT(*) AS count FROM exam_attempts WHERE user_id = ?').get(id).count
    );
    const violationCount = Number(
      db.prepare('SELECT COUNT(*) AS count FROM violation_logs WHERE user_id = ?').get(id).count
    );

    if (attemptCount > 0 || violationCount > 0) {
      return res.status(409).json({
        error: `Murid ${student.full_name} memiliki riwayat ujian atau pelanggaran (${attemptCount} riwayat ujian, ${violationCount} catatan pelanggaran). Untuk menjaga nilai, jawaban, dan audit, akun ini tidak dapat dihapus permanen dari menu ini. Nonaktifkan akun atau pertahankan data murid tersebut agar riwayat tetap aman.`
      });
    }

    const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(id);
    if (!result.changes) {
      return res.status(404).json({ error: 'Murid tidak ditemukan atau sudah dihapus.' });
    }

    logAudit(req.user.id, 'DELETE_STUDENT', `Menghapus murid ${student.full_name} (${student.username}) tanpa riwayat ujian`, req.ip);
    return res.json({ message: `Murid ${student.full_name} berhasil dihapus.` });
  } catch (err) {
    const message = String(err?.message || '');
    if (/foreign key|constraint/i.test(message) || /SQLITE_CONSTRAINT/i.test(String(err?.code || ''))) {
      return res.status(409).json({
        error: 'Murid masih terhubung dengan data lain dan tidak dapat dihapus permanen. Pertahankan atau nonaktifkan akun untuk menjaga integritas data.'
      });
    }
    console.error('[CBTKU] Student deletion failed:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat menghapus murid.' });
  }
});

router.post('/students/:id/reset-password', (req, res) => {
  const { id } = req.params;
  const initialPasswordHash = bcrypt.hashSync('siswa11', 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ? AND role = 'student'
  `).run(initialPasswordHash, id);

  const student = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
  logAudit(req.user.id, 'RESET_PASSWORD', `Reset password murid ${student?.username} ke default siswa11`, req.ip);

  res.json({ message: 'Password murid berhasil direset ke "siswa11" dan wajib diganti saat login pertama.' });
});

// Import Students via Excel/CSV
router.post('/students/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File Excel / CSV wajib diunggah' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'File kosong atau tidak memiliki baris data' });
    }

    const classesList = db.prepare('SELECT id, code FROM classes').all();
    const classMap = new Map();
    classesList.forEach(c => classMap.set(c.code.toUpperCase(), c.id));

    const initialHash = bcrypt.hashSync('siswa11', 10);
    const successList = [];
    const errorList = [];

    const insertStmt = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, class_id, status, must_change_password)
      VALUES (?, ?, ?, 'student', ?, 'active', 1)
    `);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const username = String(row.username || row.Username || row.NIS || '').trim().toLowerCase();
      const fullName = String(row.nama_lengkap || row.nama || row.Nama || row.full_name || '').trim();
      const classCode = String(row.kode_kelas || row.kelas || row.Kelas || row.class_code || '').trim().toUpperCase();

      if (!username || !fullName) {
        errorList.push({ row: rowNum, error: 'Username atau nama lengkap kosong' });
        continue;
      }

      const classId = classMap.get(classCode) || null;

      try {
        insertStmt.run(username, initialHash, fullName, classId);
        successList.push({ row: rowNum, username, fullName });
      } catch (err) {
        errorList.push({
          row: rowNum,
          username,
          error: err.message.includes('UNIQUE') ? 'Username sudah digunakan' : err.message
        });
      }
    }

    logAudit(req.user.id, 'IMPORT_STUDENTS', `Impor murid: ${successList.length} berhasil, ${errorList.length} gagal`, req.ip);

    res.json({
      message: `Impor selesai: ${successList.length} berhasil, ${errorList.length} gagal.`,
      successCount: successList.length,
      errorCount: errorList.length,
      errors: errorList
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memproses file: ' + err.message });
  }
});

// --- 4. SUBJECTS CRUD ---
router.get('/subjects', (req, res) => {
  const { search } = req.query;
  const includeInactive = String(req.query.include_inactive || '').toLowerCase() === 'true';
  let sql = 'SELECT * FROM subjects WHERE 1=1';
  const params = [];

  // Dropdowns and new exam setup show active subjects only. The Subjects page
  // requests include_inactive=true so administrators can reactivate a subject.
  if (!includeInactive) sql += " AND status = 'active'";

  if (search) {
    sql += ' AND (name LIKE ? OR code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY name ASC';
  const subjects = db.prepare(sql).all(...params);
  res.json({ subjects });
});

router.post('/subjects', (req, res) => {
  const { code, name, description } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Kode dan Nama Mata Pelajaran wajib diisi' });

  try {
    const info = db.prepare('INSERT INTO subjects (code, name, description) VALUES (?, ?, ?)').run(
      code.trim().toUpperCase(),
      name.trim(),
      description || ''
    );
    logAudit(req.user.id, 'CREATE_SUBJECT', `Membuat mapel ${name} (${code})`, req.ip);
    res.json({ message: 'Mata pelajaran berhasil ditambahkan', id: info.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Kode mapel sudah digunakan' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/subjects/:id', (req, res) => {
  const { code, name, description, status } = req.body;
  const { id } = req.params;
  if (!code || !String(code).trim() || !name || !String(name).trim()) {
    return res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi.' });
  }
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status mata pelajaran tidak valid.' });
  }

  try {
    const existing = db.prepare('SELECT id, status FROM subjects WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan.' });

    // Preserve the current status when editing ordinary fields. This prevents
    // editing an inactive subject from accidentally reactivating it.
    const nextStatus = status === undefined ? existing.status : status;
    db.prepare('UPDATE subjects SET code = ?, name = ?, description = ?, status = ? WHERE id = ?').run(
      String(code).trim().toUpperCase(),
      String(name).trim(),
      description || '',
      nextStatus,
      id
    );
    logAudit(req.user.id, 'UPDATE_SUBJECT', `Memperbarui mata pelajaran id ${id}`, req.ip);
    res.json({ message: 'Mata pelajaran berhasil diperbarui', status: nextStatus });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Kode mata pelajaran sudah digunakan.' });
    res.status(500).json({ error: 'Gagal memperbarui mata pelajaran.' });
  }
});

// Explicit status endpoint: status changes are not permanent deletion.
router.patch('/subjects/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status harus active atau inactive.' });
  }

  try {
    const subject = db.prepare('SELECT id, name, status FROM subjects WHERE id = ?').get(id);
    if (!subject) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan.' });

    db.prepare('UPDATE subjects SET status = ? WHERE id = ?').run(status, id);
    const verb = status === 'active' ? 'mengaktifkan' : 'menonaktifkan';
    logAudit(req.user.id, status === 'active' ? 'ACTIVATE_SUBJECT' : 'DEACTIVATE_SUBJECT', `${verb} mata pelajaran ${subject.name} (id ${id})`, req.ip);
    res.json({
      message: status === 'active'
        ? `Mata pelajaran "${subject.name}" berhasil diaktifkan.`
        : `Mata pelajaran "${subject.name}" berhasil dinonaktifkan. Data soal dan riwayat ujian tetap disimpan.`,
      status
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengubah status mata pelajaran.' });
  }
});

// Permanent deletion is separate from activation status. Only allow deletion
// when no question or exam references the subject; otherwise ask admin to deactivate it.
router.delete('/subjects/:id', (req, res) => {
  const { id } = req.params;
  try {
    const subject = db.prepare('SELECT id, name FROM subjects WHERE id = ?').get(id);
    if (!subject) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan.' });

    const questionCount = Number(db.prepare('SELECT COUNT(*) AS count FROM questions WHERE subject_id = ?').get(id).count || 0);
    const examCount = Number(db.prepare('SELECT COUNT(*) AS count FROM exams WHERE subject_id = ?').get(id).count || 0);

    if (questionCount > 0 || examCount > 0) {
      const reasons = [];
      if (questionCount > 0) reasons.push(`${questionCount} soal`);
      if (examCount > 0) reasons.push(`${examCount} ujian`);
      return res.status(409).json({
        error: `Mata pelajaran "${subject.name}" belum dapat dihapus karena masih digunakan oleh ${reasons.join(' dan ')}. Gunakan tombol Nonaktifkan jika mata pelajaran tidak ingin dipakai untuk penggunaan baru. Data soal dan riwayat ujian tetap aman.`
      });
    }

    db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
    logAudit(req.user.id, 'DELETE_SUBJECT', `Menghapus permanen mata pelajaran ${subject.name} (id ${id})`, req.ip);
    return res.json({ message: `Mata pelajaran "${subject.name}" berhasil dihapus permanen.` });
  } catch (err) {
    // Foreign-key constraints are the final guard against deleting referenced data.
    if (String(err.message || '').toLowerCase().includes('foreign key') || String(err.code || '').includes('CONSTRAINT')) {
      return res.status(409).json({ error: 'Mata pelajaran masih memiliki data terkait dan tidak dapat dihapus permanen. Gunakan Nonaktifkan agar data tetap aman.' });
    }
    console.error('Gagal menghapus mata pelajaran:', err);
    return res.status(500).json({ error: 'Gagal menghapus mata pelajaran.' });
  }
});

// Image URL validation. New uploads use private authenticated Cloudinary assets (`cloudinary://...`).
// Existing direct URLs and legacy Base64 data URLs remain readable for compatibility.
const MAX_QUESTION_IMAGE_DATA_URL_LENGTH = 650000; // legacy compatibility only; new uploads never store Base64 in Neon
function validateQuestionImageUrl(imageUrl) {
  if (imageUrl === undefined || imageUrl === null || imageUrl === '') return null;
  if (typeof imageUrl !== 'string') throw new Error('Data gambar tidak valid.');

  if (imageUrl.startsWith('cloudinary://')) {
    cloudinaryPublicIdFromRef(imageUrl);
    return imageUrl;
  }
  if (imageUrl.startsWith('r2://')) {
    throw new Error('Gambar dari konfigurasi Cloudflare R2 lama perlu diunggah ulang ke Cloudinary.');
  }

  if (imageUrl.startsWith('data:')) {
    if (!/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/i.test(imageUrl)) {
      throw new Error('Format gambar lama tidak didukung. Gunakan JPG, PNG, atau WebP.');
    }
    if (imageUrl.length > MAX_QUESTION_IMAGE_DATA_URL_LENGTH) {
      throw new Error('Gambar lama terlalu besar. Pilih gambar yang lebih kecil.');
    }
    return imageUrl;
  }

  if (imageUrl.length > 2048) throw new Error('Link gambar terlalu panjang.');
  if (imageUrl.startsWith('/uploads/')) {
    if (imageUrl.includes('..')) throw new Error('Jalur gambar tidak valid.');
    return imageUrl;
  }
  try {
    const parsed = new URL(imageUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Protokol link gambar tidak valid.');
    return imageUrl;
  } catch (err) {
    throw new Error('Masukkan link gambar lengkap yang diawali http:// atau https://.');
  }
}

// Do not remove an old image if an active exam may still use it.
// Also protect any image reference reused by another question or option.
function cleanupUnusedQuestionImage(imageRef, questionId, hadActiveAttempt) {
  if (!imageRef || !isCloudinaryImageRef(imageRef) || hadActiveAttempt) return;
  try {
    const questionRefs = db.prepare('SELECT COUNT(*) AS count FROM questions WHERE image_url = ?').get(imageRef).count;
    const optionRefs = db.prepare('SELECT COUNT(*) AS count FROM question_options WHERE image_url = ?').get(imageRef).count;
    if (questionRefs === 0 && optionRefs === 0) {
      deleteStoredImage(imageRef).catch(err => console.error('[CBTKU Cloudinary] Old image cleanup failed:', err.message));
    }
  } catch (err) {
    console.error('[CBTKU Cloudinary] Could not verify whether an old image is unused:', err.message);
  }
}

function questionHasActiveAttempt(questionId) {
  const result = db.prepare(`
    SELECT COUNT(*) AS count
    FROM attempt_questions aq
    JOIN exam_attempts a ON a.id = aq.attempt_id
    WHERE aq.question_id = ? AND a.status IN ('in_progress', 'locked')
  `).get(questionId);
  return (result?.count || 0) > 0;
}

// Image uploads pass through this authenticated endpoint with a strict 500 KB hard limit.
// The compressed payload remains far below Vercel's request-size ceiling; Neon stores only a reference.
router.post('/questions/image-upload', (req, res, next) => {
  questionImageUpload.single('image')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran gambar setelah kompresi maksimal 500 KB.'
        : (err.message || 'Unggahan gambar tidak valid.');
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Pilih file gambar terlebih dahulu.' });
  try {
    const uploaded = await uploadQuestionImage(req.file.buffer, req.file.mimetype);
    const imageRef = `cloudinary://${uploaded.public_id}`;
    const imageDisplayUrl = resolveImageDisplayUrl(imageRef);
    logAudit(req.user.id, 'UPLOAD_QUESTION_IMAGE', 'Mengunggah gambar ilustrasi soal', req.ip);
    res.status(201).json({
      image_url: imageRef,
      image_display_url: imageDisplayUrl,
      bytes: uploaded.bytes,
      format: uploaded.format
    });
  } catch (err) {
    const message = err?.message || 'Tidak dapat menyimpan gambar ke Cloudinary.';
    const status = /belum dikonfigurasi/i.test(message) ? 503 : 400;
    if (status === 503) console.error('[CBTKU Cloudinary] Configuration missing:', message);
    else console.error('[CBTKU Cloudinary] Upload failed:', message);
    res.status(status).json({ error: status === 503 ? message : `Gagal menyimpan gambar: ${message}` });
  }
});

// --- 5. QUESTION BANK CRUD & IMPORT (ALL 5 TYPES) ---
router.get('/questions', (req, res) => {
  const { subject_id, type, search } = req.query;
  let sql = `
    SELECT q.id, q.subject_id, q.type, q.question_text, q.weight, q.answer_key,
           q.rubric, q.status, q.created_at, s.name as subject_name, s.code as subject_code
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (subject_id) {
    sql += ' AND q.subject_id = ?';
    params.push(subject_id);
  }
  if (type) {
    sql += ' AND q.type = ?';
    params.push(type);
  }
  if (search) {
    sql += ' AND q.question_text LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY q.id DESC';
  const questions = db.prepare(sql).all(...params);

  // List payload deliberately excludes image_url and options. Fetch them from /questions/:id
  // only when an administrator opens a question, keeping the bank fast even with many images.
  res.json({ questions: questions.map(q => ({ ...q, image_url: null, options: [] })) });
});

router.get('/questions/:id', async (req, res) => {
  const { id } = req.params;
  const q = db.prepare(`
    SELECT q.*, s.name as subject_name
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE q.id = ?
  `).get(id);

  if (!q) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  try {
    const options = db.prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY order_num ASC').all(id);
    const imageDisplayUrl = await resolveImageDisplayUrl(q.image_url);
    const displayOptions = await Promise.all(options.map(async (option) => ({
      ...option,
      image_display_url: await resolveImageDisplayUrl(option.image_url)
    })));
    res.json({ question: { ...q, image_display_url: imageDisplayUrl, options: displayOptions } });
  } catch (err) {
    console.error('[CBTKU Cloudinary] Could not prepare question image URL:', err);
    res.status(503).json({ error: 'Gambar soal belum dapat disiapkan. Periksa konfigurasi penyimpanan gambar pada server.' });
  }
});

router.post('/questions', (req, res) => {
  const { subject_id, type, question_text, image_url, weight, answer_key, rubric, options } = req.body;
  let safeImageUrl;
  try {
    safeImageUrl = validateQuestionImageUrl(image_url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!subject_id || !type || !question_text || answer_key === undefined) {
    return res.status(400).json({ error: 'Mata pelajaran, jenis soal, teks soal, dan kunci jawaban wajib diisi' });
  }

  const validTypes = ['single_choice', 'multiple_choice', 'essay', 'matching', 'true_false'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Jenis soal tidak valid' });
  }

  const ansKeyStr = typeof answer_key === 'object' ? JSON.stringify(answer_key) : String(answer_key);

  const info = db.prepare(`
    INSERT INTO questions (subject_id, type, question_text, image_url, weight, answer_key, rubric, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(subject_id, type, question_text, safeImageUrl, weight || 1.0, ansKeyStr, rubric || null);

  const qId = info.lastInsertRowid;

  if (Array.isArray(options) && options.length > 0) {
    const optStmt = db.prepare(`
      INSERT INTO question_options (question_id, option_key, option_text, image_url, order_num)
      VALUES (?, ?, ?, ?, ?)
    `);
    options.forEach((opt, idx) => {
      optStmt.run(qId, opt.option_key || String.fromCharCode(65 + idx), opt.option_text || '', opt.image_url || null, idx);
    });
  }

  logAudit(req.user.id, 'CREATE_QUESTION', `Membuat soal tipe ${type} id ${qId}`, req.ip);
  res.json({ message: 'Soal berhasil disimpan', id: qId });
});

router.put('/questions/:id', (req, res) => {
  const { id } = req.params;
  const { subject_id, type, question_text, image_url, weight, answer_key, rubric, options } = req.body;
  let safeImageUrl;
  try {
    safeImageUrl = validateQuestionImageUrl(image_url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const existingQuestion = db.prepare('SELECT id, image_url FROM questions WHERE id = ?').get(id);
  if (!existingQuestion) return res.status(404).json({ error: 'Soal tidak ditemukan.' });
  const hadActiveAttempt = questionHasActiveAttempt(id);

  const ansKeyStr = typeof answer_key === 'object' ? JSON.stringify(answer_key) : String(answer_key);

  db.prepare(`
    UPDATE questions
    SET subject_id = ?, type = ?, question_text = ?, image_url = ?, weight = ?, answer_key = ?, rubric = ?
    WHERE id = ?
  `).run(subject_id, type, question_text, safeImageUrl, weight || 1.0, ansKeyStr, rubric || null, id);

  if (Array.isArray(options)) {
    db.prepare('DELETE FROM question_options WHERE question_id = ?').run(id);
    const optStmt = db.prepare(`
      INSERT INTO question_options (question_id, option_key, option_text, image_url, order_num)
      VALUES (?, ?, ?, ?, ?)
    `);
    options.forEach((opt, idx) => {
      optStmt.run(id, opt.option_key || String.fromCharCode(65 + idx), opt.option_text || '', opt.image_url || null, idx);
    });
  }

  // Clean up only if no running/locked attempt may still be using a temporary URL.
  if (existingQuestion.image_url && existingQuestion.image_url !== safeImageUrl) {
    cleanupUnusedQuestionImage(existingQuestion.image_url, id, hadActiveAttempt);
  }

  logAudit(req.user.id, 'UPDATE_QUESTION', `Update soal id ${id}`, req.ip);
  res.json({ message: 'Soal berhasil diperbarui' });
});

router.delete('/questions/:id', (req, res) => {
  const { id } = req.params;
  const existingQuestion = db.prepare('SELECT id, image_url FROM questions WHERE id = ?').get(id);
  if (!existingQuestion) return res.status(404).json({ error: 'Soal tidak ditemukan.' });
  const hadActiveAttempt = questionHasActiveAttempt(id);
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  cleanupUnusedQuestionImage(existingQuestion.image_url, id, hadActiveAttempt);
  res.json({ message: 'Soal berhasil dihapus' });
});

// Bulk Import Questions from Excel
router.post('/questions/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File Excel / CSV wajib diunggah' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) return res.status(400).json({ error: 'File kosong' });

    const subjects = db.prepare('SELECT id, code FROM subjects').all();
    const subMap = new Map();
    subjects.forEach(s => subMap.set(s.code.toUpperCase(), s.id));

    let successCount = 0;
    const errors = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const subCode = String(row.kode_mapel || row.subject_code || '').trim().toUpperCase();
      const subjectId = subMap.get(subCode);

      if (!subjectId) {
        errors.push({ row: rowNum, error: `Kode mapel "${subCode}" tidak ditemukan` });
        return;
      }

      const qText = String(row.soal || row.pertanyaan || row.question_text || '').trim();
      const type = String(row.jenis || row.type || 'single_choice').trim().toLowerCase();
      const weight = parseFloat(row.bobot || row.weight || 1.0);
      const answerKey = String(row.kunci || row.answer_key || '').trim();

      if (!qText || !answerKey) {
        errors.push({ row: rowNum, error: 'Teks soal atau kunci jawaban kosong' });
        return;
      }

      const info = db.prepare(`
        INSERT INTO questions (subject_id, type, question_text, weight, answer_key, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(subjectId, type, qText, weight, answerKey);

      const qId = info.lastInsertRowid;

      // Handle options A, B, C, D, E for choice types
      ['A', 'B', 'C', 'D', 'E'].forEach((key, oIdx) => {
        const optVal = row[`opsi_${key.toLowerCase()}`] || row[`opsi_${key}`] || row[key];
        if (optVal) {
          db.prepare(`
            INSERT INTO question_options (question_id, option_key, option_text, order_num)
            VALUES (?, ?, ?, ?)
          `).run(qId, key, String(optVal), oIdx);
        }
      });

      successCount++;
    });

    res.json({
      message: `Impor soal selesai: ${successCount} berhasil, ${errors.length} gagal`,
      successCount,
      errorCount: errors.length,
      errors
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memproses file: ' + err.message });
  }
});

// --- 6. EXAMS CRUD ---
router.get('/exams', (req, res) => {
  const exams = db.prepare(`
    SELECT e.*, s.name as subject_name, s.code as subject_code,
      (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count,
      (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id) as attempt_count,
      (SELECT token FROM exam_tokens WHERE exam_id = e.id AND status = 'active' ORDER BY id DESC LIMIT 1) as active_token
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    ORDER BY e.start_time DESC
  `).all();
  res.json({ exams });
});

router.get('/exams/:id', (req, res) => {
  const { id } = req.params;
  const exam = db.prepare(`
    SELECT e.*, s.name as subject_name, s.code as subject_code
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    WHERE e.id = ?
  `).get(id);

  if (!exam) return res.status(404).json({ error: 'Ujian tidak ditemukan' });

  const questions = db.prepare(`
    SELECT q.*, eq.order_num
    FROM exam_questions eq
    JOIN questions q ON eq.question_id = q.id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_num ASC
  `).all(id);

  const tokens = db.prepare('SELECT * FROM exam_tokens WHERE exam_id = ? ORDER BY id DESC').all(id);

  res.json({ exam, questions, tokens });
});

router.post('/exams', (req, res) => {
  const {
    title, subject_id, instructions, target_classes,
    start_time, end_time, duration_minutes, max_attempts,
    security_mode, shuffle_questions, shuffle_options, publish_score,
    question_ids
  } = req.body;

  if (!title || !subject_id || !start_time || !end_time || !duration_minutes) {
    return res.status(400).json({ error: 'Judul, mapel, jadwal mulai/selesai, dan durasi wajib diisi' });
  }

  const targetClassesStr = Array.isArray(target_classes) ? JSON.stringify(target_classes) : (target_classes || 'all');

  const info = db.prepare(`
    INSERT INTO exams (
      title, subject_id, instructions, target_classes,
      start_time, end_time, duration_minutes, max_attempts,
      security_mode, shuffle_questions, shuffle_options, publish_score, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
  `).run(
    title.trim(), subject_id, instructions || '', targetClassesStr,
    start_time, end_time, duration_minutes, max_attempts || 1,
    security_mode || 'standard',
    shuffle_questions !== undefined ? (shuffle_questions ? 1 : 0) : 1,
    shuffle_options !== undefined ? (shuffle_options ? 1 : 0) : 1,
    publish_score || 'manual'
  );

  const examId = info.lastInsertRowid;

  // Insert assigned questions
  if (Array.isArray(question_ids) && question_ids.length > 0) {
    const eqStmt = db.prepare('INSERT INTO exam_questions (exam_id, question_id, order_num) VALUES (?, ?, ?)');
    question_ids.forEach((qId, idx) => eqStmt.run(examId, qId, idx));
  }

  // Automatically generate initial token for the exam
  const randomToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.prepare(`
    INSERT INTO exam_tokens (exam_id, token, valid_from, valid_until, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(examId, randomToken, start_time, end_time);

  logAudit(req.user.id, 'CREATE_EXAM', `Membuat ujian "${title}" (ID: ${examId}) dengan token ${randomToken}`, req.ip);

  res.json({ message: 'Ujian berhasil dibuat', id: examId, token: randomToken });
});

router.put('/exams/:id', (req, res) => {
  const { id } = req.params;
  const {
    title, subject_id, instructions, target_classes,
    start_time, end_time, duration_minutes, max_attempts,
    security_mode, shuffle_questions, shuffle_options, publish_score, status,
    question_ids
  } = req.body;

  const targetClassesStr = Array.isArray(target_classes) ? JSON.stringify(target_classes) : (target_classes || 'all');

  db.prepare(`
    UPDATE exams SET
      title = ?, subject_id = ?, instructions = ?, target_classes = ?,
      start_time = ?, end_time = ?, duration_minutes = ?, max_attempts = ?,
      security_mode = ?, shuffle_questions = ?, shuffle_options = ?, publish_score = ?, status = ?
    WHERE id = ?
  `).run(
    title.trim(), subject_id, instructions || '', targetClassesStr,
    start_time, end_time, duration_minutes, max_attempts || 1,
    security_mode || 'standard',
    shuffle_questions ? 1 : 0, shuffle_options ? 1 : 0, publish_score || 'manual', status || 'published',
    id
  );

  if (Array.isArray(question_ids)) {
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(id);
    const eqStmt = db.prepare('INSERT INTO exam_questions (exam_id, question_id, order_num) VALUES (?, ?, ?)');
    question_ids.forEach((qId, idx) => eqStmt.run(id, qId, idx));
  }

  logAudit(req.user.id, 'UPDATE_EXAM', `Update ujian id ${id}`, req.ip);
  res.json({ message: 'Ujian berhasil diperbarui' });
});

router.delete('/exams/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  logAudit(req.user.id, 'DELETE_EXAM', `Hapus ujian id ${id}`, req.ip);
  res.json({ message: 'Ujian berhasil dihapus' });
});

// --- 7. EXAM TOKENS ---
router.post('/exams/:id/tokens', (req, res) => {
  const { id } = req.params;
  const { custom_token, valid_from, valid_until, max_usage } = req.body;

  const tokenStr = (custom_token ? custom_token.trim().toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase());
  const exam = db.prepare('SELECT start_time, end_time FROM exams WHERE id = ?').get(id);

  if (!exam) return res.status(404).json({ error: 'Ujian tidak ditemukan' });

  try {
    const info = db.prepare(`
      INSERT INTO exam_tokens (exam_id, token, valid_from, valid_until, max_usage, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(
      id,
      tokenStr,
      valid_from || exam.start_time,
      valid_until || exam.end_time,
      max_usage || 0
    );

    logAudit(req.user.id, 'CREATE_TOKEN', `Rilis token ${tokenStr} untuk ujian id ${id}`, req.ip);
    res.json({ message: 'Token berhasil dirilis', token: tokenStr, id: info.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Token tersebut sudah ada' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/tokens/:id/toggle', (req, res) => {
  const { id } = req.params;
  db.prepare(`
    UPDATE exam_tokens
    SET status = CASE WHEN status = 'active' THEN 'revoked' ELSE 'active' END
    WHERE id = ?
  `).run(id);
  res.json({ message: 'Status token berhasil diubah' });
});

// --- 8. ROTATING SUPERVISOR RECOVERY TOKEN ---
function getExamRecoveryInterval(examId) {
  const row = db.prepare('SELECT rotation_minutes FROM exam_recovery_settings WHERE exam_id = ?').get(examId);
  return normalizeRotationMinutes(row?.rotation_minutes || DEFAULT_ROTATION_MINUTES);
}

router.get('/exams/:id/recovery-token', (req, res) => {
  const examId = Number(req.params.id);
  const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.status(404).json({ error: 'Ujian tidak ditemukan.' });

  const rotationMinutes = getExamRecoveryInterval(examId);
  res.json({ exam_id: examId, ...getRecoveryToken(examId, rotationMinutes) });
});

router.put('/exams/:id/recovery-token-settings', (req, res) => {
  const examId = Number(req.params.id);
  const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.status(404).json({ error: 'Ujian tidak ditemukan.' });

  const raw = Number(req.body?.rotation_minutes);
  if (!Number.isInteger(raw) || raw < MIN_ROTATION_MINUTES || raw > MAX_ROTATION_MINUTES) {
    return res.status(400).json({ error: `Interval pergantian token harus berupa bilangan bulat ${MIN_ROTATION_MINUTES}–${MAX_ROTATION_MINUTES} menit.` });
  }

  db.prepare(`
    INSERT INTO exam_recovery_settings (exam_id, rotation_minutes, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(exam_id) DO UPDATE SET
      rotation_minutes = excluded.rotation_minutes,
      updated_at = CURRENT_TIMESTAMP
  `).run(examId, raw);

  logAudit(req.user.id, 'SET_RECOVERY_TOKEN_ROTATION', `Interval token pemulihan ujian ${examId} diatur menjadi ${raw} menit`, req.ip);
  res.json({ message: 'Interval token pemulihan berhasil disimpan.', exam_id: examId, ...getRecoveryToken(examId, raw) });
});

// --- 9. PROCTORING & REALTIME ATTEMPTS MONITORING ---
router.get('/exams/:id/proctor', (req, res) => {
  const { id } = req.params;

  const attempts = db.prepare(`
    SELECT a.*, u.full_name as student_name, u.username as student_username, c.name as class_name,
      (SELECT COUNT(*) FROM violation_logs WHERE attempt_id = a.id) as violation_count,
      (SELECT MAX(saved_at) FROM answers WHERE attempt_id = a.id) as last_autosave_at,
      r.total_score, r.is_published
    FROM exam_attempts a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN results r ON r.attempt_id = a.id
    WHERE a.exam_id = ?
    ORDER BY a.started_at DESC
  `).all(id);

  const violations = db.prepare(`
    SELECT v.*, u.full_name as student_name, u.username as student_username
    FROM violation_logs v
    JOIN users u ON v.user_id = u.id
    WHERE v.attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = ?)
    ORDER BY v.created_at DESC LIMIT 50
  `).all(id);

  res.json({ attempts, violations });
});

router.post('/attempts/:id/force-submit', (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE exam_attempts SET status = 'submitted', submitted_at = ? WHERE id = ?
  `).run(now, id);

  logAudit(req.user.id, 'FORCE_SUBMIT', `Admin memaksa kumpul ujian attempt id ${id}`, req.ip);
  res.json({ message: 'Pengerjaan siswa berhasil diselesaikan secara paksa.' });
});

router.post('/attempts/:id/reset', (req, res) => {
  const { id } = req.params;
  // Reset allows student another attempt or resets current attempt
  db.prepare('DELETE FROM answers WHERE attempt_id = ?').run(id);
  db.prepare('DELETE FROM attempt_questions WHERE attempt_id = ?').run(id);
  db.prepare('DELETE FROM results WHERE attempt_id = ?').run(id);
  db.prepare('DELETE FROM violation_logs WHERE attempt_id = ?').run(id);
  db.prepare('DELETE FROM exam_attempts WHERE id = ?').run(id);

  logAudit(req.user.id, 'RESET_ATTEMPT', `Admin mereset sesi pengerjaan attempt id ${id}`, req.ip);
  res.json({ message: 'Sesi ujian siswa berhasil direset.' });
});

// --- 9. ESSAY GRADING & SCORE RELEASE ---
router.get('/attempts/:id/grading', (req, res) => {
  const { id } = req.params;
  const attempt = db.prepare(`
    SELECT a.*, u.full_name as student_name, u.username as student_username, e.title as exam_title, e.id as exam_id
    FROM exam_attempts a
    JOIN users u ON a.user_id = u.id
    JOIN exams e ON a.exam_id = e.id
    WHERE a.id = ?
  `).get(id);

  if (!attempt) return res.status(404).json({ error: 'Attempt tidak ditemukan' });

  // Get all questions with answers, including correct keys for admin reference
  const answers = db.prepare(`
    SELECT q.id as question_id, q.type, q.question_text, q.weight, q.answer_key, q.rubric,
           ans.answer_value, ans.score_awarded, ans.essay_feedback
    FROM attempt_questions aq
    JOIN questions q ON aq.question_id = q.id
    LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = q.id
    WHERE aq.attempt_id = ?
    ORDER BY aq.order_num ASC
  `).all(id);

  const result = db.prepare('SELECT * FROM results WHERE attempt_id = ?').get(id);

  res.json({ attempt, answers, result });
});

router.post('/attempts/:id/grading', (req, res) => {
  const { id } = req.params;
  const { grades } = req.body; // array of { question_id, score_awarded, essay_feedback }

  grades.forEach(g => {
    db.prepare(`
      INSERT INTO answers (attempt_id, question_id, score_awarded, essay_feedback)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET
        score_awarded = excluded.score_awarded,
        essay_feedback = excluded.essay_feedback
    `).run(id, g.question_id, parseFloat(g.score_awarded) || 0, g.essay_feedback || '');
  });

  // Recalculate objective & essay scores
  const allAnswers = db.prepare(`
    SELECT q.type, q.weight, ans.score_awarded
    FROM attempt_questions aq
    JOIN questions q ON aq.question_id = q.id
    LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = q.id
    WHERE aq.attempt_id = ?
  `).all(id);

  let objScore = 0;
  let essayScore = 0;
  let totalWeight = 0;

  allAnswers.forEach(ans => {
    const w = ans.weight || 1.0;
    totalWeight += w;
    const score = ans.score_awarded || 0;
    if (ans.type === 'essay') {
      essayScore += score;
    } else {
      objScore += score;
    }
  });

  const rawTotal = objScore + essayScore;
  const totalScore = totalWeight > 0 ? (rawTotal / totalWeight) * 100 : rawTotal;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO results (attempt_id, objective_score, essay_score, total_score, max_score, graded_by, graded_at)
    VALUES (?, ?, ?, ?, 100, ?, ?)
    ON CONFLICT(attempt_id) DO UPDATE SET
      objective_score = excluded.objective_score,
      essay_score = excluded.essay_score,
      total_score = excluded.total_score,
      graded_by = excluded.graded_by,
      graded_at = excluded.graded_at
  `).run(id, objScore, essayScore, totalScore.toFixed(2), req.user.id, now);

  logAudit(req.user.id, 'GRADE_ATTEMPT', `Koreksi esai attempt id ${id}, nilai akhir: ${totalScore.toFixed(2)}`, req.ip);

  res.json({ message: 'Nilai berhasil disimpan', totalScore: totalScore.toFixed(2) });
});

router.post('/exams/:id/release-scores', (req, res) => {
  const { id } = req.params;
  const { publish } = req.body;
  const isPub = publish ? 1 : 0;

  db.prepare(`
    UPDATE results SET is_published = ?
    WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = ?)
  `).run(isPub, id);

  logAudit(req.user.id, 'RELEASE_SCORES', `${isPub ? 'Mempublikasikan' : 'Menarik'} nilai ujian id ${id}`, req.ip);
  res.json({ message: `Nilai ujian berhasil ${isPub ? 'dipublikasikan kepada murid' : 'disembunyikan'}.` });
});

// --- 10. AUDIT LOGS ---
router.get('/audit-logs', (req, res) => {
  const { search } = req.query;
  let sql = `
    SELECT a.*, u.username, u.full_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND (a.action LIKE ? OR a.details LIKE ? OR u.username LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT 100';
  const logs = db.prepare(sql).all(...params);
  res.json({ logs });
});

// --- 11. SAFE EXAM BROWSER (SEB) CONFIG GENERATOR ---
router.get('/seb/generate-config', (req, res) => {
  const { exam_id } = req.query;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const startUrl = `${protocol}://${host}/student/exam/${exam_id || ''}`;

  // Safe Exam Browser XML config format (.seb)
  const sebXml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>startURL</key>
    <string>${startUrl}</string>
    <key>browserWindowAllowReload</key>
    <true/>
    <key>allowQuit</key>
    <true/>
    <key>quitURL</key>
    <string>${protocol}://${host}/student</string>
    <key>browserViewMode</key>
    <integer>0</integer>
    <key>allowPreferencesWindow</key>
    <false/>
    <key>allowSwitchTo3rdPartyApps</key>
    <false/>
    <key>enableAltEsc</key>
    <false/>
    <key>enableCtrlEsc</key>
    <false/>
    <key>enableF1</key>
    <false/>
    <key>enableF2</key>
    <false/>
    <key>enableF3</key>
    <false/>
    <key>enableF4</key>
    <false/>
    <key>enableF5</key>
    <false/>
    <key>enablePrintScreen</key>
    <false/>
    <key>hookKeys</key>
    <true/>
    <key>insideSebEnableSwitchUser</key>
    <false/>
    <key>insideSebEnableLockScreen</key>
    <false/>
    <key>examKeySalt</key>
    <data>Q0JUS1UtUFJPVEVDVEVE</data>
</dict>
</plist>`;

  res.setHeader('Content-Type', 'application/seb');
  res.setHeader('Content-Disposition', `attachment; filename="CBTKU_Exam_${exam_id || 'Config'}.seb"`);
  res.send(sebXml);
});

module.exports = router;
