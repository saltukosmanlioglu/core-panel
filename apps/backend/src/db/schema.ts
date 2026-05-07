import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
} from 'drizzle-orm/pg-core';

// ─── companies ───────────────────────────────────────────────────────────────

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  schemaProvisioned: boolean('schema_provisioned').default(false).notNull(),
  logoPath: text('logo_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;

// ─── users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('company_admin'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  mfaSecret: text('mfa_secret'),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
