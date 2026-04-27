'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Card, Typography, Divider } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import type { Category } from '@core-panel/shared';
import { FormInput, FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import {
  getCategoriesApi,
  getSupplierCategoriesApi,
  updateSupplierCategoriesApi,
} from '@/services/categories/api';
import {
  createMaterialSupplierApi,
  getMaterialSupplierApi,
  updateMaterialSupplierApi,
} from '@/services/material-suppliers/api';
import axios from 'axios';

const schema = z.object({
  name: z.string().min(1, 'Firma adı zorunludur').max(255),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
});

type FormData = z.infer<typeof schema>;

export function MaterialSupplierForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const loads: Promise<unknown>[] = [getCategoriesApi().then(setCategories)];

    if (id) {
      loads.push(
        getMaterialSupplierApi(id).then((supplier) => reset({
          name: supplier.name,
          contactName: supplier.contactName ?? '',
          contactPhone: supplier.contactPhone ?? '',
        })),
        getSupplierCategoriesApi(id).then(setSelectedCategoryIds),
      );
    }

    Promise.all(loads)
      .catch(() => router.replace('/admin/material-suppliers'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const onSubmit = (data: FormData) => { setPendingData(data); setConfirmOpen(true); };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      let supplierId = id;
      if (isEdit && id) {
        await updateMaterialSupplierApi(id, pendingData);
      } else {
        const supplier = await createMaterialSupplierApi(pendingData);
        supplierId = supplier.id;
      }
      if (supplierId) {
        await updateSupplierCategoriesApi(supplierId, selectedCategoryIds);
      }
      router.refresh();
      router.push('/admin/material-suppliers');
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
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/material-suppliers')}>Geri</FormButton>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'Malzemeci Düzenle' : 'Yeni Malzemeci'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'Malzemeci bilgilerini güncelle' : 'Yeni malzemeci oluştur'}</Typography>

      <Card sx={{ p: 4, maxWidth: 520 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <FormInput label="Firma Adı" error={!!errors.name} errorMessage={errors.name?.message} {...register('name')} />
              <FormInput label="İlgili Kişi Adı" error={!!errors.contactName} errorMessage={errors.contactName?.message} {...register('contactName')} />
              <FormInput label="Telefon Numarası" type="tel" error={!!errors.contactPhone} errorMessage={errors.contactPhone?.message} {...register('contactPhone')} />
              <Autocomplete
                multiple
                options={categories}
                getOptionLabel={(option) => option.name}
                value={categories.filter((category) => selectedCategoryIds.includes(category.id))}
                onChange={(_, newValue) => setSelectedCategoryIds(newValue.map((category) => category.id))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip label={option.name} {...getTagProps({ index })} size="small" />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Kategoriler" placeholder="Kategori seçin..." />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
              <Divider sx={{ my: 1 }} />
              <Box className="flex justify-end gap-2">
                <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/material-suppliers')} type="button">İptal</FormButton>
                <FormButton variant="primary" size="md" type="submit">{isEdit ? 'Değişiklikleri Kaydet' : 'Malzemeci Oluştur'}</FormButton>
              </Box>
            </Box>
          </form>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'Malzemeci Oluştur'}
        description={isEdit ? `"${pendingData?.name}" malzemecisindeki değişiklikleri kaydetmek istiyor musunuz?` : `"${pendingData?.name}" malzemecisini oluşturmak istiyor musunuz?`}
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
