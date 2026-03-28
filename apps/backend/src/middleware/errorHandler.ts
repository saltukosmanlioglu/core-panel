import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError';

export { AppError };

const PG_ERRORS: Record<string, { status: number; error: string; code: string }> = {
  '23503': { status: 400, error: 'Referenced record does not exist', code: 'FK_VIOLATION' },
  '23505': { status: 409, error: 'A record with this value already exists', code: 'DUPLICATE_ENTRY' },
  '22P02': { status: 400, error: 'Invalid ID format', code: 'INVALID_ID' },
  '23502': { status: 400, error: 'Required field is missing', code: 'NULL_VIOLATION' },
};

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle known Postgres errors before anything else
  const pgCode = (err as unknown as Record<string, unknown>).code as string | undefined;
  if (pgCode && PG_ERRORS[pgCode]) {
    const pgError = PG_ERRORS[pgCode]!;
    console.error(`[${new Date().toISOString()}] PG Error ${pgCode} — ${req.method} ${req.path}`, err.message);
    res.status(pgError.status).json({ error: pgError.error, code: pgError.code });
    return;
  }

  const appErr = err instanceof AppError ? err : null;
  const statusCode = appErr?.statusCode ?? 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
      statusCode,
      message: err.message,
      stack: err.stack,
    });
  } else {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} ${statusCode}`);
  }

  const clientMessage =
    statusCode >= 500
      ? 'An unexpected error occurred'
      : err.message ?? 'An error occurred';

  res.status(statusCode).json({
    error: clientMessage,
    code: appErr?.code ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
  });
}
