import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { UPLOADS_DIR } from './config/paths';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parsing
app.use(cookieParser(env.COOKIE_SECRET));

// Rate limiting
app.use('/api', apiLimiter);

// Local uploads — allow cross-origin image/model loading (frontend is on a different port)
const setUploadHeaders = (res: express.Response, filePath?: string) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', env.FRONTEND_URL);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (filePath && path.extname(filePath).toLowerCase() === '.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary');
  }
};

app.use('/uploads', (req, res, next) => {
  setUploadHeaders(res, req.path);

  next();
}, express.static(UPLOADS_DIR, { setHeaders: setUploadHeaders }));

// Routes
app.use('/api', baseRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
