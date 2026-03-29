'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Card, Typography, Divider } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { FormInput, FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { getCompanyApi, createCompanyApi, updateCompanyApi } from '@/services/admin/api';
import axios from 'axios';

const schema = z.object({
  name: z.string().min(1, 'Ad zorunludur').max(255),
});

type FormData = z.infer<typeof schema>;

interface CompanyFormProps {
  id?: string;
}

export function CompanyForm({ id }: CompanyFormProps) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    getCompanyApi(id)
      .then((c) => reset({ name: c.name }))
      .catch(() => router.replace('/admin/companies'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => {
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateCompanyApi(id, pendingData);
        setSnackbar({ open: true, message: 'Şirket başarıyla güncellendi', severity: 'success' });
      } else {
        await createCompanyApi(pendingData);
        setSnackbar({ open: true, message: 'Şirket başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push('/admin/companies'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'İşlem başarısız') : 'İşlem başarısız';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      setPendingData(null);
    }
  };

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/companies')}>
          Geri
        </FormButton>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {isEdit ? 'Şirket Düzenle' : 'Yeni Şirket'}
      </Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>
        {isEdit ? 'Şirket bilgilerini güncelle' : 'Yeni şirket oluştur'}
      </Typography>

      <Card sx={{ p: 4, maxWidth: 520 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8"><Box sx={{ color: '#1F2937' }}>Loading...</Box></Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput
                label="Şirket Adı"
                error={!!errors.name}
                errorMessage={errors.name?.message}
                {...register('name')}
              />
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/companies')} type="button">
                  İptal
                </FormButton>
                <FormButton variant="primary" size="md" type="submit">
                  {isEdit ? 'Değişiklikleri Kaydet' : 'Şirket Oluştur'}
                </FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'Şirket Oluştur'}
        description={isEdit ? `"${pendingData?.name}" şirketindeki değişiklikleri kaydetmek istiyor musunuz?` : `"${pendingData?.name}" şirketini oluşturmak istiyor musunuz?`}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setPendingData(null); }}
        loading={loading}
        confirmLabel={isEdit ? 'Kaydet' : 'Oluştur'}
        confirmVariant="primary"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
