import { pgTable, uuid, varchar, boolean, timestamp, numeric, text } from 'drizzle-orm/pg-core';

// ─── companies ───────────────────────────────────────────────────────────────

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  schemaProvisioned: boolean('schema_provisioned').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;

// ─── tenants ─────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;

// ─── users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 255 }).notNull().default('user'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  mfaSecret: varchar('mfa_secret', { length: 255 }),
  lastUsedOtpAt: timestamp('last_used_otp_at', { withTimezone: true }),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;

// ─── projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;

// ─── tenders ─────────────────────────────────────────────────────────────────

export const tenders = pgTable('tenders', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  budget: numeric('budget', { precision: 15, scale: 2 }),
  deadline: timestamp('deadline', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tender = typeof tenders.$inferSelect;
