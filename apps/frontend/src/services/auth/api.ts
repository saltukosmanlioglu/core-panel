import { apiClient } from '../api-client';
import type { AuthMeResponse, LoginResponse, MfaSetupResponse, MfaVerifyResponse } from './types';

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/api/auth/login', { email, password });
  return res.data;
}

export async function mfaSetupApi(): Promise<MfaSetupResponse> {
  const res = await apiClient.get<MfaSetupResponse>('/api/auth/mfa/setup');
  return res.data;
}

export async function mfaSetupVerifyApi(otpCode: string): Promise<MfaVerifyResponse> {
  const res = await apiClient.post<MfaVerifyResponse>('/api/auth/mfa/setup/verify', { otpCode });
  return res.data;
}

export async function mfaVerifyApi(otpCode: string): Promise<MfaVerifyResponse> {
  const res = await apiClient.post<MfaVerifyResponse>('/api/auth/mfa/verify', { otpCode });
  return res.data;
}

export async function getMeApi(): Promise<AuthMeResponse> {
  const res = await apiClient.get<AuthMeResponse>('/api/auth/me');
  return res.data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}
