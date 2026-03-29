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
  name: z.string().min(1, 'Ad zorunludur').max(255),
  companyId: z.string().optional(),
});

const superAdminSchema = z.object({
  name: z.string().min(1, 'Ad zorunludur').max(255),
  companyId: z.string().min(1, 'Şirket zorunludur'),
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
        setSnackbar({ open: true, message: 'Taşeron başarıyla güncellendi', severity: 'success' });
      } else {
        await createTenantApi(payload);
        setSnackbar({ open: true, message: 'Taşeron başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push('/admin/tenants'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'İşlem başarısız') : 'İşlem başarısız';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  const companyOptions = companies.map((c) => ({ label: c.name, value: c.id }));

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/tenants')}>Geri</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Taşeron Düzenle' : 'Yeni Taşeron'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Taşeron bilgilerini güncelle' : 'Yeni taşeron oluştur'}</Typography>

      <Card sx={{ p: 4, maxWidth: 520 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="Taşeron Adı" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              {!isCompanyAdmin && (
                <Controller
                  name="companyId"
                  control={control}
                  render={({ field }) => (
                    <FormSelect
                      label="Şirket"
                      options={companyOptions}
                      placeholder="Şirket seçin"
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
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/tenants')} type="button">İptal</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Değişiklikleri Kaydet' : 'Taşeron Oluştur'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'Taşeron Oluştur'}
        description={isEdit ? `"${pendingData?.name}" taşeronundaki değişiklikleri kaydetmek istiyor musunuz?` : `"${pendingData?.name}" taşeronunu oluşturmak istiyor musunuz?`}
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
