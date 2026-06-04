import { Request, Response, NextFunction } from 'express';

export function checkIsActive(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userIsActive === false) {
    res.status(403).json({ error: 'Hesap devre dışı', code: 'ACCOUNT_DEACTIVATED' });
    return;
  }
  next();
}
