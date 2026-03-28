'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Card, Typography, Divider } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { FormInput, FormButton, FormSelect } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { getTenderApi, createTenderApi, updateTenderApi, getProjectsApi } from '@/services/dashboard/api';
import type { Project } from '@core-panel/shared';
import axios from 'axios';

const schema = z.object({
  projectId: z.string().uuid('Project is required'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']),
  budget: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount').optional().or(z.literal('')),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Awarded', value: 'awarded' },
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
    resolver: zodResolver(schema),
    defaultValues: { status: 'draft' },
  });

  useEffect(() => {
    const loads: Promise<void>[] = [
      getProjectsApi().then(setProjects),
    ];
    if (id) {
      loads.push(
        getTenderApi(id).then((t) =>
          reset({
            projectId: t.projectId,
            title: t.title,
            description: t.description ?? '',
            status: t.status as FormData['status'],
            budget: t.budget ?? '',
            deadline: t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : '',
          })
        )
      );
    }
    Promise.all(loads)
      .catch(() => router.replace('/dashboard/tenders'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => { setPendingData(data); setConfirmOpen(true); };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      const payload = {
        ...pendingData,
        budget: pendingData.budget || undefined,
        deadline: pendingData.deadline ? new Date(pendingData.deadline).toISOString() : undefined,
      };
      if (isEdit && id) {
        await updateTenderApi(id, payload);
        setSnackbar({ open: true, message: 'Tender updated successfully', severity: 'success' });
      } else {
        await createTenderApi(payload);
        setSnackbar({ open: true, message: 'Tender created successfully', severity: 'success' });
        setTimeout(() => router.push('/dashboard/tenders'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Operation failed') : 'Operation failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  const projectOptions = projects.map((p) => ({ label: p.name, value: p.id }));

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/dashboard/tenders')}>Back</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Edit Tender' : 'New Tender'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Update tender details' : 'Create a new tender and associate it with a project'}</Typography>

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
                  <FormSelect label="Project" options={projectOptions} error={!!errors.projectId} errorMessage={errors.projectId?.message} value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
              <FormInput label="Title" error={!!errors.title} errorMessage={errors.title?.message} {...register('title')} />
              <FormInput label="Description" error={!!errors.description} errorMessage={errors.description?.message} {...register('description')} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormSelect label="Status" options={statusOptions} error={!!errors.status} errorMessage={errors.status?.message} value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
                <FormInput label="Budget (e.g. 50000.00)" error={!!errors.budget} errorMessage={errors.budget?.message} {...register('budget')} />
              </Box>
              <FormInput label="Deadline" type="datetime-local" error={!!errors.deadline} errorMessage={errors.deadline?.message} {...register('deadline')} />
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/dashboard/tenders')} type="button">Cancel</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Save Changes' : 'Create Tender'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Save Changes' : 'Create Tender'}
        description={isEdit ? 'Save changes to this tender?' : `Create tender "${pendingData?.title}"?`}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setPendingData(null); }}
        loading={loading}
        confirmLabel={isEdit ? 'Save' : 'Create'}
        confirmVariant="primary"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
