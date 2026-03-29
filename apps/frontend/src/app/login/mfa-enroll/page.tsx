'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, LinearProgress, Alert } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AuthLayout } from '@/components/layout/auth-layout';
import { FormButton, FormOptInput } from '@/components/form-elements';
import { mfaSetupApi, mfaSetupVerifyApi, getMeApi } from '@/services/auth/api';
import { UserRole } from '@core-panel/shared';
import { useUser } from '@/contexts/UserContext';
import axios from 'axios';

type Step = 1 | 2;

export default function MfaEnrollPage() {
  const router = useRouter();
  const { setUser, setIsLoading } = useUser();
  const [step, setStep] = useState<Step>(1);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    handleSetup();
  }, []);

  const handleSetup = async () => {
    setEnrolling(true);
    setError(null);
    try {
      const data = await mfaSetupApi();
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          router.push('/login');
          return;
        }
        const d = err.response?.data as { error?: string } | undefined;
        setError(d?.error ?? 'MFA kaydı başlatılamadı. Lütfen tekrar deneyin.');
      } else {
        setError('Beklenmeyen bir hata oluştu.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;

    setLoading(true);
    setError(null);
    try {
      await mfaSetupVerifyApi(otp);
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
        } else {
          const d = err.response?.data as { error?: string } | undefined;
          setError(d?.error ?? 'Geçersiz kod. Lütfen tekrar deneyin.');
        }
      } else {
        setError('Beklenmeyen bir hata oluştu.');
      }
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* Step indicator */}
      <Box sx={{ mb: 3 }}>
        <Box className="flex justify-between items-center mb-2">
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '12px' }}>
            Adım {step}/2 — {step === 1 ? 'QR Kodu Tara' : 'Doğrula'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '12px' }}>
            {step}/2
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={step === 1 ? 50 : 100}
          sx={{
            borderRadius: 4,
            height: 4,
            backgroundColor: '#E5E7EB',
            '& .MuiLinearProgress-bar': { backgroundColor: '#3B82F6' },
          }}
        />
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '22px', mb: 1 }}>
        İki faktörlü kimlik doğrulamayı ayarla
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '13px' }}>
          {error}
        </Alert>
      )}

      {/* Step 1: QR Code */}
      {step === 1 && (
        <Box>
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 3 }}>
            QR kodunu kimlik doğrulama uygulamanızla tarayın (Google Authenticator, Authy vb.)
          </Typography>

          <Box className="flex flex-col items-center gap-4">
            {enrolling ? (
              <Box
                sx={{
                  width: 200,
                  height: 200,
                  backgroundColor: '#F3F4F6',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body2" sx={{ color: '#9CA3AF' }}>Yükleniyor…</Typography>
              </Box>
            ) : qrCodeUrl ? (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '4px',
                  display: 'inline-block',
                }}
              >
                <QRCodeSVG value={qrCodeUrl} size={200} level="M" />
              </Box>
            ) : null}

            {secret && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mb: 0.5 }}>
                  Ya da bu kodu manuel olarak girin:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    backgroundColor: '#F3F4F6',
                    px: 2,
                    py: 0.75,
                    borderRadius: '4px',
                    fontSize: '13px',
                    letterSpacing: '0.1em',
                    color: '#1F2937',
                    fontWeight: 600,
                  }}
                >
                  {secret}
                </Typography>
              </Box>
            )}
          </Box>

          <FormButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setStep(2)}
            disabled={!qrCodeUrl || enrolling}
            sx={{ mt: 4 }}
          >
            Devam Et — Kodu Girin
          </FormButton>
        </Box>
      )}

      {/* Step 2: Verify OTP */}
      {step === 2 && (
        <Box>
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>
            Kurulumu doğrulamak için kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.
          </Typography>

          <Box className="flex flex-col items-center gap-4">
            <FormOptInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
              error={!!error}
            />
          </Box>

          <Box className="flex flex-col gap-2 mt-4">
            <FormButton
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleVerify}
              disabled={otp.length !== 6}
            >
              Doğrula ve Devam Et
            </FormButton>
            <FormButton
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => { setStep(1); setOtp(''); setError(null); }}
              disabled={loading}
              startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
            >
              Geri
            </FormButton>
          </Box>
        </Box>
      )}
    </AuthLayout>
  );
}
