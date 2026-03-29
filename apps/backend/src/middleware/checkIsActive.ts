import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { users } from '../db/schema';

export async function checkIsActive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);

    if (!user[0]) {
      res.status(401).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
      return;
    }
    if (!user[0].isActive) {
      res.status(403).json({ error: 'Hesap devre dışı', code: 'ACCOUNT_DEACTIVATED' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
