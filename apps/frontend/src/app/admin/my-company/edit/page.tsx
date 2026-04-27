'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { Notification } from '@/components';
import { FormButton, FormInput } from '@/components/form-elements';
import {
  getCompaniesApi,
  updateCompanyApi,
  uploadCompanyLogoApi,
} from '@/services/admin/api';
import type { Company } from '@core-panel/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

export default function EditCompanyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    getCompaniesApi()
      .then((companies) => {
        const currentCompany = companies[0] ?? null;
        setCompany(currentCompany);
        setName(currentCompany?.name ?? '');
      })
      .catch((error) => {
        setSnackbar({ open: true, message: getErrorMessage(error, 'Şirket bilgileri yüklenemedi'), severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  const logoUrl = company?.logoPath ? `${API_URL}${company.logoPath}` : null;

  const handleLogoUpload = async (file: File | null) => {
    if (!file || !company) return;
    setUploading(true);
    try {
      const updated = await uploadCompanyLogoApi(company.id, file);
      setCompany(updated);
      setSnackbar({ open: true, message: 'Logo yüklendi', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: getErrorMessage(error, 'Logo yüklenemedi'), severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!company) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSnackbar({ open: true, message: 'Şirket adı zorunludur', severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      await updateCompanyApi(company.id, { name: trimmedName });
      setSnackbar({ open: true, message: 'Şirket bilgileri güncellendi', severity: 'success' });
      router.push('/admin/my-company');
    } catch (error) {
      setSnackbar({ open: true, message: getErrorMessage(error, 'Şirket bilgileri güncellenemedi'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: '#1F2937' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton
          variant="ghost"
          size="sm"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => router.push('/admin/my-company')}
        >
          Geri
        </FormButton>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Şirket Bilgilerini Düzenle
      </Typography>

      <Card sx={{ maxWidth: 640, borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'grid', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                Logo
              </Typography>
              <Box
                sx={{
                  border: '1px dashed #CBD5E1',
                  borderRadius: '8px',
                  minHeight: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 2,
                  backgroundColor: '#F8FAFC',
                  p: 3,
                }}
              >
                {logoUrl ? (
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 2,
                      backgroundColor: '#f1f5f9',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt={company?.name ?? 'Şirket logosu'}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 82,
                      height: 82,
                      borderRadius: '20px',
                      backgroundColor: '#E5E7EB',
                      color: '#1F2937',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 42 }} />
                  </Box>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleLogoUpload(file);
                    event.target.value = '';
                  }}
                />
                <FormButton
                  variant="secondary"
                  size="md"
                  startIcon={<PhotoCameraIcon sx={{ fontSize: 18 }} />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  Logo Yükle
                </FormButton>
              </Box>
              <Typography sx={{ color: '#6B7280', fontSize: 12, mt: 1 }}>
                Max 5MB, PNG/JPG/WebP/SVG
              </Typography>
            </Box>

            <FormInput
              label="Şirket Adı"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <FormButton variant="secondary" size="md" type="button" onClick={() => router.push('/admin/my-company')}>
                İptal
              </FormButton>
              <FormButton variant="primary" size="md" type="button" onClick={handleSave} loading={saving}>
                Değişiklikleri Kaydet
              </FormButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} />
    </Box>
  );
}
