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
import { getProjectApi, createProjectApi, updateProjectApi } from '@/services/dashboard/api';
import axios from 'axios';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'completed']),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Completed', value: 'completed' },
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
    resolver: zodResolver(schema),
    defaultValues: { status: 'active' },
  });

  useEffect(() => {
    if (!id) return;
    getProjectApi(id)
      .then((p) => reset({ name: p.name, description: p.description ?? '', status: p.status as FormData['status'] }))
      .catch(() => router.replace('/dashboard/projects'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => { setPendingData(data); setConfirmOpen(true); };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateProjectApi(id, pendingData);
        setSnackbar({ open: true, message: 'Project updated successfully', severity: 'success' });
      } else {
        await createProjectApi(pendingData);
        setSnackbar({ open: true, message: 'Project created successfully', severity: 'success' });
        setTimeout(() => router.push('/dashboard/projects'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Operation failed') : 'Operation failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/dashboard/projects')}>Back</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Edit Project' : 'New Project'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Update project details' : 'Create a new project'}</Typography>

      <Card sx={{ p: 4, maxWidth: 640 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="Project Name" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              <FormInput label="Description" error={!!errors.description} errorMessage={errors.description?.message} {...register('description')} />
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormSelect label="Status" options={statusOptions} error={!!errors.status} errorMessage={errors.status?.message} value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/dashboard/projects')} type="button">Cancel</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Save Changes' : 'Create Project'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Save Changes' : 'Create Project'}
        description={isEdit ? 'Save changes to this project?' : `Create project "${pendingData?.name}"?`}
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
