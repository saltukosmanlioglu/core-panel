import { z } from 'zod';
import { UserResponse } from './user.model';

// Request validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(72, 'Password must be at most 72 characters'),
});

export const mfaSetupVerifySchema = z.object({
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
});

export const mfaVerifySchema = z.object({
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
});

// Request types
export type LoginRequest = z.infer<typeof loginSchema>;
export type MfaSetupVerifyRequest = z.infer<typeof mfaSetupVerifySchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifySchema>;

// Response types
export interface LoginResponse {
  status: 'mfa_required' | 'mfa_setup_required';
}

export interface MfaSetupResponse {
  qrCodeUrl: string;
  secret: string;
}

export interface MeResponse {
  user: UserResponse;
}
