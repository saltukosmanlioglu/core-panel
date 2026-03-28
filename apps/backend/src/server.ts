import 'dotenv/config';
import { env } from './config/env';
import app from './app';
import { checkDbConnection } from './db/connection';

async function start(): Promise<void> {
  await checkDbConnection();
  console.log('📦 Database connected');
  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log('🔐 JWT auth configured');
    console.log('🌍 Environment:', env.NODE_ENV);
  });
}

start().catch((err: unknown) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
