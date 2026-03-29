import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as authService from './auth.service';
import { loginSchema, mfaSetupVerifySchema, mfaVerifySchema } from '../../models/auth.model';
import { env } from '../../config/env';
import { revokeToken } from '../../lib/tokenRevocationStore';
import {
  generateFullToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../lib/tokenService';
import * as usersRepo from '../users/users.repo';

const isProduction = env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'strict',
  path: '/',
} as const;

function setCookieToken(res: Response, token: string): void {
  res.cookie('access_token', token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 1000, // 1h
  });
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
}

function setStageToken(res: Response, token: string): void {
  res.cookie('stage_token', token, {
    ...cookieOptions,
    maxAge: 5 * 60 * 1000,
  });
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await authService.login(parsed.data.email, parsed.data.password);

    if (result.status === 'mfa_setup_required') {
      setStageToken(res, result.setupToken);
      res.json({ status: 'mfa_setup_required' });
      return;
    }

    setStageToken(res, result.mfaToken);
    res.json({ status: 'mfa_required' });
  } catch (err) {
    next(err);
  }
};

export const setupMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.setupMfa(req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const verifyMfaSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = mfaSetupVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { fullToken } = await authService.verifyMfaSetup(req.userId!, parsed.data.otpCode);
    const { token: refreshToken } = generateRefreshToken(req.userId!);
    res.clearCookie('stage_token', cookieOptions);
    setCookieToken(res, fullToken);
    setRefreshCookie(res, refreshToken);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const verifyMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = mfaVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { fullToken } = await authService.verifyMfa(req.userId!, parsed.data.otpCode);
    const { token: refreshToken } = generateRefreshToken(req.userId!);
    res.clearCookie('stage_token', cookieOptions);
    setCookieToken(res, fullToken);
    setRefreshCookie(res, refreshToken);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'Yenileme tokeni yok', code: 'NO_REFRESH_TOKEN' });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.status(401).json({ error: 'Geçersiz veya süresi dolmuş yenileme tokeni', code: 'REFRESH_TOKEN_INVALID' });
      return;
    }

    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Geçersiz token türü', code: 'REFRESH_TOKEN_INVALID' });
      return;
    }

    const user = await usersRepo.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'Hesap devre dışı', code: 'ACCOUNT_DEACTIVATED' });
      return;
    }

    const newAccessToken = generateFullToken(user.id, user.email, user.role, user.companyId ?? null);
    setCookieToken(res, newAccessToken);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.getMe(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
          jti?: string;
          exp?: number;
        };
        if (payload.jti && payload.exp) {
          revokeToken(payload.jti, payload.exp);
        }
      } catch {
        // Token already invalid — nothing to revoke
      }
    }
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    res.clearCookie('stage_token', cookieOptions);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
