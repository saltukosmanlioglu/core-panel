export interface AdminStats {
  companies?: number;
  tenants: number;
  users: number;
}

export interface CompanyPayload {
  name: string;
}

export interface CreateFilePayload {
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  mimeType?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateFilePayload {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  filePath?: string;
  mimeType?: string;
  description?: string;
  tags?: string[];
}

export interface FileQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isArchived?: boolean;
  sortBy?: 'created_at' | 'file_name' | 'file_size';
  sortOrder?: 'asc' | 'desc';
}

export interface TenantPayload {
  name: string;
  companyId?: string;
}

export interface CreateAdminUserPayload {
  email: string;
  password: string;
  name?: string;
  role: string;
  companyId?: string | null;
  tenantId?: string | null;
  isActive: boolean;
}

export interface UpdateAdminUserPayload {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  companyId?: string | null;
  tenantId?: string | null;
  isActive?: boolean;
}
