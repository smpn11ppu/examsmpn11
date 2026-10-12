'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { Pool } = require('pg');
const { TextEncoder } = require('node:util');

const encoder = new TextEncoder();
const pool = new Pool({
  connectionString: workerData.connectionString,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 12000,
  keepAlive: true,
  application_name: 'cbtku-vercel'
});
pool.on('error', (err) => console.error('Neon pool error:', err.message));

function rewriteSql(input, op) {
  let sql = String(input || '').trim().replace(/;+\s*$/, '');
  const ignoreInsert = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');

  // Replace SQLite positional placeholders while preserving quoted text.
  let output = '';
  let quote = null;
  let paramIndex = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      output += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote && quote !== '`') {
          output += sql[++i];
        } else {
          quote = null;
        }
      } else if (ch === '\\' && quote === "'" && i + 1 < sql.length) {
        // Preserve backslash-escaped characters inside single-quoted literals.
        output += sql[++i];
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch === '`' ? '"' : ch;
      output += ch === '`' ? '"' : ch;
      continue;
    }
    if (ch === '?') output += `$${++paramIndex}`;
    else output += ch;
  }
  sql = output;

  if (ignoreInsert && !/\bON\s+CONFLICT\b/i.test(sql)) sql += ' ON CONFLICT DO NOTHING';
  if (op === 'run' && /^INSERT\s+INTO\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
    sql += ' RETURNING id';
  }
  return sql;
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const [key, value] of Object.entries(row)) {
    // node-postgres returns COUNT(bigint) as a decimal string. Normalize common
    // integer aggregates/flags expected by existing UI routes.
    if (typeof value === 'string' && /^-?\d+$/.test(value) &&
        /(^count$|_count$|^in_progress$|^submitted$|^timed_out$|^total$|^usage_count$)/i.test(key)) {
      const n = Number(value);
      if (Number.isSafeInteger(n)) row[key] = n;
    }
  }
  return row;
}

function makeError(err) {
  if (err && err.code === '23505') return `UNIQUE constraint failed: ${err.constraint || 'duplicate key'}`;
  if (err && err.code === '23503') return `FOREIGN KEY constraint failed: ${err.constraint || 'reference'}`;
  if (err && err.code === '23514') return `CHECK constraint failed: ${err.constraint || 'check'}`;
  return err && err.message ? err.message : String(err);
}

parentPort.on('message', async (message) => {
  const control = new Int32Array(message.controlBuffer);
  const response = new Uint8Array(message.responseBuffer);
  let payload;
  try {
    if (message.op === 'exec') {
      // Schema has no parameters; PostgreSQL accepts multiple DDL statements
      // in simple-query mode in node-postgres.
      await pool.query(message.sql);
      payload = { ok: true, value: null };
    } else {
      const sql = rewriteSql(message.sql, message.op);
      const result = await pool.query(sql, message.params || []);
      if (message.op === 'get') {
        payload = { ok: true, value: result.rows.length ? normalizeRow(result.rows[0]) : null };
      } else if (message.op === 'all') {
        payload = { ok: true, value: result.rows.map(normalizeRow) };
      } else if (message.op === 'run') {
        const inserted = result.rows && result.rows.length ? result.rows[0] : null;
        payload = {
          ok: true,
          value: {
            changes: result.rowCount || 0,
            lastInsertRowid: inserted && inserted.id != null ? Number(inserted.id) : null
          }
        };
      } else {
        throw new Error(`Operasi database tidak dikenal: ${message.op}`);
      }
    }
  } catch (error) {
    payload = { ok: false, error: makeError(error), code: error && error.code };
  }

  try {
    const bytes = encoder.encode(JSON.stringify(payload));
    if (bytes.length > response.length) {
      const errorBytes = encoder.encode(JSON.stringify({ ok: false, error: 'Hasil query terlalu besar untuk satu respons.' }));
      response.set(errorBytes);
      Atomics.store(control, 1, errorBytes.length);
      Atomics.store(control, 0, 2);
    } else {
      response.set(bytes);
      Atomics.store(control, 1, bytes.length);
      Atomics.store(control, 0, payload.ok ? 1 : 2);
    }
  } catch (error) {
    const bytes = encoder.encode(JSON.stringify({ ok: false, error: error.message || 'Gagal menulis respons database.' }));
    response.set(bytes);
    Atomics.store(control, 1, bytes.length);
    Atomics.store(control, 0, 2);
  }
  Atomics.notify(control, 0, 1);
});
