import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { UPLOADS_DIR } from './config/paths';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { verifyToken } from './middleware/verifyToken';
import { checkIsActive } from './middleware/checkIsActive';
import baseRouter from './rest/base-router';

const app = express();

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parsing
app.use(cookieParser(env.COOKIE_SECRET));

// Rate limiting
app.use('/api', apiLimiter);

// Authenticated file-streaming endpoint (replaces unauthenticated express.static).
// Matches any path under /api/files/**, e.g. /api/files/logos/logo-uuid.png
app.get('/api/files/*filePath', verifyToken, checkIsActive, (req, res) => {
  const filePathParam = (req.params as Record<string, string | string[]>)['filePath'];
  const relativePath = Array.isArray(filePathParam) ? filePathParam.join('/') : filePathParam ?? '';
  const resolved = path.resolve(UPLOADS_DIR, relativePath);

  // Prevent path traversal
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
    res.status(400).json({ error: 'Invalid file path', code: 'INVALID_PATH' });
    return;
  }

  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    return;
  }

  if (path.extname(resolved).toLowerCase() === '.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary');
  }

  res.sendFile(resolved);
});

// Routes
app.use('/api', baseRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
