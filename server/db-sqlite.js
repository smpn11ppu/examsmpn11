const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const isProduction = process.env.NODE_ENV === 'production';
const initProductionDb = process.env.CBTKU_INIT_DB === 'true';
const allowProductionWrite = process.env.CBTKU_ALLOW_SQLITE_WRITE === 'true';
const canWrite = !isProduction || allowProductionWrite;
const canInitSchema = !isProduction || initProductionDb;
const dbPath = path.resolve(
  process.env.CBTKU_DB_PATH || path.join(process.cwd(), 'data', 'cbtku.sqlite')
);

let db = null;
let dbAvailable = false;

try {
  const exists = fs.existsSync(dbPath);

  if (!exists && (!canInitSchema || !canWrite)) {
    throw new Error(
      'Database SQLite belum ada. Untuk produksi, pasang disk persisten dan atur CBTKU_DB_PATH, CBTKU_INIT_DB=true, serta CBTKU_ALLOW_SQLITE_WRITE=true.'
    );
  }

  if (canWrite) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
  } else {
    db = new DatabaseSync(dbPath, { readOnly: true });
  }

  if (canWrite) db.exec('PRAGMA foreign_keys = ON;');

  // Local development always creates missing tables. In production this is
  // enabled only explicitly for the persistent-disk deployment configured below.
  if (canInitSchema) {
    db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    must_change_password INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('single_choice', 'multiple_choice', 'essay', 'matching', 'true_false')),
    question_text TEXT NOT NULL,
    image_url TEXT,
    weight REAL DEFAULT 1.0,
    answer_key TEXT NOT NULL,
    rubric TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS question_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_key TEXT NOT NULL,
    option_text TEXT NOT NULL,
    image_url TEXT,
    order_num INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    instructions TEXT,
    target_classes TEXT DEFAULT 'all',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    max_attempts INTEGER DEFAULT 1,
    security_mode TEXT DEFAULT 'standard' CHECK(security_mode IN ('standard', 'seb')),
    shuffle_questions INTEGER DEFAULT 1,
    shuffle_options INTEGER DEFAULT 1,
    publish_score TEXT DEFAULT 'manual' CHECK(publish_score IN ('immediate', 'manual')),
    status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    order_num INTEGER DEFAULT 0,
    UNIQUE(exam_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS exam_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    valid_from TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    max_usage INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_number INTEGER DEFAULT 1,
    started_at TEXT NOT NULL,
    submitted_at TEXT,
    server_end_time TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'submitted', 'timed_out', 'locked')),
    ip_address TEXT,
    user_agent TEXT,
    is_seb INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS attempt_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    order_num INTEGER NOT NULL,
    shuffled_option_ids TEXT
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_value TEXT,
    is_flagged INTEGER DEFAULT 0,
    saved_at TEXT,
    score_awarded REAL,
    essay_feedback TEXT,
    UNIQUE(attempt_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER UNIQUE NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    objective_score REAL DEFAULT 0,
    essay_score REAL DEFAULT 0,
    total_score REAL DEFAULT 0,
    max_score REAL DEFAULT 100,
    is_published INTEGER DEFAULT 0,
    graded_by INTEGER REFERENCES users(id),
    graded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS violation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL,
    message TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
  CREATE INDEX IF NOT EXISTS idx_exam_tokens_token ON exam_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_exam ON exam_attempts(user_id, exam_id);
  CREATE INDEX IF NOT EXISTS idx_answers_attempt ON answers(attempt_id);
  CREATE INDEX IF NOT EXISTS idx_violations_attempt ON violation_logs(attempt_id);
  `);
  }

  dbAvailable = true;
  console.log(`✅ Database SQLite siap: ${dbPath}`);
} catch (error) {
  dbAvailable = false;
  console.error('❌ Gagal membuka database CBTKU:', error.message);
  db = null;
}

if (!db) db = {};
db.dbAvailable = dbAvailable;
module.exports = db;
