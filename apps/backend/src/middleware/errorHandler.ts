import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError';

export { AppError };

const PG_ERRORS: Record<string, { status: number; error: string; code: string }> = {
  '23503': { status: 400, error: 'İlgili kayıt bulunamadı', code: 'FK_VIOLATION' },
  '23505': { status: 409, error: 'Bu değere sahip bir kayıt zaten mevcut', code: 'DUPLICATE_ENTRY' },
  '22P02': { status: 400, error: 'Geçersiz ID formatı', code: 'INVALID_ID' },
  '23502': { status: 400, error: 'Zorunlu alan eksik', code: 'NULL_VIOLATION' },
};

function getPgError(err: unknown): Record<string, unknown> | null {
  let current: unknown = err;

  while (current && typeof current === 'object') {
    const record = current as Record<string, unknown>;
    if (typeof record.code === 'string') {
      return record;
    }
    current = record.cause;
  }

  return null;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if ((err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code;
    const message = code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    res.status(400).json({ error: message, code: code ?? 'UPLOAD_ERROR' });
    return;
  }

  // Handle known Postgres errors before anything else
  const pgErr = getPgError(err);
  const pgCode = typeof pgErr?.code === 'string' ? pgErr.code : undefined;
  if (pgErr && pgCode && PG_ERRORS[pgCode]) {
    const pgError = PG_ERRORS[pgCode]!;
    console.error(`[${new Date().toISOString()}] PG Error ${pgCode} — ${req.method} ${req.path}`, {
      message: pgErr.message ?? err.message,
      detail: pgErr.detail,
      constraint: pgErr.constraint,
      table: pgErr.table,
      stack: err.stack,
    });
    res.status(pgError.status).json({ error: pgError.error, code: pgError.code });
    return;
  }

  const appErr = err instanceof AppError ? err : null;
  const statusCode = appErr?.statusCode ?? 500;

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    statusCode,
    code: appErr?.code ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
    message: err.message,
    cause: pgErr
      ? {
          code: pgErr.code,
          message: pgErr.message,
          detail: pgErr.detail,
          constraint: pgErr.constraint,
          table: pgErr.table,
        }
      : undefined,
    stack: err.stack,
  });

  const clientMessage =
    statusCode >= 500
      ? 'Beklenmeyen bir hata oluştu'
      : err.message ?? 'Bir hata oluştu';

  res.status(statusCode).json({
    error: clientMessage,
    code: appErr?.code ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
  });
}
