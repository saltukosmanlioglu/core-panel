import { z } from 'zod';
import type { Company, Tenant, User, FileInfo, FileListResponse } from '@core-panel/shared';
import { apiClient } from '../api-client';
import type {
  AdminStats,
  CompanyPayload,
  CreateAdminUserPayload,
  CreateFilePayload,
  FileQueryParams,
  TenantPayload,
  UpdateAdminUserPayload,
  UpdateFilePayload,
} from './types';

const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  schemaProvisioned: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const tenantSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyName: z.string().nullable().optional(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.string(),
  companyId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  tenantName: z.string().nullable().optional(),
  isActive: z.boolean(),
  mfaEnabled: z.boolean(),
  lastLogin: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function getStatsApi(): Promise<AdminStats> {
  const res = await apiClient.get('/api/admin/stats');
  return (res.data as { stats: AdminStats }).stats;
}

export async function getCompaniesApi(): Promise<Company[]> {
  const res = await apiClient.get('/api/companies');
  const raw = (res.data as { companies: unknown }).companies;
  const result = z.array(companySchema).safeParse(raw);
  if (!result.success) {
    console.warn('API response validation failed (getCompanies):', result.error);
    return raw as Company[];
  }
  return result.data;
}

export async function getCompanyApi(id: string): Promise<Company> {
  const res = await apiClient.get(`/api/companies/${id}`);
  return (res.data as { company: Company }).company;
}

export async function createCompanyApi(data: CompanyPayload): Promise<Company> {
  const res = await apiClient.post('/api/companies', data);
  return (res.data as { company: Company }).company;
}

export async function updateCompanyApi(
  id: string,
  data: CompanyPayload,
): Promise<Company> {
  const res = await apiClient.put(`/api/companies/${id}`, data);
  return (res.data as { company: Company }).company;
}

export async function deleteCompanyApi(id: string): Promise<void> {
  await apiClient.delete(`/api/companies/${id}`);
}

export async function getTenantsApi(): Promise<Tenant[]> {
  const res = await apiClient.get('/api/tenants');
  const raw = (res.data as { tenants: unknown }).tenants;
  const result = z.array(tenantSchema).safeParse(raw);
  if (!result.success) {
    console.warn('API response validation failed (getTenants):', result.error);
    return raw as Tenant[];
  }
  return result.data;
}

export async function getTenantApi(id: string): Promise<Tenant> {
  const res = await apiClient.get(`/api/tenants/${id}`);
  return (res.data as { tenant: Tenant }).tenant;
}

export async function createTenantApi(data: TenantPayload): Promise<Tenant> {
  const res = await apiClient.post('/api/tenants', data);
  return (res.data as { tenant: Tenant }).tenant;
}

export async function updateTenantApi(
  id: string,
  data: TenantPayload,
): Promise<Tenant> {
  const res = await apiClient.put(`/api/tenants/${id}`, data);
  return (res.data as { tenant: Tenant }).tenant;
}

export async function deleteTenantApi(id: string): Promise<void> {
  await apiClient.delete(`/api/tenants/${id}`);
}

export async function getAdminUsersApi(): Promise<User[]> {
  const res = await apiClient.get('/api/admin/users');
  const raw = (res.data as { users: unknown }).users;
  const result = z.array(userSchema).safeParse(raw);
  if (!result.success) {
    console.warn('API response validation failed (getAdminUsers):', result.error);
    return raw as User[];
  }
  return result.data;
}

export async function getAdminUserApi(id: string): Promise<User> {
  const res = await apiClient.get(`/api/admin/users/${id}`);
  return (res.data as { user: User }).user;
}

export async function createAdminUserApi(
  data: CreateAdminUserPayload,
): Promise<User> {
  const res = await apiClient.post('/api/admin/users', data);
  return (res.data as { user: User }).user;
}

export async function updateAdminUserApi(
  id: string,
  data: UpdateAdminUserPayload,
): Promise<User> {
  const res = await apiClient.put(`/api/admin/users/${id}`, data);
  return (res.data as { user: User }).user;
}

export async function deleteAdminUserApi(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/users/${id}`);
}

// ─── Company schema provisioning ─────────────────────────────────────────────

export async function reprovisionCompanySchemaApi(id: string): Promise<Company> {
  const res = await apiClient.post(`/api/companies/${id}/reprovision`);
  return (res.data as { company: Company }).company;
}

// ─── File info (tenant-scoped) ────────────────────────────────────────────────

export async function getFilesApi(
  companyId: string,
  params?: FileQueryParams,
): Promise<FileListResponse> {
  const res = await apiClient.get(`/api/companies/${companyId}/files`, { params });
  return res.data as FileListResponse;
}

export async function getFileApi(companyId: string, fileId: string): Promise<FileInfo> {
  const res = await apiClient.get(`/api/companies/${companyId}/files/${fileId}`);
  return (res.data as { file: FileInfo }).file;
}

export async function createFileApi(
  companyId: string,
  data: CreateFilePayload,
): Promise<FileInfo> {
  const res = await apiClient.post(`/api/companies/${companyId}/files`, data);
  return (res.data as { file: FileInfo }).file;
}

export async function updateFileApi(
  companyId: string,
  fileId: string,
  data: UpdateFilePayload,
): Promise<FileInfo> {
  const res = await apiClient.patch(`/api/companies/${companyId}/files/${fileId}`, data);
  return (res.data as { file: FileInfo }).file;
}

export async function deleteFileApi(companyId: string, fileId: string): Promise<void> {
  await apiClient.delete(`/api/companies/${companyId}/files/${fileId}`);
}

export async function archiveFileApi(companyId: string, fileId: string): Promise<FileInfo> {
  const res = await apiClient.post(`/api/companies/${companyId}/files/${fileId}/archive`);
  return (res.data as { file: FileInfo }).file;
}
