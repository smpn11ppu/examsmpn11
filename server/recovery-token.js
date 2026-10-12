'use strict';

const crypto = require('node:crypto');

const DEFAULT_ROTATION_MINUTES = 5;
const MIN_ROTATION_MINUTES = 1;
const MAX_ROTATION_MINUTES = 60;

function normalizeRotationMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ROTATION_MINUTES;
  return Math.max(MIN_ROTATION_MINUTES, Math.min(MAX_ROTATION_MINUTES, parsed));
}

function getRecoveryToken(examId, rotationMinutes, nowMs = Date.now()) {
  const minutes = normalizeRotationMinutes(rotationMinutes);
  const intervalMs = minutes * 60 * 1000;
  const bucket = Math.floor(nowMs / intervalMs);
  const nextBoundary = (bucket + 1) * intervalMs;
  // In production JWT_SECRET is explicitly configured. Local fallback matches
  // the existing local JWT secret so the flow is usable in development too.
  const secret = process.env.CBTKU_RECOVERY_SECRET || process.env.JWT_SECRET || 'cbtku-secure-jwt-key-2026';
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`CBTKU_RECOVERY_V1:${Number(examId)}:${bucket}`)
    .digest();
  const code = String(digest.readUInt32BE(0) % 1000000).padStart(6, '0');

  return {
    token: code,
    rotation_minutes: minutes,
    valid_until: new Date(nextBoundary).toISOString(),
    seconds_remaining: Math.max(1, Math.ceil((nextBoundary - nowMs) / 1000))
  };
}

module.exports = {
  DEFAULT_ROTATION_MINUTES,
  MIN_ROTATION_MINUTES,
  MAX_ROTATION_MINUTES,
  normalizeRotationMinutes,
  getRecoveryToken
};
