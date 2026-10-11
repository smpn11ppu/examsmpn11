const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('--- Mulai Seeding Database CBTKU ---');

// 1. Seed Admin
const adminPasswordHash = bcrypt.hashSync('admin', 10);
const existingAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!existingAdmin) {
  db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, status, must_change_password)
    VALUES ('admin', ?, 'Administrator CBTKU', 'admin', 'active', 1)
  `).run(adminPasswordHash);
  console.log('✓ Akun Admin dibuat: admin / admin (Wajib ganti password saat login pertama)');
}

// 2. Seed Classes
const classesData = [
  { code: 'X-IPA-1', name: 'Kelas X IPA 1' },
  { code: 'X-IPS-1', name: 'Kelas X IPS 1' },
  { code: 'XI-IPA-2', name: 'Kelas XI IPA 2' },
  { code: 'XII-MIPA-1', name: 'Kelas XII MIPA 1' }
];

const insertClassStmt = db.prepare("INSERT OR IGNORE INTO classes (code, name, status) VALUES (?, ?, 'active')");
classesData.forEach(c => insertClassStmt.run(c.code, c.name));
console.log('✓ Data Kelas berhasil diinisialisasi');

const class1 = db.prepare("SELECT id FROM classes WHERE code = 'X-IPA-1'").get();
const class2 = db.prepare("SELECT id FROM classes WHERE code = 'X-IPS-1'").get();

// 3. Seed Students
const studentPasswordHash = bcrypt.hashSync('siswa11', 10);
const studentsData = [
  { username: 'siswa01', full_name: 'Budi Santoso', class_id: class1?.id || 1 },
  { username: 'siswa02', full_name: 'Siti Rahmawati', class_id: class1?.id || 1 },
  { username: 'siswa03', full_name: 'Ahmad Fauzi', class_id: class2?.id || 2 },
  { username: 'siswa04', full_name: 'Dewi Lestari', class_id: class2?.id || 2 },
  { username: 'siswa05', full_name: 'Rian Pratama', class_id: class1?.id || 1 }
];

const insertStudentStmt = db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash, full_name, role, class_id, status, must_change_password)
  VALUES (?, ?, ?, 'student', ?, 'active', 1)
`);
studentsData.forEach(s => insertStudentStmt.run(s.username, studentPasswordHash, s.full_name, s.class_id));
console.log('✓ Data Murid berhasil diinisialisasi: username siswa01-05 / siswa11');

// 4. Seed Subjects
const subjectsData = [
  { code: 'MAT-10', name: 'Matematika Wajib X', description: 'Kurikulum Merdeka Matematika' },
  { code: 'BIN-10', name: 'Bahasa Indonesia X', description: 'Tata Bahasa dan Literasi' },
  { code: 'BIO-10', name: 'Biologi X', description: 'Struktur Sel dan Keanekaragaman Hayati' },
  { code: 'SEJ-10', name: 'Sejarah Indonesia X', description: 'Peradaban Nusantara' }
];

const insertSubjectStmt = db.prepare("INSERT OR IGNORE INTO subjects (code, name, description, status) VALUES (?, ?, ?, 'active')");
subjectsData.forEach(s => insertSubjectStmt.run(s.code, s.name, s.description));
console.log('✓ Data Mata Pelajaran berhasil diinisialisasi');

const mathSub = db.prepare("SELECT id FROM subjects WHERE code = 'MAT-10'").get();
const bioSub = db.prepare("SELECT id FROM subjects WHERE code = 'BIO-10'").get();

