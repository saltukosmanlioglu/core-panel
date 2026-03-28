import rateLimit from 'express-rate-limit';
import { AppError } from '../lib/AppError';

// NOTE: Uses in-memory store — not safe for multi-process deployments.
// For PM2 cluster or Kubernetes, replace with rate-limit-redis:
// import RedisStore from 'rate-limit-redis';

// ─── Per-email failed attempt tracker ────────────────────────────────────────

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export const checkEmailRateLimit = (email: string): void => {
  const now = Date.now();
  const record = failedAttempts.get(email);
  if (record && now < record.resetAt && record.count >= 10) {
    throw new AppError('Too many failed attempts for this account. Try again later.', 429, 'ACCOUNT_RATE_LIMITED');
  }
};

export const recordFailedAttempt = (email: string): void => {
  const now = Date.now();
  const record = failedAttempts.get(email);
  if (!record || now >= record.resetAt) {
    failedAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.count++;
  }
};

export const clearFailedAttempts = (email: string): void => {
  failedAttempts.delete(email);
};

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// MFA limiter — stricter
export const mfaLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 15,
  message: {
    error: 'Too many MFA attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests, please slow down',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
