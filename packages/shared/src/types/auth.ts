export interface LoginRequest {
  email: string;
  password: string;
}

export type AuthStatus = 'mfa_required' | 'mfa_setup_required';

export interface LoginResponse {
  status: AuthStatus;
}

export interface MfaSetupResponse {
  qrCodeUrl: string;
  secret: string;
}

export interface MfaVerifyResponse {
  status: string;
}
