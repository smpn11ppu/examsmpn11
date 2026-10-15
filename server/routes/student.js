const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { DEFAULT_ROTATION_MINUTES, getRecoveryToken } = require('../recovery-token');
const { resolveImageDisplayUrl } = require('../image-storage');

router.use(authenticate, requireRole('student'));

// Helper: shuffle array in place using Fisher-Yates
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 1. LIST AVAILABLE EXAMS FOR STUDENT
router.get('/exams', (req, res) => {
  const student = db.prepare('SELECT id, class_id FROM users WHERE id = ?').get(req.user.id);
  const now = new Date().toISOString();

  const exams = db.prepare(`
    SELECT e.id, e.title, e.instructions, e.target_classes, e.start_time, e.end_time,
           e.duration_minutes, e.max_attempts, e.security_mode, e.publish_score,
           s.name as subject_name, s.code as subject_code,
           (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    WHERE e.status = 'published'
    ORDER BY e.start_time ASC
  `).all();

  // Filter exams that match student's class
  const filteredExams = exams.filter(e => {
    if (e.target_classes === 'all' || !e.target_classes) return true;
    try {
      const allowed = JSON.parse(e.target_classes);
      if (Array.isArray(allowed)) {
        return allowed.includes(student.class_id) || allowed.includes(String(student.class_id));
      }
    } catch (_) {}
    return true;
  });

  // Attach student's attempts for each exam
  const attemptStmt = db.prepare(`
    SELECT a.id, a.attempt_number, a.status, a.started_at, a.submitted_at, a.server_end_time,
           r.total_score, r.is_published
    FROM exam_attempts a
    LEFT JOIN results r ON r.attempt_id = a.id
    WHERE a.exam_id = ? AND a.user_id = ?
    ORDER BY a.attempt_number DESC
  `);

  const results = filteredExams.map(e => {
    const attempts = attemptStmt.all(e.id, student.id);
    const activeAttempt = attempts.find(a => a.status === 'in_progress' || a.status === 'locked');
    const isUpcoming = now < e.start_time;
    const isPast = now > e.end_time;
    const isOngoing = !isUpcoming && !isPast;

    return {
      ...e,
      isUpcoming,
      isOngoing,
      isPast,
      attempts,
      activeAttempt: activeAttempt || null,
      attemptCount: attempts.length
    };
  });

  res.json({ exams: results });
});

// 2. VERIFY TOKEN AND PREREQUISITES
router.post('/exams/:id/verify-token', (req, res) => {
  const { id } = req.params;
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token ujian wajib dimasukkan.' });
  }

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!exam || exam.status !== 'published') {
    return res.status(404).json({ error: 'Ujian tidak ditemukan atau belum dipublikasikan.' });
  }

  const now = new Date();
  const startTime = new Date(exam.start_time);
  const endTime = new Date(exam.end_time);

  if (now < startTime) {
    return res.status(400).json({ error: `Ujian belum dimulai. Ujian dibuka pada ${startTime.toLocaleString('id-ID')}` });
  }
  if (now > endTime) {
    return res.status(400).json({ error: 'Masa pelaksanaan ujian ini telah berakhir.' });
  }

  // Check SEB security mode
  const userAgent = req.get('user-agent') || '';
  const isSebUserAgent = userAgent.includes('SEB') || userAgent.includes('SafeExamBrowser') || req.query.seb === '1';
  if (exam.security_mode === 'seb' && !isSebUserAgent) {
    return res.status(403).json({
      error: 'Ujian ini mewajibkan Safe Exam Browser (SEB). Silakan buka melalui aplikasi SEB atau unduh file konfigurasinya.',
      requires_seb: true
    });
  }

  // Check student attempts limit
  const attemptsCount = db.prepare('SELECT COUNT(*) as count FROM exam_attempts WHERE exam_id = ? AND user_id = ?').get(id, req.user.id).count;
  const activeAttempt = db.prepare("SELECT id, status FROM exam_attempts WHERE exam_id = ? AND user_id = ? AND status IN ('in_progress', 'locked')").get(id, req.user.id);

  if (!activeAttempt && attemptsCount >= exam.max_attempts) {
    return res.status(400).json({ error: `Anda telah mencapai batas maksimum pengerjaan (${exam.max_attempts} kali).` });
  }

  // Check token validity
  const tokenRecord = db.prepare(`
    SELECT * FROM exam_tokens 
    WHERE exam_id = ? AND token = ?
  `).get(id, token.trim().toUpperCase());

  if (!tokenRecord) {
    return res.status(400).json({ error: 'Token yang Anda masukkan salah.' });
  }

  if (tokenRecord.status !== 'active') {
    return res.status(400).json({ error: 'Token ujian ini telah dinonaktifkan atau dicabut oleh pengawas.' });
  }

  const tokenValidUntil = new Date(tokenRecord.valid_until);
  if (now > tokenValidUntil) {
    return res.status(400).json({ error: 'Masa berlaku token telah kedaluwarsa. Minta token baru kepada pengawas.' });
  }

  if (tokenRecord.max_usage > 0 && tokenRecord.usage_count >= tokenRecord.max_usage) {
    return res.status(400).json({ error: 'Batas pemakaian token ini telah tercapai.' });
  }

  res.json({ message: 'Token valid. Anda siap memulai ujian.', token: tokenRecord.token });
});

