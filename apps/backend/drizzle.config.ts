import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/db/schema.ts',
  out: './src/migrations/public',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
