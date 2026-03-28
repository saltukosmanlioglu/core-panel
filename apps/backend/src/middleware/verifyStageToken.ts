import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenStage } from '../lib/tokenService';

export const verifyStageToken = (requiredStage: TokenStage) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies?.['stage_token'] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'No stage token', code: 'NO_STAGE_TOKEN' });
      return;
    }

    try {
      const payload = verifyToken(token);
      if (payload.stage !== requiredStage) {
        res.status(401).json({ error: 'Invalid token stage', code: 'INVALID_TOKEN_STAGE' });
        return;
      }
      req.userId = payload.userId;
      req.userEmail = payload.email;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired stage token', code: 'STAGE_TOKEN_INVALID' });
    }
  };
};