// 3. START OR RESUME ATTEMPT
router.post('/exams/:id/start', (req, res) => {
  const { id } = req.params;
  const { token } = req.body;

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!exam) return res.status(404).json({ error: 'Ujian tidak ditemukan.' });

  // Check if active in_progress attempt already exists
  const existingAttempt = db.prepare(`
    SELECT * FROM exam_attempts 
    WHERE exam_id = ? AND user_id = ? AND status IN ('in_progress', 'locked')
    ORDER BY id DESC
  `).get(id, req.user.id);

  if (existingAttempt) {
    return res.json({
      message: 'Melanjutkan sesi ujian Anda yang sedang berlangsung.',
      attempt_id: existingAttempt.id,
      server_end_time: existingAttempt.server_end_time,
      status: existingAttempt.status
    });
  }

  // If new attempt, verify token again
  if (!token) return res.status(400).json({ error: 'Token ujian diperlukan untuk memulai ujian.' });
  const tokenRecord = db.prepare("SELECT * FROM exam_tokens WHERE exam_id = ? AND token = ? AND status = 'active'").get(id, token.trim().toUpperCase());
  if (!tokenRecord) return res.status(400).json({ error: 'Token ujian tidak valid atau telah kedaluwarsa.' });

  // Increment token usage
  db.prepare('UPDATE exam_tokens SET usage_count = usage_count + 1 WHERE id = ?').run(tokenRecord.id);

  const now = new Date();
  const calculatedEndTime = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);
  const examHardDeadline = new Date(exam.end_time);

  // Hard deadline capped by exam end time
  const serverEndTime = (calculatedEndTime < examHardDeadline ? calculatedEndTime : examHardDeadline).toISOString();

  const userAgent = req.get('user-agent') || '';
  const isSeb = userAgent.includes('SEB') || userAgent.includes('SafeExamBrowser') ? 1 : 0;

  const previousAttempts = db.prepare('SELECT COUNT(*) as count FROM exam_attempts WHERE exam_id = ? AND user_id = ?').get(id, req.user.id).count;

  const attemptInfo = db.prepare(`
    INSERT INTO exam_attempts (exam_id, user_id, attempt_number, started_at, server_end_time, status, ip_address, user_agent, is_seb)
    VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)
  `).run(
    id,
    req.user.id,
    previousAttempts + 1,
    now.toISOString(),
    serverEndTime,
    req.ip,
    userAgent,
    isSeb
  );

  const attemptId = attemptInfo.lastInsertRowid;

  // Retrieve questions assigned to this exam
  const examQuestions = db.prepare(`
    SELECT q.id, q.type
    FROM exam_questions eq
    JOIN questions q ON eq.question_id = q.id
    WHERE eq.exam_id = ? AND q.status = 'active'
    ORDER BY eq.order_num ASC
  `).all(id);

  let orderedQuestions = [...examQuestions];
  if (exam.shuffle_questions) {
    orderedQuestions = shuffle(orderedQuestions);
  }

  // Save the randomized questions and options order to attempt_questions table
  const insertAqStmt = db.prepare(`
    INSERT INTO attempt_questions (attempt_id, question_id, order_num, shuffled_option_ids)
    VALUES (?, ?, ?, ?)
  `);

  const optStmt = db.prepare('SELECT id FROM question_options WHERE question_id = ? ORDER BY order_num ASC');

  orderedQuestions.forEach((q, idx) => {
    let optIds = optStmt.all(q.id).map(o => o.id);
    if (exam.shuffle_options && optIds.length > 0) {
      optIds = shuffle(optIds);
    }
    insertAqStmt.run(attemptId, q.id, idx + 1, JSON.stringify(optIds));
  });

  logAudit(req.user.id, 'START_EXAM', `Murid memulai ujian "${exam.title}" (Attempt ID: ${attemptId})`, req.ip);

  res.json({
    message: 'Ujian berhasil dimulai. Selamat mengerjakan!',
    attempt_id: attemptId,
    server_end_time: serverEndTime
  });
});

