'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
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
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.string().min(1, 'Role is required'),
  companyId: z.string().uuid('Invalid company ID').nullable().optional(),
  tenantId: z.string().uuid('Invalid tenant ID').nullable().optional(),
  isActive: z.boolean(),
});

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.string().min(1, 'Role is required'),
  companyId: z.string().uuid('Invalid company ID').nullable().optional(),
  tenantId: z.string().uuid('Invalid tenant ID').nullable().optional(),
  isActive: z.boolean(),
});

type CreateData = z.infer<typeof createSchema>;
type UpdateData = z.infer<typeof updateSchema>;
type FormData = CreateData | UpdateData;

const roleOptions = [
  { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
  { label: 'Company Admin', value: UserRole.COMPANY_ADMIN },
  { label: 'Tenant Admin', value: UserRole.TENANT_ADMIN },
  { label: 'User', value: UserRole.USER },
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
    resolver: zodResolver(schema),
    defaultValues: { isActive: true, role: UserRole.USER },
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
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
      } else {
        await createAdminUserApi(payload as CreateData);
        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
        setTimeout(() => router.push('/admin/users'), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Operation failed') : 'Operation failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  const tenantOptions = tenants.map((t) => ({ label: t.name, value: t.id }));
  const companyOptions = companies.map((c) => ({ label: c.name, value: c.id }));
  const availableRoleOptions = isTenantAdmin
    ? roleOptions.filter((r) => r.value === UserRole.USER)
    : isCompanyAdmin
    ? roleOptions.filter((r) => r.value === UserRole.TENANT_ADMIN || r.value === UserRole.USER)
    : roleOptions;

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/users')}>Back</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Edit User' : 'New User'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Update user details' : 'Create a new user in Auth0 and the database'}</Typography>

      <Card sx={{ p: 4, maxWidth: 640 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="Full Name" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              <FormInput label="Email Address" type="email" error={!!errors.email} errorMessage={errors.email?.message} {...register('email')} />
              <FormInput
                label={isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
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
                    <FormSelect label="Role" options={availableRoleOptions} error={!!errors.role} errorMessage={errors.role?.message} value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
                {!isTenantAdmin && watchedRole === UserRole.COMPANY_ADMIN && (
                  <Controller
                    name="companyId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect label="Company" options={companyOptions} error={!!errors.companyId} errorMessage={errors.companyId?.message} value={field.value ?? ''} onChange={field.onChange} />
                    )}
                  />
                )}
                {!isTenantAdmin && watchedRole !== UserRole.SUPER_ADMIN && watchedRole !== UserRole.COMPANY_ADMIN && (
                  <Controller
                    name="tenantId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect label="Tenant" options={tenantOptions} error={!!errors.tenantId} errorMessage={errors.tenantId?.message} value={field.value ?? ''} onChange={field.onChange} />
                    )}
                  />
                )}
              </Box>

              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormCheckbox label="Active account" checked={field.value} onChange={(_, checked) => field.onChange(checked)} />
                )}
              />

              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/users')} type="button">Cancel</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Save Changes' : 'Create User'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Save Changes' : 'Create User'}
        description={isEdit ? `Save changes to this user?` : `Create user "${(pendingData as CreateData)?.email}"?`}
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
