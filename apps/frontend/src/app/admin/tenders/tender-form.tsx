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
import { getTenderApi, createTenderApi, updateTenderApi, getProjectsApi } from '@/services/workspace/api';
import type { Project } from '@core-panel/shared';
import axios from 'axios';

const schema = z.object({
  projectId: z.string().uuid('İnşaat zorunludur'),
  title: z.string().min(1, 'Başlık zorunludur').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { label: 'Taslak', value: 'draft' },
  { label: 'Açık', value: 'open' },
  { label: 'Kapalı', value: 'closed' },
  { label: 'Verildi', value: 'awarded' },
];

export function TenderForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { status: 'draft' },
  });

  useEffect(() => {
    const loads: Promise<unknown>[] = [getProjectsApi().then(setProjects)];

    if (id) {
      loads.push(
        getTenderApi(id).then((tender) => {
          reset({
            projectId: tender.projectId,
            title: tender.title,
            description: tender.description ?? '',
            status: tender.status as FormData['status'],
            deadline: tender.deadline ? new Date(tender.deadline).toISOString().slice(0, 16) : '',
          });
        }),
      );
    }

    Promise.all(loads)
      .catch(() => router.replace('/admin/tenders'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => {
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...pendingData,
        deadline: pendingData.deadline ? new Date(pendingData.deadline).toISOString() : undefined,
      };

      if (isEdit && id) {
        await updateTenderApi(id, payload);
        setSnackbar({ open: true, message: 'İhale başarıyla güncellendi', severity: 'success' });
      } else {
        const tender = await createTenderApi(payload);
        setSnackbar({ open: true, message: 'İhale başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push(`/admin/tenders/${tender.id}`), 1200);
      }
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { error?: string })?.error ?? 'İşlem başarısız')
        : 'İşlem başarısız';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      setPendingData(null);
    }
  };

  const projectOptions = projects.map((project) => ({
    label: project.name,
    value: project.id,
  }));

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton
          variant="ghost"
          size="sm"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => router.push('/admin/tenders')}
        >
          Geri
        </FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {isEdit ? 'İhale Düzenle' : 'Yeni İhale'}
      </Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>
        {isEdit ? 'İhale bilgilerini güncelle' : 'Yeni ihale oluştur ve projeye bağla'}
      </Typography>

      <Card sx={{ p: 4, maxWidth: 640 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="İnşaat"
                    options={projectOptions}
                    error={!!errors.projectId}
                    errorMessage={errors.projectId?.message}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
              <FormInput label="Başlık" error={!!errors.title} errorMessage={errors.title?.message} {...register('title')} />
              <FormInput label="Açıklama" error={!!errors.description} errorMessage={errors.description?.message} {...register('description')} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormSelect
                      label="Durum"
                      options={statusOptions}
                      error={!!errors.status}
                      errorMessage={errors.status?.message}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FormInput
                  label="Son Tarih"
                  type="datetime-local"
                  error={!!errors.deadline}
                  errorMessage={errors.deadline?.message}
                  {...register('deadline')}
                />
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/tenders')} type="button">
                  İptal
                </FormButton>
                <FormButton variant="primary" size="md" type="submit">
                  {isEdit ? 'Değişiklikleri Kaydet' : 'İhale Oluştur'}
                </FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'İhale Oluştur'}
        description={
          isEdit
            ? 'Bu ihaledeki değişiklikleri kaydetmek istiyor musunuz?'
            : `"${pendingData?.title}" ihalesini oluşturmak istiyor musunuz?`
        }
        onConfirm={handleConfirm}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingData(null);
        }}
        loading={loading}
        confirmLabel={isEdit ? 'Kaydet' : 'Oluştur'}
        confirmVariant="primary"
      />
      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
}