// 4. WORKSTATION: GET QUESTIONS AND RESTORE SAVED STATE
router.get('/attempts/:id/workstation', async (req, res) => {
  const { id } = req.params;

  const attempt = db.prepare(`
    SELECT a.*, e.title as exam_title, e.instructions, e.duration_minutes, e.security_mode, s.name as subject_name
    FROM exam_attempts a
    JOIN exams e ON a.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE a.id = ? AND a.user_id = ?
  `).get(id, req.user.id);

  if (!attempt) {
    return res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
  }

  const now = new Date();
  const serverEndTime = new Date(attempt.server_end_time);

  // Exam time continues to run while a violation lock is active.
  if ((attempt.status === 'in_progress' || attempt.status === 'locked') && now > serverEndTime) {
    db.prepare("UPDATE exam_attempts SET status = 'timed_out', submitted_at = ? WHERE id = ?").run(now.toISOString(), id);
    attempt.status = 'timed_out';
  }

  if (attempt.status !== 'in_progress' && attempt.status !== 'locked') {
    return res.status(400).json({
      error: 'Sesi ujian ini telah selesai atau kedaluwarsa.',
      status: attempt.status
    });
  }

  const remainingSeconds = Math.max(0, Math.floor((serverEndTime.getTime() - now.getTime()) / 1000));

  // Retrieve questions in this attempt's specific stored order
  // CRITICAL: We NEVER select `answer_key` here! It remains completely hidden from client!
  const questionsInOrder = db.prepare(`
    SELECT aq.order_num, aq.shuffled_option_ids,
           q.id, q.type, q.question_text, q.image_url, q.weight
    FROM attempt_questions aq
    JOIN questions q ON aq.question_id = q.id
    WHERE aq.attempt_id = ?
    ORDER BY aq.order_num ASC
  `).all(id);

  const allOptionsStmt = db.prepare('SELECT id, option_key, option_text, image_url FROM question_options WHERE question_id = ?');

  const questionsWithOrderedOptions = questionsInOrder.map(q => {
    let options = allOptionsStmt.all(q.id);
    if (q.shuffled_option_ids) {
      try {
        const orderIds = JSON.parse(q.shuffled_option_ids);
        const map = new Map(options.map(o => [o.id, o]));
        const reordered = [];
        orderIds.forEach(optId => {
          if (map.has(optId)) reordered.push(map.get(optId));
        });
        // append any newly added options that weren't in orderIds
        options.forEach(o => {
          if (!orderIds.includes(o.id)) reordered.push(o);
        });
        options = reordered;
      } catch (_) {}
    }

    return {
      id: q.id,
      order_num: q.order_num,
      type: q.type,
      question_text: q.question_text,
      image_url: q.image_url,
      weight: q.weight,
      options: options.map((opt, idx) => ({
        id: opt.id,
        // present friendly letter A, B, C... for display while keeping original option ID
        display_key: String.fromCharCode(65 + idx),
        option_key: opt.option_key,
        option_text: opt.option_text,
        image_url: opt.image_url
      }))
    };
  });

  // Replace private Cloudinary references with signed delivery URLs only for the questions in this attempt.
  // Image bytes are served by Cloudinary CDN; Neon contains only the compact image reference.
  try {
    await Promise.all(questionsWithOrderedOptions.map(async (question) => {
      question.image_url = await resolveImageDisplayUrl(question.image_url);
      question.options = await Promise.all(question.options.map(async (option) => ({
        ...option,
        image_url: await resolveImageDisplayUrl(option.image_url)
      })));
    }));
  } catch (err) {
    console.error('[CBTKU Cloudinary] Could not prepare student exam image URLs:', err);
    return res.status(503).json({ error: 'Gambar soal belum dapat dimuat. Hubungi admin sekolah untuk memeriksa konfigurasi penyimpanan gambar.' });
  }

  // Get student's existing answers from server
  const savedAnswers = db.prepare(`
    SELECT question_id, answer_value, is_flagged, saved_at
    FROM answers
    WHERE attempt_id = ?
  `).all(id);

  const answersMap = {};
  savedAnswers.forEach(a => {
    let parsedVal = a.answer_value;
    try {
      parsedVal = JSON.parse(a.answer_value);
    } catch (_) {}

    answersMap[a.question_id] = {
      value: parsedVal,
      is_flagged: Boolean(a.is_flagged),
      saved_at: a.saved_at
    };
  });

  const lastViolation = db.prepare(`
    SELECT message, created_at FROM violation_logs
    WHERE attempt_id = ? ORDER BY id DESC LIMIT 1
  `).get(id);
  const violationStats = db.prepare('SELECT COUNT(*) AS count FROM violation_logs WHERE attempt_id = ?').get(id);

  res.json({
    attempt: {
      id: attempt.id,
      exam_id: attempt.exam_id,
      exam_title: attempt.exam_title,
      instructions: attempt.instructions,
      subject_name: attempt.subject_name,
      security_mode: attempt.security_mode,
      status: attempt.status,
      lock_message: attempt.status === 'locked' ? (lastViolation?.message || 'Sesi dikunci setelah pelanggaran integritas terdeteksi.') : null,
      violation_count: violationStats?.count || 0,
      server_end_time: attempt.server_end_time,
      remaining_seconds: remainingSeconds,
      server_time: now.toISOString()
    },
    questions: questionsWithOrderedOptions,
    savedAnswers: answersMap
  });
});

