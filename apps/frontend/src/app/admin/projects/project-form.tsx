'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Card, Typography, Divider } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { FormInput, FormButton, FormSelect } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { getProjectApi, createProjectApi, updateProjectApi } from '@/services/workspace/api';
import axios from 'axios';

const schema = z.object({
  name: z.string().min(1, 'Ad zorunludur').max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'completed']),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { label: 'Aktif', value: 'active' },
  { label: 'Pasif', value: 'inactive' },
  { label: 'Tamamlandı', value: 'completed' },
];

export function ProjectForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { status: 'active' },
  });

  useEffect(() => {
    if (!id) return;
    getProjectApi(id)
      .then((p) => reset({ name: p.name, description: p.description ?? '', status: p.status as FormData['status'] }))
      .catch(() => router.replace('/admin/projects'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => { setPendingData(data); setConfirmOpen(true); };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateProjectApi(id, pendingData);
        setSnackbar({ open: true, message: 'İnşaat başarıyla güncellendi', severity: 'success' });
      } else {
        await createProjectApi(pendingData);
        setSnackbar({ open: true, message: 'İnşaat başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push('/admin/projects'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'İşlem başarısız') : 'İşlem başarısız';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/projects')}>Geri</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'İnşaat Düzenle' : 'Yeni İnşaat'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'İnşaat bilgilerini güncelle' : 'Yeni inşaat oluştur'}</Typography>

      <Card sx={{ p: 4, maxWidth: 640 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="İnşaat Adı" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              <FormInput label="Açıklama" error={!!errors.description} errorMessage={errors.description?.message} {...register('description')} />
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormSelect label="Durum" options={statusOptions} error={!!errors.status} errorMessage={errors.status?.message} value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/projects')} type="button">İptal</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Değişiklikleri Kaydet' : 'İnşaat Oluştur'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'İnşaat Oluştur'}
        description={isEdit ? 'Bu inşaattaki değişiklikleri kaydetmek istiyor musunuz?' : `"${pendingData?.name}" inşaatını oluşturmak istiyor musunuz?`}
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
