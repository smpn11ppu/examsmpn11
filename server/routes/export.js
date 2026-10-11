const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

// Helper to calculate duration in minutes
function calcDuration(startedAt, submittedAt) {
  if (!startedAt || !submittedAt) return '-';
  const start = new Date(startedAt);
  const end = new Date(submittedAt);
  const diffMs = end - start;
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// GET /api/export/results?exam_id=&class_id=&format=xlsx|csv
router.get('/results', (req, res) => {
  const { exam_id, class_id, format = 'xlsx' } = req.query;

  let sql = `
    SELECT 
      a.id as attempt_id,
      u.username,
      u.full_name as student_name,
      c.name as class_name,
      e.title as exam_title,
      s.name as subject_name,
      a.started_at,
      a.submitted_at,
      a.status as attempt_status,
      r.objective_score,
      r.essay_score,
      r.total_score,
      r.is_published,
      (SELECT COUNT(*) FROM violation_logs WHERE attempt_id = a.id) as total_violations
    FROM exam_attempts a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN classes c ON u.class_id = c.id
    JOIN exams e ON a.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    LEFT JOIN results r ON r.attempt_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (exam_id) {
    sql += ' AND a.exam_id = ?';
    params.push(exam_id);
  }
  if (class_id) {
    sql += ' AND u.class_id = ?';
    params.push(class_id);
  }

  sql += ' ORDER BY c.name ASC, u.full_name ASC';
  const rows = db.prepare(sql).all(...params);

  const exportData = rows.map((r, idx) => ({
    No: idx + 1,
    'Username Siswa': r.username,
    'Nama Lengkap': r.student_name,
    'Kelas': r.class_name || '-',
    'Ujian': r.exam_title,
    'Mata Pelajaran': r.subject_name,
    'Waktu Mulai': r.started_at ? new Date(r.started_at).toLocaleString('id-ID') : '-',
    'Waktu Selesai': r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '-',
    'Durasi Pengerjaan': calcDuration(r.started_at, r.submitted_at),
    'Status Pengerjaan': r.attempt_status === 'submitted' ? 'Selesai' : (r.attempt_status === 'in_progress' ? 'Sedang Mengerjakan' : r.attempt_status),
    'Nilai Objektif': r.objective_score !== null ? r.objective_score : '-',
    'Nilai Esai': r.essay_score !== null ? r.essay_score : '-',
    'Nilai Total': r.total_score !== null ? r.total_score : '-',
    'Status Nilai': r.is_published ? 'Dirilis' : 'Belum Dirilis',
    'Jumlah Pelanggaran': r.total_violations || 0
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

  const filename = `Hasil_Ujian_${Date.now()}`;

  if (format === 'csv') {
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csvContent);
  } else {
    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  }
});

// GET /api/export/violations?exam_id=&format=xlsx|csv
router.get('/violations', (req, res) => {
  const { exam_id, format = 'xlsx' } = req.query;

  let sql = `
    SELECT 
      v.id as log_id,
      v.created_at,
      u.username,
      u.full_name as student_name,
      c.name as class_name,
      e.title as exam_title,
      v.violation_type,
      v.message,
      v.metadata
    FROM violation_logs v
    JOIN users u ON v.user_id = u.id
    LEFT JOIN classes c ON u.class_id = c.id
    JOIN exam_attempts a ON v.attempt_id = a.id
    JOIN exams e ON a.exam_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (exam_id) {
    sql += ' AND a.exam_id = ?';
    params.push(exam_id);
  }

  sql += ' ORDER BY v.created_at DESC';
  const rows = db.prepare(sql).all(...params);

  const exportData = rows.map((r, idx) => ({
    No: idx + 1,
    'Waktu Kejadian': new Date(r.created_at).toLocaleString('id-ID'),
    'Username Siswa': r.username,
    'Nama Siswa': r.student_name,
    'Kelas': r.class_name || '-',
    'Ujian': r.exam_title,
    'Tipe Pelanggaran': r.violation_type,
    'Keterangan': r.message,
    'Metadata': r.metadata || '-'
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Log Pelanggaran');

  const filename = `Log_Pelanggaran_${Date.now()}`;

  if (format === 'csv') {
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csvContent);
  } else {
    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  }
});

module.exports = router;