// 5. AUTOSAVE SINGLE OR BATCH OF ANSWERS
router.post('/attempts/:id/autosave', (req, res) => {
  const { id } = req.params;
  const { question_id, answer_value, is_flagged } = req.body;

  if (!question_id) {
    return res.status(400).json({ error: 'ID soal wajib disertakan.' });
  }

  const attempt = db.prepare('SELECT id, status, server_end_time FROM exam_attempts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });

  const now = new Date();
  const serverEndTime = new Date(attempt.server_end_time);

  if (attempt.status === 'locked') {
    return res.status(423).json({ error: 'Ujian dikunci karena pelanggaran integritas. Minta token pemulihan aktif kepada pengawas.', is_locked: true });
  }

  if (now > serverEndTime || attempt.status !== 'in_progress') {
    if (attempt.status === 'in_progress') {
      db.prepare("UPDATE exam_attempts SET status = 'timed_out', submitted_at = ? WHERE id = ?").run(now.toISOString(), id);
    }
    return res.status(403).json({ error: 'Waktu ujian telah habis. Jawaban tidak dapat disimpan lagi.', is_expired: true });
  }

  const valStr = typeof answer_value === 'object' ? JSON.stringify(answer_value) : (answer_value !== undefined ? String(answer_value) : null);
  const nowIso = now.toISOString();

  db.prepare(`
    INSERT INTO answers (attempt_id, question_id, answer_value, is_flagged, saved_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      answer_value = excluded.answer_value,
      is_flagged = excluded.is_flagged,
      saved_at = excluded.saved_at
  `).run(id, question_id, valStr, is_flagged ? 1 : 0, nowIso);

  res.json({
    success: true,
    message: 'Jawaban berhasil disimpan di server',
    saved_at: nowIso,
    question_id
  });
});

// 6. RECORD VIOLATION AND VERIFY SERVER-SIDE LOCK
router.post('/attempts/:id/violation', (req, res) => {
  const { id } = req.params;
  const { violation_type, message, metadata } = req.body || {};

  const attempt = db.prepare('SELECT id, exam_id, status FROM exam_attempts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
  if (attempt.status === 'submitted' || attempt.status === 'timed_out') {
    return res.status(409).json({ error: 'Sesi ujian telah berakhir dan tidak dapat dikunci kembali.', locked: false });
  }

  // An already locked attempt is still locked; do not create duplicate records from blur+visibility events.
  if (attempt.status === 'locked') {
    return res.json({ recorded: true, locked: true, already_locked: true, message: 'Sesi ujian sudah terkunci dan menunggu token pengawas.' });
  }
  if (attempt.status !== 'in_progress') {
    return res.status(409).json({ error: 'Status sesi tidak mengizinkan penguncian.', locked: false, status: attempt.status });
  }

  const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata || '');
  const violationMessage = message || 'Pelanggaran terdeteksi';
  db.prepare(`
    INSERT INTO violation_logs (attempt_id, user_id, violation_type, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, violation_type || 'generic_violation', violationMessage, metaStr);

  // Persist the lock before acknowledging it to the client. If this fails, return an error rather than claiming success.
  db.prepare("UPDATE exam_attempts SET status = 'locked' WHERE id = ? AND user_id = ? AND status = 'in_progress'").run(id, req.user.id);
  const confirmed = db.prepare('SELECT status FROM exam_attempts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (confirmed?.status !== 'locked') {
    return res.status(500).json({ error: 'Server gagal menyimpan status terkunci. Jangan lanjutkan ujian; coba sinkronkan ulang dan hubungi pengawas.', locked: false });
  }

  res.json({ recorded: true, locked: true, message: 'Ujian dikunci di server. Token pemulihan pengawas diperlukan untuk melanjutkan.' });
});

// Only the currently valid rotating supervisor token can unlock a locked attempt.
router.post('/attempts/:id/unlock', (req, res) => {
  const { id } = req.params;
  const suppliedToken = String(req.body?.token || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!suppliedToken) return res.status(400).json({ error: 'Token pemulihan dari pengawas wajib diisi.' });

  const attempt = db.prepare('SELECT id, exam_id, status, server_end_time FROM exam_attempts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
  if (attempt.status !== 'locked') return res.status(409).json({ error: 'Sesi ujian tidak dalam status terkunci.' });
  if (Date.now() > new Date(attempt.server_end_time).getTime()) {
    db.prepare("UPDATE exam_attempts SET status = 'timed_out', submitted_at = ? WHERE id = ? AND status = 'locked'").run(new Date().toISOString(), id);
    return res.status(403).json({ error: 'Waktu ujian sudah habis. Penguncian tidak bisa dibuka kembali.' });
  }

  const nowIso = new Date().toISOString();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Persist rate limiting in the database because serverless function instances are not sticky.
  db.prepare('DELETE FROM exam_recovery_failures WHERE attempted_at < ?').run(oneDayAgo);
  const recentFailures = db.prepare(`
    SELECT COUNT(*) AS count FROM exam_recovery_failures
    WHERE attempt_id = ? AND user_id = ? AND attempted_at > ?
  `).get(id, req.user.id, oneMinuteAgo);
  if ((recentFailures?.count || 0) >= 5) {
    return res.status(429).json({ error: 'Terlalu banyak token salah. Tunggu satu menit lalu minta token aktif kepada pengawas.' });
  }

  const setting = db.prepare('SELECT rotation_minutes FROM exam_recovery_settings WHERE exam_id = ?').get(attempt.exam_id);
  const recovery = getRecoveryToken(attempt.exam_id, setting?.rotation_minutes || DEFAULT_ROTATION_MINUTES);
  if (suppliedToken !== recovery.token) {
    db.prepare('INSERT INTO exam_recovery_failures (attempt_id, user_id, attempted_at) VALUES (?, ?, ?)').run(id, req.user.id, nowIso);
    return res.status(403).json({ error: 'Token tidak sesuai atau sudah berganti. Minta token aktif kepada pengawas ruangan.' });
  }

  const updated = db.prepare("UPDATE exam_attempts SET status = 'in_progress' WHERE id = ? AND user_id = ? AND status = 'locked'").run(id, req.user.id);
  if (!updated || updated.changes === 0) return res.status(409).json({ error: 'Status sesi telah berubah. Muat ulang ruang ujian.' });
  logAudit(req.user.id, 'SUPERVISOR_TOKEN_UNLOCK', `Siswa berhasil membuka kunci attempt ${id} setelah token pemulihan pengawas diverifikasi`, req.ip);
  res.json({ unlocked: true, message: 'Ujian dibuka kembali oleh token pengawas.' });
});

// 7. SUBMIT EXAM WITH AUTOMATIC OBJECTIVE GRADING
router.post('/attempts/:id/submit', (req, res) => {
  const { id } = req.params;

  const attempt = db.prepare(`
    SELECT a.*, e.publish_score, e.title as exam_title
    FROM exam_attempts a
    JOIN exams e ON a.exam_id = e.id
    WHERE a.id = ? AND a.user_id = ?
  `).get(id, req.user.id);

  if (!attempt) return res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
  if (attempt.status === 'locked') {
    return res.status(423).json({ error: 'Ujian masih terkunci. Minta token pemulihan aktif kepada pengawas sebelum melanjutkan atau mengumpulkan.' });
  }

  // If already submitted (idempotent request)
  if (attempt.status === 'submitted' || attempt.status === 'timed_out') {
    const existingResult = db.prepare('SELECT * FROM results WHERE attempt_id = ?').get(id);
    return res.json({
      message: 'Ujian telah dikumpulkan sebelumnya.',
      already_submitted: true,
      submitted_at: attempt.submitted_at,
      is_published: existingResult ? Boolean(existingResult.is_published) : false,
      result: existingResult
    });
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE exam_attempts SET status = 'submitted', submitted_at = ? WHERE id = ?").run(now, id);

  // Perform automatic grading on objective questions
  const questions = db.prepare(`
    SELECT q.id, q.type, q.weight, q.answer_key
    FROM attempt_questions aq
    JOIN questions q ON aq.question_id = q.id
    WHERE aq.attempt_id = ?
  `).all(id);

  const studentAnswers = db.prepare('SELECT question_id, answer_value FROM answers WHERE attempt_id = ?').all(id);
  const ansMap = new Map();
  studentAnswers.forEach(a => ansMap.set(a.question_id, a.answer_value));

  let objScore = 0;
  let totalWeight = 0;
  let hasEssay = false;

  const updateAnsScoreStmt = db.prepare('UPDATE answers SET score_awarded = ? WHERE attempt_id = ? AND question_id = ?');

  questions.forEach(q => {
    const w = q.weight || 1.0;
    totalWeight += w;
    const rawVal = ansMap.get(q.id);

    if (q.type === 'essay') {
      hasEssay = true;
      // Essay scored manually by admin later
      updateAnsScoreStmt.run(null, id, q.id);
      return;
    }

    let awarded = 0;

    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      if (q.type === 'single_choice') {
        let parsed = rawVal;
        try { parsed = JSON.parse(rawVal); } catch (_) {}
        if (String(parsed).trim().toUpperCase() === String(q.answer_key).trim().toUpperCase()) {
          awarded = w;
        }
      } else if (q.type === 'true_false') {
        let parsed = rawVal;
        try { parsed = JSON.parse(rawVal); } catch (_) {}
        if (String(parsed).trim().toLowerCase() === String(q.answer_key).trim().toLowerCase()) {
          awarded = w;
        }
      } else if (q.type === 'multiple_choice') {
        try {
          const userArr = Array.isArray(rawVal) ? rawVal : JSON.parse(rawVal);
          const keyArr = Array.isArray(q.answer_key) ? q.answer_key : JSON.parse(q.answer_key);

          const sortedUser = [...userArr].map(x => String(x).trim().toUpperCase()).sort();
          const sortedKey = [...keyArr].map(x => String(x).trim().toUpperCase()).sort();

          if (JSON.stringify(sortedUser) === JSON.stringify(sortedKey)) {
            awarded = w;
          }
        } catch (_) {
          if (String(rawVal).trim().toUpperCase() === String(q.answer_key).trim().toUpperCase()) {
            awarded = w;
          }
        }
      } else if (q.type === 'matching') {
        try {
          const userPairs = typeof rawVal === 'object' ? rawVal : JSON.parse(rawVal);
          const keyPairs = typeof q.answer_key === 'object' ? q.answer_key : JSON.parse(q.answer_key);

          const totalPairs = Object.keys(keyPairs).length;
          let correctPairs = 0;
          Object.keys(keyPairs).forEach(k => {
            if (String(userPairs[k]).trim().toLowerCase() === String(keyPairs[k]).trim().toLowerCase()) {
              correctPairs++;
            }
          });
          if (totalPairs > 0) {
            awarded = (correctPairs / totalPairs) * w;
          }
        } catch (_) {}
      }
    }

    objScore += awarded;
    updateAnsScoreStmt.run(awarded, id, q.id);
  });

  const rawPercent = totalWeight > 0 ? (objScore / totalWeight) * 100 : objScore;
  const isPublished = (attempt.publish_score === 'immediate' && !hasEssay) ? 1 : 0;

  db.prepare(`
    INSERT INTO results (attempt_id, objective_score, essay_score, total_score, max_score, is_published, graded_at)
    VALUES (?, ?, 0, ?, 100, ?, ?)
  `).run(id, objScore, rawPercent.toFixed(2), isPublished, now);

  logAudit(req.user.id, 'SUBMIT_EXAM', `Murid mengumpulkan ujian "${attempt.exam_title}" (Attempt ID: ${id})`, req.ip);

  const resRecord = db.prepare('SELECT * FROM results WHERE attempt_id = ?').get(id);

  res.json({
    message: 'Ujian berhasil dikumpulkan.',
    submitted_at: now,
    is_published: Boolean(isPublished),
    result: isPublished ? resRecord : null
  });
});

// 8. GET RESULT (ONLY IF PUBLISHED)
router.get('/attempts/:id/result', (req, res) => {
  const { id } = req.params;

  const attempt = db.prepare(`
    SELECT a.*, e.title as exam_title, s.name as subject_name
    FROM exam_attempts a
    JOIN exams e ON a.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE a.id = ? AND a.user_id = ?
  `).get(id, req.user.id);

  if (!attempt) return res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });

  const result = db.prepare('SELECT * FROM results WHERE attempt_id = ?').get(id);

  if (!result || !result.is_published) {
    return res.json({
      attempt,
      is_published: false,
      message: 'Nilai ujian ini belum dirilis oleh guru / pengawas.'
    });
  }

  res.json({
    attempt,
    is_published: true,
    result
  });
});

module.exports = router;
