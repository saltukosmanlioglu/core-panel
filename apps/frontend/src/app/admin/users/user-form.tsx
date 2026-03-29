'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Card, Typography, Divider, Grid } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { FormInput, FormButton, FormSelect, FormCheckbox } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import {
  getAdminUserApi,
  createAdminUserApi,
  updateAdminUserApi,
  getTenantsApi,
  getCompaniesApi,
} from '@/services/admin/api';
import type { Tenant, Company } from '@core-panel/shared';
import { UserRole } from '@core-panel/shared';
import { useUser } from '@/contexts/UserContext';
import axios from 'axios';

const createSchema = z.object({
  name: z.string().min(1, 'Ad zorunludur'),
  email: z.string().email('Geçersiz e-posta'),
  password: z.string().min(8, 'En az 8 karakter'),
  role: z.string().min(1, 'Rol zorunludur'),
  companyId: z.string().uuid('Invalid company ID').nullable().optional(),
  tenantId: z.string().uuid('Invalid tenant ID').nullable().optional(),
  isActive: z.boolean(),
});

const updateSchema = z.object({
  name: z.string().min(1, 'Ad zorunludur'),
  email: z.string().email('Geçersiz e-posta'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır').optional(),
  role: z.string().min(1, 'Rol zorunludur'),
  companyId: z.string().uuid('Invalid company ID').nullable().optional(),
  tenantId: z.string().uuid('Invalid tenant ID').nullable().optional(),
  isActive: z.boolean(),
});

type CreateData = z.infer<typeof createSchema>;
type UpdateData = z.infer<typeof updateSchema>;
type FormData = CreateData | UpdateData;

const roleOptions = [
  { label: 'Süper Yönetici', value: UserRole.SUPER_ADMIN },
  { label: 'Şirket Yöneticisi', value: UserRole.COMPANY_ADMIN },
  { label: 'Taşeron Yöneticisi', value: UserRole.TENANT_ADMIN },
];

export function UserForm({ id }: { id?: string }) {
  const router = useRouter();
  const { user: loggedInUser } = useUser();
  const isCompanyAdmin = loggedInUser?.role === UserRole.COMPANY_ADMIN;
  const isTenantAdmin = loggedInUser?.role === UserRole.TENANT_ADMIN;
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const schema = isEdit ? updateSchema : createSchema;
  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { isActive: true, role: UserRole.TENANT_ADMIN },
  });
  const watchedRole = watch('role');

  useEffect(() => {
    const loads: Promise<void>[] = [
      getTenantsApi().then(setTenants),
      ...(!isCompanyAdmin ? [getCompaniesApi().then(setCompanies)] : []),
    ];
    if (id) {
      loads.push(
        getAdminUserApi(id).then((u) =>
          reset({ name: u.name ?? '', email: u.email, password: '', role: u.role, companyId: u.companyId ?? null, tenantId: u.tenantId ?? null, isActive: u.isActive })
        )
      );
    }
    Promise.all(loads)
      .catch(() => router.replace('/admin/users'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => { setPendingData(data); setConfirmOpen(true); };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      const isCompanyAdminRole = pendingData.role === UserRole.COMPANY_ADMIN;
      const isSuperAdminRole = pendingData.role === UserRole.SUPER_ADMIN;
      const companyId = (isSuperAdminRole || !isCompanyAdminRole ? null : (pendingData.companyId || null)) as string | null;
      const tenantId = (isSuperAdminRole || isCompanyAdminRole ? null : (pendingData.tenantId || null)) as string | null;
      const payload = { ...pendingData, companyId, tenantId };
      if (isEdit && id) {
        const { password, ...rest } = payload as UpdateData;
        await updateAdminUserApi(id, { ...rest, ...(password ? { password } : {}) });
        setSnackbar({ open: true, message: 'Kullanıcı başarıyla güncellendi', severity: 'success' });
      } else {
        await createAdminUserApi(payload as CreateData);
        setSnackbar({ open: true, message: 'Kullanıcı başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push('/admin/users'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'İşlem başarısız') : 'İşlem başarısız';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  const tenantOptions = tenants.map((t) => ({ label: t.name, value: t.id }));
  const companyOptions = companies.map((c) => ({ label: c.name, value: c.id }));
  const availableRoleOptions = isTenantAdmin
    ? roleOptions.filter((r) => r.value === UserRole.TENANT_ADMIN)
    : isCompanyAdmin
    ? roleOptions.filter((r) => r.value === UserRole.TENANT_ADMIN)
    : roleOptions;

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/users')}>Geri</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Kullanıcı bilgilerini güncelle' : 'Auth0 ve veritabanında yeni kullanıcı oluştur'}</Typography>

      <Card sx={{ p: 4, maxWidth: 640 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="Ad Soyad" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              <FormInput label="E-posta Adresi" type="email" error={!!errors.email} errorMessage={errors.email?.message} {...register('email')} />
              <FormInput
                label={isEdit ? 'Yeni Şifre (mevcut şifreyi korumak için boş bırakın)' : 'Şifre'}
                password
                error={!!errors.password}
                errorMessage={errors.password?.message}
                {...register('password', { setValueAs: (v: string) => v === '' ? undefined : v })}
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: watchedRole === UserRole.SUPER_ADMIN || isTenantAdmin ? '1fr' : '1fr 1fr', gap: 2 }}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <FormSelect label="Rol" options={availableRoleOptions} error={!!errors.role} errorMessage={errors.role?.message} value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
                {!isTenantAdmin && watchedRole === UserRole.COMPANY_ADMIN && (
                  <Controller
                    name="companyId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect label="Şirket" options={companyOptions} error={!!errors.companyId} errorMessage={errors.companyId?.message} value={field.value ?? ''} onChange={field.onChange} />
                    )}
                  />
                )}
                {!isTenantAdmin && watchedRole !== UserRole.SUPER_ADMIN && watchedRole !== UserRole.COMPANY_ADMIN && (
                  <Controller
                    name="tenantId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect label="Taşeron" options={tenantOptions} error={!!errors.tenantId} errorMessage={errors.tenantId?.message} value={field.value ?? ''} onChange={field.onChange} />
                    )}
                  />
                )}
              </Box>

              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormCheckbox label="Aktif hesap" checked={field.value} onChange={(_, checked) => field.onChange(checked)} />
                )}
              />

              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/users')} type="button">İptal</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Değişiklikleri Kaydet' : 'Kullanıcı Oluştur'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'Kullanıcı Oluştur'}
        description={isEdit ? `Bu kullanıcıyı kaydetmek istediğinize emin misiniz?` : `"${(pendingData as CreateData)?.email}" kullanıcısını oluşturmak istiyor musunuz?`}
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
