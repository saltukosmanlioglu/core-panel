import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

// Key is stored as 64 hex chars (32 bytes)
function getKey(): Buffer {
  return Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex');
}

// Returns "iv:ciphertext:tag" all hex-encoded
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
