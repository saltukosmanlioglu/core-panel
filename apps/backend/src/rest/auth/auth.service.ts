import crypto from 'crypto';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import * as usersRepo from '../users/users.repo';
import { AppError } from '../../lib/AppError';
import { encrypt, decrypt } from '../../lib/encryption';
import {
  checkEmailRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../../middleware/rateLimiter';
import {
  generateSetupToken,
  generateMfaToken,
  generateFullToken,
} from '../../lib/tokenService';

// Generated once at startup — always run bcrypt.compare even when user doesn't exist
// to prevent timing-based user enumeration
const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
const TOTP_REUSE_WINDOW_MS = 90 * 1000;
const TOTP_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const usedTotpCodes: Map<string, Set<string>> = new Map();

function serializeUsedTotpCode(code: string, timestamp: number): string {
  return `${code}:${timestamp}`;
}

function parseUsedTotpCode(entry: string): { code: string; timestamp: number } | null {
  const separatorIndex = entry.lastIndexOf(':');
  if (separatorIndex < 0) return null;

  const timestamp = Number(entry.slice(separatorIndex + 1));
  if (!Number.isFinite(timestamp)) return null;

  return { code: entry.slice(0, separatorIndex), timestamp };
}

function cleanupUsedTotpCodes(now = Date.now()): void {
  for (const [userId, entries] of usedTotpCodes) {
    for (const entry of entries) {
      const parsed = parseUsedTotpCode(entry);
      if (!parsed || now - parsed.timestamp >= TOTP_REUSE_WINDOW_MS) {
        entries.delete(entry);
      }
    }

    if (entries.size === 0) {
      usedTotpCodes.delete(userId);
    }
  }
}

function assertTotpCodeNotRecentlyUsed(userId: string, otpCode: string, now = Date.now()): void {
  const entries = usedTotpCodes.get(userId);
  if (!entries) return;

  for (const entry of entries) {
    const parsed = parseUsedTotpCode(entry);
    if (!parsed || now - parsed.timestamp >= TOTP_REUSE_WINDOW_MS) continue;
    if (parsed.code === otpCode) {
      throw new AppError('Code already used', 401, 'CODE_ALREADY_USED');
    }
  }
}

function recordTotpCodeUse(userId: string, otpCode: string, now = Date.now()): void {
  const entries = usedTotpCodes.get(userId) ?? new Set<string>();
  entries.add(serializeUsedTotpCode(otpCode, now));
  usedTotpCodes.set(userId, entries);
}

const cleanupInterval = setInterval(() => cleanupUsedTotpCodes(), TOTP_CLEANUP_INTERVAL_MS);
cleanupInterval.unref?.();

export type LoginResult =
  | { status: 'mfa_setup_required'; setupToken: string }
  | { status: 'mfa_required'; mfaToken: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  checkEmailRateLimit(email);

  const user = await usersRepo.findByEmail(email);

  // Always run bcrypt.compare — prevents timing-based user enumeration
  const hashToCompare = user?.password ?? dummyHash;
  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !isValid) {
    if (user) recordFailedAttempt(email); // only track real accounts
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // isActive check after password verification — same timing for all invalid-credential paths
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  clearFailedAttempts(email);

  if (!user.mfaEnabled) {
    const setupToken = generateSetupToken(user.id, user.email);
    return { status: 'mfa_setup_required', setupToken };
  }

  const mfaToken = generateMfaToken(user.id, user.email);
  return { status: 'mfa_required', mfaToken };
}

export async function setupMfa(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
  const user = await usersRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  if (user.mfaEnabled) throw new AppError('MFA is already enabled', 400, 'MFA_ALREADY_ENABLED');

  const secret = speakeasy.generateSecret({
    name: `CorePanel (${user.email})`,
    length: 20,
  });

  await usersRepo.update(userId, { mfaSecret: encrypt(secret.base32) });

  return { qrCodeUrl: secret.otpauth_url!, secret: secret.base32 };
}

export async function verifyMfaSetup(userId: string, otpCode: string): Promise<{ fullToken: string }> {
  const user = await usersRepo.findByIdFull(userId);
  if (!user?.mfaSecret) {
    throw new AppError('MFA not initialized', 400, 'MFA_NOT_INITIALIZED');
  }

  const plainSecret = decrypt(user.mfaSecret);
  assertTotpCodeNotRecentlyUsed(userId, otpCode);

  const isValid = speakeasy.totp.verify({
    secret: plainSecret,
    encoding: 'base32',
    token: otpCode,
    window: 1,
  });

  if (!isValid) {
    throw new AppError('Invalid OTP code', 400, 'INVALID_OTP');
  }

  recordTotpCodeUse(userId, otpCode);
  await usersRepo.update(userId, { mfaEnabled: true });

  const fullToken = generateFullToken(user.id, user.email, user.role, user.companyId ?? null, null, user.isActive);
  return { fullToken };
}

export async function verifyMfa(userId: string, otpCode: string): Promise<{ fullToken: string }> {
  const user = await usersRepo.findByIdFull(userId);
  if (!user?.mfaSecret) {
    throw new AppError('MFA not configured', 400, 'MFA_NOT_CONFIGURED');
  }

  const plainSecret = decrypt(user.mfaSecret);
  assertTotpCodeNotRecentlyUsed(userId, otpCode);

  const isValid = speakeasy.totp.verify({
    secret: plainSecret,
    encoding: 'base32',
    token: otpCode,
    window: 1,
  });

  if (!isValid) {
    throw new AppError('Invalid OTP code', 400, 'INVALID_OTP');
  }

  recordTotpCodeUse(userId, otpCode);
  await usersRepo.update(userId, { lastLogin: new Date() });

  const fullToken = generateFullToken(user.id, user.email, user.role, user.companyId ?? null, null, user.isActive);
  return { fullToken };
}

export async function getMe(userId: string) {
  return usersRepo.findById(userId);
}