// 5. Seed Questions for All 5 Types
const existingQuestions = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
if (existingQuestions === 0 && mathSub && bioSub) {
  // Question 1: Single Choice (Pilihan Ganda)
  const q1 = db.prepare(`
    INSERT INTO questions (subject_id, type, question_text, weight, answer_key, status)
    VALUES (?, 'single_choice', 'Berapakah nilai dari 2x + 5 = 15, jika dicari nilai x?', 20, 'B', 'active')
  `).run(mathSub.id);
  const q1Id = q1.lastInsertRowid;
  [
    { key: 'A', text: '3' },
    { key: 'B', text: '5' },
    { key: 'C', text: '7' },
    { key: 'D', text: '10' }
  ].forEach((opt, idx) => {
    db.prepare('INSERT INTO question_options (question_id, option_key, option_text, order_num) VALUES (?, ?, ?, ?)').run(q1Id, opt.key, opt.text, idx);
  });

  // Question 2: Multiple Choice (Pilihan Ganda Kompleks)
  const q2 = db.prepare(`
    INSERT INTO questions (subject_id, type, question_text, weight, answer_key, status)
    VALUES (?, 'multiple_choice', 'Manakah dari organel berikut yang terdapat pada sel tumbuhan? (Pilih semua yang benar)', 20, '["A","C"]', 'active')
  `).run(bioSub.id);
  const q2Id = q2.lastInsertRowid;
  [
    { key: 'A', text: 'Kloroplas' },
    { key: 'B', text: 'Sentriol' },
    { key: 'C', text: 'Dinding Sel' },
    { key: 'D', text: 'Hemoglobin' }
  ].forEach((opt, idx) => {
    db.prepare('INSERT INTO question_options (question_id, option_key, option_text, order_num) VALUES (?, ?, ?, ?)').run(q2Id, opt.key, opt.text, idx);
  });

  // Question 3: True / False (Benar / Salah)
  db.prepare(`
    INSERT INTO questions (subject_id, type, question_text, weight, answer_key, status)
    VALUES (?, 'true_false', 'Proses fotosintesis menghasilkan oksigen (O2) dan glukosa dengan bantuan cahaya matahari.', 20, 'true', 'active')
  `).run(bioSub.id);

  // Question 4: Matching (Menjodohkan)
  const matchingAnswerKey = JSON.stringify({
    'Mitokondria': 'Respirasi Sel & Energi',
    'Ribosom': 'Sintesis Protein',
    'Nukleus': 'Pusat Pengendali Genetik'
  });
  db.prepare(`
    INSERT INTO questions (subject_id, type, question_text, weight, answer_key, status)
    VALUES (?, 'matching', 'Jodohkan organel sel berikut dengan fungsi utamanya yang tepat!', 20, ?, 'active')
  `).run(bioSub.id, matchingAnswerKey);

  // Question 5: Essay (Esai)
  db.prepare(`
    INSERT INTO questions (subject_id, type, question_text, weight, answer_key, rubric, status)
    VALUES (?, 'essay', 'Jelaskan perbedaan mendasar antara sel prokariotik dan eukariotik beserta contoh organismenya!', 20, 'Kunci Esai: Sel prokariotik tidak memiliki membran inti (contoh: bakteri), sedangkan eukariotik memiliki membran inti (contoh: sel hewan dan tumbuhan).', 'Rubrik: Kejelasan definisi (10 poin), Contoh yang tepat (10 poin)', 'active')
  `).run(bioSub.id);

  console.log('✓ 5 Jenis Soal (Pilihan Ganda, Pilihan Ganda Kompleks, Benar/Salah, Menjodohkan, Esai) berhasil dibuat');
}

// 6. Seed Sample Exam
const existingExam = db.prepare("SELECT id FROM exams WHERE title LIKE '%Ujian Simulasi%'").get();
if (!existingExam && bioSub) {
  const now = new Date();
  const startTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // started 10 mins ago
  const endTime = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // valid 14 days

  const examInfo = db.prepare(`
    INSERT INTO exams (
      title, subject_id, instructions, target_classes,
      start_time, end_time, duration_minutes, max_attempts,
      security_mode, shuffle_questions, shuffle_options, publish_score, status
    ) VALUES (
      'Ujian Simulasi & PTS Biologi X', ?, 
      '1. Kerjakan soal dengan jujur dan teliti.\\n2. Dilarang membuka tab atau aplikasi lain selama ujian.\\n3. Jawaban tersimpan otomatis secara berkala.\\n4. Tekan tombol Selesai jika telah yakin.',
      'all', ?, ?, 60, 2, 'standard', 1, 1, 'manual', 'published'
    )
  `).run(bioSub.id, startTime, endTime);

  const examId = examInfo.lastInsertRowid;

  // Assign all questions to this exam
  const allQs = db.prepare('SELECT id FROM questions').all();
  allQs.forEach((q, idx) => {
    db.prepare('INSERT OR IGNORE INTO exam_questions (exam_id, question_id, order_num) VALUES (?, ?, ?)').run(examId, q.id, idx + 1);
  });

  // Create active Token CBT2026
  db.prepare(`
    INSERT OR IGNORE INTO exam_tokens (exam_id, token, valid_from, valid_until, max_usage, status)
    VALUES (?, 'CBT2026', ?, ?, 0, 'active')
  `).run(examId, startTime, endTime);

  console.log('✓ Ujian Simulasi dibuat dengan Token aktif: CBT2026 (Durasi: 60 Menit)');
}

console.log('--- Selesai Seeding Database CBTKU ---');
