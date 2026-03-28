import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import {
  createFileSchema,
  updateFileSchema,
  fileQuerySchema,
} from '../../models/file.model';

// ─── Row type returned by pg for file_info ────────────────────────────────────

interface FileRow {
  id: string;
  file_name: string;
  file_type: string;
  file_size: string; // pg returns bigint as string
  file_path: string;
  mime_type: string | null;
  uploaded_by: string;
  description: string | null;
  tags: string[] | null;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: FileRow) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size),
    filePath: row.file_path,
    mimeType: row.mime_type,
    uploadedBy: row.uploaded_by,
    description: row.description,
    tags: row.tags,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Allowed sort columns — never interpolate user input directly
const SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  file_name: 'file_name',
  file_size: 'file_size',
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const listFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = fileQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid query params',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { page, limit, search, isArchived, sortBy, sortOrder } = parsed.data;
    const offset = (page - 1) * limit;
    const tdb = new TenantDb(String(req.params.companyId));
    const table = tdb.ref('file_info');

    // Build WHERE conditions using numbered params
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (isArchived !== undefined) {
      params.push(isArchived);
      conditions.push(`is_archived = $${params.length}`);
    }
    if (search) {
      params.push(search);
      conditions.push(`file_name ILIKE '%' || $${params.length} || '%'`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const col = SORT_COLUMNS[sortBy] ?? 'created_at';
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const sql = `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM ${table}
      ${where}
      ORDER BY ${col} ${dir}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const { rows } = await tdb.query<FileRow & { total_count: string }>(sql, params);

    const total = rows[0] ? Number(rows[0].total_count) : 0;
    res.json({
      files: rows.map(mapRow),
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};

export const getFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(String(req.params.companyId));
    const table = tdb.ref('file_info');

    const { rows } = await tdb.query<FileRow>(
      `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`,
      [String(req.params.id)],
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ file: mapRow(rows[0]) });
  } catch (err) {
    next(err);
  }
};

export const createFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createFileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const d = parsed.data;
    const tdb = new TenantDb(String(req.params.companyId));
    const table = tdb.ref('file_info');

    const { rows } = await tdb.query<FileRow>(
      `INSERT INTO ${table}
         (file_name, file_type, file_size, file_path, mime_type, uploaded_by, description, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        d.fileName,
        d.fileType,
        d.fileSize,
        d.filePath,
        d.mimeType ?? null,
        req.userId!,
        d.description ?? null,
        d.tags ?? null,
      ],
    );

    res.status(201).json({ file: mapRow(rows[0]!) });
  } catch (err) {
    next(err);
  }
};

export const updateFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateFileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const d = parsed.data;
    const tdb = new TenantDb(String(req.params.companyId));
    const table = tdb.ref('file_info');

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (d.fileName !== undefined) { params.push(d.fileName); setClauses.push(`file_name = $${params.length}`); }
    if (d.fileType !== undefined) { params.push(d.fileType); setClauses.push(`file_type = $${params.length}`); }
    if (d.fileSize !== undefined) { params.push(d.fileSize); setClauses.push(`file_size = $${params.length}`); }
    if (d.filePath !== undefined) { params.push(d.filePath); setClauses.push(`file_path = $${params.length}`); }
    if (d.mimeType !== undefined) { params.push(d.mimeType); setClauses.push(`mime_type = $${params.length}`); }
    if (d.description !== undefined) { params.push(d.description); setClauses.push(`description = $${params.length}`); }
    if (d.tags !== undefined) { params.push(d.tags); setClauses.push(`tags = $${params.length}`); }

    params.push(req.params.id);
    const idParam = params.length;

    const { rows } = await tdb.query<FileRow>(
      `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $${idParam} RETURNING *`,
      params,
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ file: mapRow(rows[0]) });
  } catch (err) {
    next(err);
  }
};

export const deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(String(req.params.companyId));
    const table = tdb.ref('file_info');

    const { rowCount } = await tdb.query(
      `DELETE FROM ${table} WHERE id = $1`,
      [String(req.params.id)],
    );

    if (rowCount === 0) {
      res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const archiveFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(String(req.params.companyId));
    const table = tdb.ref('file_info');

    const { rows } = await tdb.query<FileRow>(
      `UPDATE ${table} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [String(req.params.id)],
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ file: mapRow(rows[0]) });
  } catch (err) {
    next(err);
  }
};
