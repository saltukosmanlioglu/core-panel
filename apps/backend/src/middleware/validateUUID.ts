import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const validateUUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = uuidSchema.safeParse(req.params[paramName]);
    if (!result.success) {
      return res.status(400).json({
        error: `Invalid ${paramName} format`,
        code: 'INVALID_ID',
      });
    }
    next();
  };
};
