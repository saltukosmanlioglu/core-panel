import type { LoginResponse, MfaSetupResponse, MfaVerifyResponse } from '@core-panel/shared';

export type { LoginResponse, MfaSetupResponse, MfaVerifyResponse };

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  tenantId: string | null;
  lastLogin: string | null;
}

export interface AuthMeResponse {
  user: AuthUser;
}
