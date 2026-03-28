import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@core-panel/shared';

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== UserRole.SUPER_ADMIN) {
    res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    return;
  }
  next();
}
