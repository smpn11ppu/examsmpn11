'use strict';

// CBTKU dual database driver:
// - Local development keeps SQLite (same synchronous API used by existing routes).
// - When DATABASE_URL is provided, PostgreSQL/Neon is used through a dedicated
//   worker thread, preserving the current synchronous .prepare().get/all/run API.
// This bridge eases migration without rewriting every existing route at once.

if (!process.env.DATABASE_URL) {
  module.exports = require('./db-sqlite');
} else {
  const fs = require('node:fs');
  const path = require('node:path');
  const { Worker } = require('node:worker_threads');
  const { TextDecoder, TextEncoder } = require('node:util');

  const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
  const controlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  const control = new Int32Array(controlBuffer);
  const responseBuffer = new SharedArrayBuffer(MAX_RESPONSE_BYTES);
  const responseBytes = new Uint8Array(responseBuffer);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let worker;
  let dbAvailable = false;
  let lastInitError = null;

  function invoke(op, sql, params = []) {
    if (!worker) throw new Error(lastInitError || 'Worker database PostgreSQL belum aktif.');
    Atomics.store(control, 0, 0);
    Atomics.store(control, 1, 0);
    worker.postMessage({ op, sql, params, controlBuffer, responseBuffer });
    const waitResult = Atomics.wait(control, 0, 0, 30000);
    if (waitResult === 'timed-out') {
      throw new Error('Timeout saat menghubungi database PostgreSQL. Periksa DATABASE_URL dan status Neon.');
    }
    const state = Atomics.load(control, 0);
    const length = Atomics.load(control, 1);
    if (length < 0 || length > MAX_RESPONSE_BYTES) throw new Error('Respons database tidak valid.');
    let payload;
    try { payload = JSON.parse(decoder.decode(responseBytes.subarray(0, length))); }
    catch { throw new Error('Respons database PostgreSQL tidak dapat dibaca.'); }
    if (state !== 1 || !payload.ok) throw new Error(payload.error || 'Query PostgreSQL gagal.');
    return payload.value;
  }

  const db = {
    dbAvailable: false,
    exec(sql) {
      if (/^\s*PRAGMA\b/i.test(sql)) return undefined;
      return invoke('exec', sql, []);
    },
    prepare(sql) {
      return {
        get(...params) { return invoke('get', sql, params); },
        all(...params) { return invoke('all', sql, params); },
        run(...params) { return invoke('run', sql, params); }
      };
    }
  };

  try {
    // require.resolve makes the worker visible to file tracing during Vercel build.
    worker = new Worker(require.resolve('./postgres-worker.js'), {
      workerData: { connectionString: process.env.DATABASE_URL }
    });
    worker.on('error', (err) => {
      lastInitError = `Worker PostgreSQL gagal: ${err.message}`;
      dbAvailable = false;
      db.dbAvailable = false;
      console.error(lastInitError);
    });
    const schemaPath = require.resolve('./schema-postgres.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    invoke('exec', schema, []);
    dbAvailable = true;
    db.dbAvailable = true;
    console.log('✅ Database PostgreSQL/Neon siap.');
  } catch (error) {
    lastInitError = error.message;
    dbAvailable = false;
    db.dbAvailable = false;
    console.error('❌ Gagal menginisialisasi PostgreSQL/Neon:', error.message);
  }

  // Public flag is checked by server/index.js before accepting API requests.
  db.dbAvailable = dbAvailable;
  module.exports = db;
}
