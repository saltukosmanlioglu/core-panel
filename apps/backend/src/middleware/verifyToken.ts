import { Request, Response, NextFunction } from 'express';
import { verifyToken as verify } from '../lib/tokenService';
import { isTokenRevoked } from '../lib/tokenRevocationStore';
import { UserRole } from '@core-panel/shared';

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['access_token'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
    return;
  }

  try {
    const payload = verify(token);
    if (payload.stage !== 'full') {
      res.status(401).json({ error: 'Invalid token stage', code: 'INVALID_TOKEN_STAGE' });
      return;
    }
    if (payload.jti && isTokenRevoked(payload.jti)) {
      res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
      return;
    }
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    req.userCompanyId = payload.companyId ?? null;
    req.userTenantId = payload.tenantId ?? null;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
}
