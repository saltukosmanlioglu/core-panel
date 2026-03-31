'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Card,
  Typography,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { ArrowBack as ArrowBackIcon, CompareArrows as OffersIcon } from '@mui/icons-material';
import { FormInput, FormButton, FormSelect } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { getTenderApi, createTenderApi, updateTenderApi, getProjectsApi } from '@/services/workspace/api';
import { getTenderItemsApi } from '@/services/tender-items/api';
import type { Project } from '@core-panel/shared';
import { TenderItemUnitLabels } from '@core-panel/shared';
import axios from 'axios';

const schema = z.object({
  projectId: z.string().uuid('İnşaat zorunludur'),
  title: z.string().min(1, 'Başlık zorunludur').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface BoqRow {
  _key: string;
  id?: string;
  description: string;
  unit: string;
  quantity: string;
  location: string;
}

const statusOptions = [
  { label: 'Taslak', value: 'draft' },
  { label: 'Açık', value: 'open' },
  { label: 'Kapalı', value: 'closed' },
  { label: 'Verildi', value: 'awarded' },
];

const unitOptions = Object.entries(TenderItemUnitLabels).map(([value, label]) => ({ value, label }));

function newBoqRow(): BoqRow {
  return {
    _key: String(Date.now()) + String(Math.random()),
    description: '',
    unit: '',
    quantity: '',
    location: '',
  };
}

export function TenderForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [boqRows, setBoqRows] = useState<BoqRow[]>([]);
  const [boqErrors, setBoqErrors] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { status: 'draft' },
  });

  useEffect(() => {
    const loads: Promise<void>[] = [getProjectsApi().then(setProjects)];
    if (id) {
      loads.push(
        getTenderApi(id).then((t) =>
          reset({
            projectId: t.projectId,
            title: t.title,
            description: t.description ?? '',
            status: t.status as FormData['status'],
            deadline: t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : '',
          })
        )
      );
      loads.push(
        getTenderItemsApi(id).then((items) => {
          setBoqRows(
            items.map((item) => ({
              _key: item.id,
              id: item.id,
              description: item.description,
              unit: item.unit,
              quantity: String(item.quantity),
              location: item.location ?? '',
            }))
          );
        })
      );
    }
    Promise.all(loads)
      .catch(() => router.replace('/admin/tenders'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  const validateBoq = (): boolean => {
    for (const row of boqRows) {
      if (!row.description.trim()) {
        setBoqErrors('Tüm kalemlerin tanımı girilmelidir.');
        return false;
      }
      if (!row.unit) {
        setBoqErrors('Tüm kalemlerin birimi seçilmelidir.');
        return false;
      }
      const qty = parseFloat(row.quantity);
      if (!row.quantity || isNaN(qty) || qty <= 0) {
        setBoqErrors('Tüm kalemlerin miktarı 0\'dan büyük olmalıdır.');
        return false;
      }
    }
    setBoqErrors(null);
    return true;
  };

  const onSubmit = (data: FormData) => {
    if (!validateBoq()) return;
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setLoading(true);
    try {
      const items = boqRows.map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        description: row.description,
        unit: row.unit,
        quantity: parseFloat(row.quantity),
        ...(row.location ? { location: row.location } : {}),
      }));
      const payload = {
        ...pendingData,
        deadline: pendingData.deadline ? new Date(pendingData.deadline).toISOString() : undefined,
        items,
      };
      if (isEdit && id) {
        await updateTenderApi(id, payload);
        setSnackbar({ open: true, message: 'İhale başarıyla güncellendi', severity: 'success' });
      } else {
        const newTender = await createTenderApi(payload);
        setSnackbar({ open: true, message: 'İhale başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push(`/admin/tenders/${newTender.id}`), 1200);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'İşlem başarısız') : 'İşlem başarısız';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false); setConfirmOpen(false); setPendingData(null);
    }
  };

  const updateBoqRow = (key: string, field: keyof BoqRow, value: string) => {
    setBoqRows((prev) => prev.map((r) => r._key === key ? { ...r, [field]: value } : r));
  };

  const removeBoqRow = (key: string) => {
    setBoqRows((prev) => prev.filter((r) => r._key !== key));
  };

  const projectOptions = projects.map((p) => ({ label: p.name, value: p.id }));

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton variant="ghost" size="sm" startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} onClick={() => router.push('/admin/tenders')}>Geri</FormButton>
        {isEdit && id && (
          <FormButton variant="secondary" size="sm" startIcon={<OffersIcon sx={{ fontSize: 16 }} />} onClick={() => router.push(`/admin/tenders/${id}/offers`)}>Teklifler</FormButton>
        )}
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{isEdit ? 'İhale Düzenle' : 'Yeni İhale'}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>{isEdit ? 'İhale bilgilerini güncelle' : 'Yeni ihale oluştur ve bir inşaatla ilişkilendir'}</Typography>

      <Card sx={{ p: 4, maxWidth: 640, mb: 4 }}>
        {fetchLoading ? (
          <Box className="flex justify-center py-8">Loading...</Box>
        ) : (
          <form id="tender-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box className="flex flex-col gap-4">
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <FormSelect label="İnşaat" options={projectOptions} error={!!errors.projectId} errorMessage={errors.projectId?.message} value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
              <FormInput label="Başlık" error={!!errors.title} errorMessage={errors.title?.message} {...register('title')} />
              <FormInput label="Açıklama" error={!!errors.description} errorMessage={errors.description?.message} {...register('description')} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormSelect label="Durum" options={statusOptions} error={!!errors.status} errorMessage={errors.status?.message} value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
                <FormInput label="Son Tarih" type="datetime-local" error={!!errors.deadline} errorMessage={errors.deadline?.message} {...register('deadline')} />
              </Box>
            </Box>
          </form>
        )}
      </Card>

      {/* BOQ Table */}
      {!fetchLoading && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Metraj (BOQ)</Typography>
          {boqErrors && (
            <Typography variant="body2" sx={{ color: 'error.main', mb: 1 }}>{boqErrors}</Typography>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700, width: 48 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tanımı</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Birim</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }}>Miktar</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Uygulanacağı Yer</TableCell>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {boqRows.map((row, idx) => (
                  <TableRow key={row._key}>
                    <TableCell sx={{ fontSize: 13, color: '#6B7280' }}>{idx + 1}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.description}
                        onChange={(e) => updateBoqRow(row._key, 'description', e.target.value)}
                        sx={{ '& .MuiInputBase-root': { fontSize: '13px' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={row.unit}
                        onChange={(e) => updateBoqRow(row._key, 'unit', e.target.value)}
                        displayEmpty
                        sx={{ fontSize: '13px', minWidth: 100 }}
                      >
                        <MenuItem value="" disabled><em>Seç</em></MenuItem>
                        {unitOptions.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '13px' }}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateBoqRow(row._key, 'quantity', e.target.value)}
                        inputProps={{ min: 0, step: '0.01' }}
                        sx={{ width: 90, '& .MuiInputBase-root': { fontSize: '13px' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.location}
                        onChange={(e) => updateBoqRow(row._key, 'location', e.target.value)}
                        sx={{ '& .MuiInputBase-root': { fontSize: '13px' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => removeBoqRow(row._key)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {boqRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#6B7280', fontSize: 13 }}>
                      Henüz kalem eklenmedi.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 1 }}>
            <FormButton
              variant="secondary"
              size="sm"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => setBoqRows((prev) => [...prev, newBoqRow()])}
              type="button"
            >
              + Kalem Ekle
            </FormButton>
          </Box>
        </Box>
      )}

      {/* Submit / Cancel */}
      {!fetchLoading && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Box className="flex justify-end gap-2">
            <FormButton variant="secondary" size="md" onClick={() => router.push('/admin/tenders')} type="button">İptal</FormButton>
            <FormButton variant="primary" size="md" type="submit" form="tender-form">{isEdit ? 'Değişiklikleri Kaydet' : 'İhale Oluştur'}</FormButton>
          </Box>
        </Box>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        title={isEdit ? 'Değişiklikleri Kaydet' : 'İhale Oluştur'}
        description={isEdit ? 'Bu ihaledeki değişiklikleri kaydetmek istiyor musunuz?' : `"${pendingData?.title}" ihalesini oluşturmak istiyor musunuz?`}
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
