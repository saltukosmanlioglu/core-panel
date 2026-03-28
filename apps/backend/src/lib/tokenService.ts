import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

export type TokenStage = 'setup' | 'mfa' | 'full';

export interface TokenPayload {
  userId: string;
  email: string;
  stage: TokenStage;
  role?: string;
  companyId?: string | null;
  tenantId?: string | null;
  jti?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  jti: string;
}

// Short-lived token for MFA setup (5 min)
export const generateSetupToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email, stage: 'setup', jti: uuidv4() }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m',
  });
};

// Short-lived token for MFA verification (5 min)
export const generateMfaToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email, stage: 'mfa', jti: uuidv4() }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m',
  });
};

// Full session token (1h) — includes jti for revocation
export const generateFullToken = (userId: string, email: string, role: string, companyId: string | null, tenantId: string | null = null): string => {
  return jwt.sign(
    { userId, email, role, companyId, tenantId, stage: 'full', jti: uuidv4() },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
    }
  );
};

// Long-lived refresh token (7d)
export const generateRefreshToken = (userId: string): { token: string; jti: string } => {
  const jti = uuidv4();
  const token = jwt.sign({ userId, type: 'refresh', jti }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
  return { token, jti };
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as RefreshTokenPayload;
};
