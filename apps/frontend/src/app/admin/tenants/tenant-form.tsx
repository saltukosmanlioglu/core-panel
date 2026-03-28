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
import {
  getTenantApi,
  createTenantApi,
  updateTenantApi,
  getCompaniesApi,
} from '@/services/admin/api';
import type { Company } from '@core-panel/shared';
import { UserRole } from '@core-panel/shared';
import { useUser } from '@/contexts/UserContext';
import axios from 'axios';

const baseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  companyId: z.string().optional(),
});

const superAdminSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  companyId: z.string().min(1, 'Company is required'),
});

type FormData = { name: string; companyId?: string };

export function TenantForm({ id }: { id?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const isCompanyAdmin = user?.role === UserRole.COMPANY_ADMIN;
  const schema = isCompanyAdmin ? baseSchema : superAdminSchema;
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  useEffect(() => {
    const loads = [getCompaniesApi().then(setCompanies)];
    if (id) loads.push(getTenantApi(id).then((t) => reset({ name: t.name, companyId: t.companyId })) as Promise<void>);
    Promise.all(loads)
      .catch(() => router.replace('/admin/tenants'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => { setPendingData(data); setConfirmOpen(true); };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      const payload = { name: pendingData.name, companyId: pendingData.companyId ?? '' };
      if (isEdit && id) {
        await updateTenantApi(id, payload);
        setSnackbar({ open: true, message: 'Tenant updated successfully', severity: 'success' });
      } else {
        await createTenantApi(payload);
        setSnackbar({ open: true, message: 'Tenant created successfully', severity: 'success' });
        setTimeout(() => router.push('/admin/tenants'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Operation failed') : 'Operation failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  const companyOptions = companies.map((c) => ({ label: c.name, value: c.id }));

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/tenants')}>Back</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Edit Tenant' : 'New Tenant'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Update tenant details' : 'Create a new tenant'}</Typography>

      <Card sx={{ p: 4, maxWidth: 520 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="Tenant Name" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              {!isCompanyAdmin && (
                <Controller
                  name="companyId"
                  control={control}
                  render={({ field }) => (
                    <FormSelect
                      label="Company"
                      options={companyOptions}
                      placeholder="Select a company"
                      error={!!errors.companyId}
                      errorMessage={errors.companyId?.message}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/tenants')} type="button">Cancel</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Save Changes' : 'Create Tenant'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Save Changes' : 'Create Tenant'}
        description={isEdit ? `Save changes to "${pendingData?.name}"?` : `Create tenant "${pendingData?.name}"?`}
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
