'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Typography, Link, Divider } from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import { FormInput, FormButton } from '@/components/form-elements';
import { loginApi, getMeApi } from '@/services/auth/api';
import { useUser } from '@/contexts/UserContext';
import { UserRole } from '@core-panel/shared';
import axios from 'axios';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Company logo SVG for left panel
function ShieldLogo({ color = 'white' }: { color?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z"
        fill={color}
        opacity="0.9"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke={color === 'white' ? '#1F2937' : 'white'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setIsLoading } = useUser();
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('error') === 'deactivated') {
      setApiError('Your account has been deactivated. Please contact your administrator.');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);
    try {
      const result = await loginApi(data.email, data.password);

      if (result.status === 'mfa_setup_required') {
        router.push('/login/mfa-enroll');
        return;
      }

      if (result.status === 'mfa_required') {
        router.push('/login/mfa');
        return;
      }

      const meData = await getMeApi();
      setUser({
        id: meData.user.id,
        email: meData.user.email,
        name: meData.user.name,
        role: meData.user.role,
        companyId: meData.user.companyId,
        isActive: meData.user.isActive,
        mfaEnabled: meData.user.mfaEnabled,
        tenantId: meData.user.tenantId,
        lastLogin: meData.user.lastLogin,
      });
      setIsLoading(false);
      const adminRoles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN];
      router.push(adminRoles.includes(meData.user.role as UserRole) ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; code?: string } | undefined;
        if (data?.code === 'ACCOUNT_DEACTIVATED') {
          setApiError('Your account has been deactivated. Please contact your administrator.');
        } else {
          setApiError(data?.error ?? 'Invalid email or password. Please try again.');
        }
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left Panel — desktop only */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1F2937',
          position: 'relative',
          overflow: 'hidden',
          p: 6,
        }}
      >
        {/* Geometric pattern overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 80%, rgba(55,65,81,0.6) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(55,65,81,0.4) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(17,24,39,0.3) 0%, transparent 70%)
            `,
          }}
        />
        {/* Subtle grid pattern */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <Box sx={{ position: 'relative', textAlign: 'center', maxWidth: 360 }}>
          <Box className="flex justify-center mb-4">
            <ShieldLogo color="white" />
          </Box>
          <Typography
            variant="h5"
            sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '24px', mb: 2 }}
          >
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'CompanyName'}
          </Typography>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 3 }} />
          <Typography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px', lineHeight: 1.6 }}
          >
            Secure access to your workspace
          </Typography>
          <Box className="mt-8 flex flex-col gap-3">
            {['Enterprise Security', 'Multi-Factor Authentication', 'Role-Based Access'].map((item) => (
              <Box key={item} className="flex items-center gap-2">
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}
                >
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right Panel — Form */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 480px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          p: { xs: 3, sm: 5 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Logo (mobile / top of form) */}
          <Box className="flex items-center gap-2 mb-8">
            <ShieldLogo color="#1F2937" />
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, fontSize: '20px', color: '#1F2937' }}
            >
              {process.env.NEXT_PUBLIC_APP_NAME ?? 'CompanyName'}
            </Typography>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '28px', mb: 1 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '14px', mb: 4 }}>
            Sign in to your account
          </Typography>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput
                label="Email address"
                type="email"
                disabled={isSubmitting}
                error={!!errors.email}
                errorMessage={errors.email?.message}
                startIcon={<EmailIcon sx={{ fontSize: 18, color: '#94A3B8' }} />}
                {...register('email')}
              />

              <FormInput
                label="Password"
                password
                disabled={isSubmitting}
                error={!!errors.password}
                errorMessage={errors.password?.message}
                {...register('password')}
              />

              {/* Forgot password */}
              <Box className="flex justify-end" sx={{ mt: -1 }}>
                <Link
                  href="#"
                  underline="hover"
                  sx={{ fontSize: '13px', color: '#1F2937', fontWeight: 500 }}
                >
                  Forgot password?
                </Link>
              </Box>

              {/* API error */}
              {apiError && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '4px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#EF4444', fontSize: '13px' }}>
                    {apiError}
                  </Typography>
                </Box>
              )}

              <FormButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                sx={{ mt: 1 }}
              >
                Sign In
              </FormButton>
            </Box>
          </form>

          <Typography
            variant="body2"
            sx={{ mt: 4, color: '#9CA3AF', fontSize: '12px', textAlign: 'center' }}
          >
            Having trouble?{' '}
            <Link href="mailto:it@company.com" underline="hover" sx={{ color: '#64748B' }}>
              Contact IT support
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
