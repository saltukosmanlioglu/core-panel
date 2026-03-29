'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Alert } from '@mui/material';
import { LockOutlined as LockIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AuthLayout } from '@/components/layout/auth-layout';
import { FormButton, FormOptInput } from '@/components/form-elements';
import { mfaVerifyApi, getMeApi } from '@/services/auth/api';
import { useUser } from '@/contexts/UserContext';
import { UserRole } from '@core-panel/shared';
import axios from 'axios';

export default function MfaVerifyPage() {
  const router = useRouter();
  const { setUser, setIsLoading } = useUser();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (code = otp) => {
    if (code.length !== 6) return;

    setLoading(true);
    setError(null);
    try {
      await mfaVerifyApi(code);
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
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers['retry-after'];
          const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
          setError(
            seconds
              ? `Çok fazla deneme. Lütfen ${seconds} saniye sonra tekrar deneyin.`
              : 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.'
          );
        } else if (err.response?.status === 401) {
          router.push('/login');
          return;
        } else {
          const d = err.response?.data as { error?: string } | undefined;
          setError(d?.error ?? 'Geçersiz kod. Lütfen uygulamanızı kontrol edin ve tekrar deneyin.');
        }
      } else {
        setError('Beklenmeyen bir hata oluştu.');
      }
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    setError(null);
    if (value.length === 6) {
      handleVerify(value);
    }
  };

  return (
    <AuthLayout>
      {/* Lock icon */}
      <Box className="flex flex-col items-center mb-4">
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: 'rgba(31,41,55,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <LockIcon sx={{ fontSize: 28, color: '#1F2937' }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '22px', mb: 1 }}>
          İki faktörlü kimlik doğrulama
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: '#6B7280', fontSize: '14px', textAlign: 'center', maxWidth: 320 }}
        >
          Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontSize: '13px' }}>
          {error}
        </Alert>
      )}

      <Box className="flex flex-col items-center gap-6">
        <FormOptInput
          value={otp}
          onChange={handleOtpChange}
          disabled={loading}
          error={!!error}
          errorMessage={error ?? undefined}
        />

        <Box className="flex flex-col gap-2 w-full">
          <FormButton
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onClick={() => handleVerify()}
            disabled={otp.length !== 6}
          >
            Doğrula
          </FormButton>
          <FormButton
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => router.push('/login')}
            disabled={loading}
            startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          >
            Girişe dön
          </FormButton>
        </Box>
      </Box>
    </AuthLayout>
  );
}
