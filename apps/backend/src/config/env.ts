const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'COOKIE_SECRET',
  'FRONTEND_URL',
  'MFA_ENCRYPTION_KEY',
  'ANTHROPIC_API_KEY',
  'MESHY_API_KEY',
  'FLOORPLANNER_API_KEY',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (!/^[0-9a-fA-F]{64}$/.test(process.env.MFA_ENCRYPTION_KEY!)) {
  throw new Error('MFA_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
}

const floorplannerEnvironment = process.env.FLOORPLANNER_ENV ?? 'sandbox';

if (!['sandbox', 'production'].includes(floorplannerEnvironment)) {
  throw new Error('FLOORPLANNER_ENV must be either "sandbox" or "production"');
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  COOKIE_SECRET: process.env.COOKIE_SECRET!,
  FRONTEND_URL: process.env.FRONTEND_URL!,
  MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
  MESHY_API_KEY: process.env.MESHY_API_KEY!,
  FLOORPLANNER_API_KEY: process.env.FLOORPLANNER_API_KEY!,
  FLOORPLANNER_ENV: floorplannerEnvironment as 'sandbox' | 'production',
  FLOORPLANNER_BASE_URL: process.env.FLOORPLANNER_BASE_URL
    ?? (floorplannerEnvironment === 'production' ? 'https://floorplanner.com' : 'https://sandbox.floorplanner.com'),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
} as const;
