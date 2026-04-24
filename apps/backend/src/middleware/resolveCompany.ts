import { Request, Response, NextFunction } from 'express';

/**
 * Resolves which company schema to query and attaches it as req.resolvedCompanyId.
 */
export async function resolveCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.userCompanyId) {
      req.resolvedCompanyId = req.userCompanyId;
      next();
      return;
    }

    res.status(403).json({ error: 'No company context for this user', code: 'NO_COMPANY_CONTEXT' });
  } catch (err) {
    next(err);
  }
}
