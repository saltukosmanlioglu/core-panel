'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Card,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { FormInput, FormButton, FormSelect } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { getCategoriesApi } from '@/services/categories/api';
import { getTenderItemsApi, replaceTenderItemsApi, type TenderItemPayload } from '@/services/tender-items/api';
import { getTenderApi, createTenderApi, updateTenderApi, getProjectsApi } from '@/services/workspace/api';
import type { Category, Project } from '@core-panel/shared';
import axios from 'axios';

const schema = z.object({
  projectId: z.string().uuid('İnşaat zorunludur'),
  categoryId: z.string().uuid('Kategori zorunludur'),
  title: z.string().min(1, 'Başlık zorunludur').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed']),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ItemRow {
  tempId: string;
  posNo: string;
  description: string;
  unit: string;
  quantity: string;
  location: string;
}

const statusOptions = [
  { label: 'Taslak', value: 'draft' },
  { label: 'Açık', value: 'open' },
  { label: 'Kapalı', value: 'closed' },
];

export function TenderForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const descriptionRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { status: 'draft' },
  });

  useEffect(() => {
    const loads: Promise<unknown>[] = [
      getProjectsApi().then(setProjects),
      getCategoriesApi().then(setCategories),
    ];

    if (id) {
      loads.push(
        getTenderApi(id).then((tender) => {
          reset({
            projectId: tender.projectId,
            categoryId: tender.categoryId ?? '',
            title: tender.title,
            description: tender.description ?? '',
            status: tender.status as FormData['status'],
            deadline: tender.deadline ? new Date(tender.deadline).toISOString().slice(0, 16) : '',
          });
        }),
        getTenderItemsApi(id).then((loadedItems) => {
          setItems(
            loadedItems.map((item) => ({
              tempId: item.id,
              posNo: item.posNo ?? '',
              description: item.description,
              unit: item.unit,
              quantity: String(item.quantity),
              location: item.location ?? '',
            })),
          );
        }),
      );
    }

    Promise.all(loads)
      .catch(() => router.replace('/admin/tenders'))
      .finally(() => setFetchLoading(false));
  }, [id, reset, router]);

  useEffect(() => {
    if (!focusItemId) {
      return;
    }

    descriptionRefs.current[focusItemId]?.focus();
    setFocusItemId(null);
  }, [focusItemId, items.length]);

  const addItem = () => {
    const tempId = Math.random().toString(36).slice(2);
    setItems((prev) => [
      ...prev,
      {
        tempId,
        posNo: '',
        description: '',
        unit: '',
        quantity: '',
        location: '',
      },
    ]);
    setFocusItemId(tempId);
  };

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
    delete descriptionRefs.current[tempId];
  };

  const updateItem = (tempId: string, field: keyof ItemRow, value: string) => {
    setItems((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item)));
  };

  const getItemValidationMessage = () => {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]!;
      const rowNumber = index + 1;
      const quantity = Number(item.quantity);

      if (!item.description.trim()) {
        return `${rowNumber}. kalemde açıklama zorunludur`;
      }

      if (!item.unit.trim()) {
        return `${rowNumber}. kalemde birim zorunludur`;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `${rowNumber}. kalemde miktar pozitif olmalıdır`;
      }
    }

    return null;
  };

  const buildItemPayload = (): TenderItemPayload[] =>
    items.map((item) => ({
      posNo: item.posNo.trim() || undefined,
      description: item.description.trim(),
      unit: item.unit.trim(),
      quantity: Number(item.quantity),
      location: item.location.trim() || undefined,
    }));

  const onSubmit = (data: FormData) => {
    const itemError = getItemValidationMessage();

    if (itemError) {
      setSnackbar({ open: true, message: itemError, severity: 'error' });
      return;
    }

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
        const tender = await updateTenderApi(id, payload);
        await replaceTenderItemsApi(tender.id, buildItemPayload());
        setSnackbar({ open: true, message: 'İhale başarıyla güncellendi', severity: 'success' });
        setTimeout(() => router.push('/admin/tenders'), 800);
      } else {
        const tender = await createTenderApi(payload);
        await replaceTenderItemsApi(tender.id, buildItemPayload());
        setSnackbar({ open: true, message: 'İhale başarıyla oluşturuldu', severity: 'success' });
        setTimeout(() => router.push('/admin/tenders'), 800);
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

  const categoryOptions = [
    { label: 'Kategori seç', value: '' },
    ...categories.map((category) => ({
      label: category.name,
      value: category.id,
    })),
  ];

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

      <Card sx={{ p: 4, maxWidth: 1100 }}>
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
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Kategori"
                    options={categoryOptions}
                    error={!!errors.categoryId}
                    errorMessage={errors.categoryId?.message}
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
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  İş Kalemleri
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 48, fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ minWidth: 120, fontWeight: 700 }}>Pos No</TableCell>
                        <TableCell sx={{ minWidth: 220, fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ minWidth: 100, fontWeight: 700 }}>Unit</TableCell>
                        <TableCell sx={{ minWidth: 120, fontWeight: 700 }}>Quantity</TableCell>
                        <TableCell sx={{ minWidth: 160, fontWeight: 700 }}>Location</TableCell>
                        <TableCell sx={{ width: 56 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography variant="body2" sx={{ color: '#6B7280', py: 1 }}>
                              Henüz iş kalemi eklenmedi.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item, index) => (
                          <TableRow key={item.tempId}>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: '#6B7280', fontWeight: 600 }}>
                                {index + 1}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                fullWidth
                                value={item.posNo}
                                onChange={(event) => updateItem(item.tempId, 'posNo', event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                fullWidth
                                required
                                value={item.description}
                                inputRef={(element) => {
                                  descriptionRefs.current[item.tempId] = element;
                                }}
                                onChange={(event) => updateItem(item.tempId, 'description', event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                fullWidth
                                required
                                value={item.unit}
                                onChange={(event) => updateItem(item.tempId, 'unit', event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                fullWidth
                                required
                                type="number"
                                inputProps={{ min: 0.001, step: 0.001 }}
                                value={item.quantity}
                                onChange={(event) => updateItem(item.tempId, 'quantity', event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                fullWidth
                                value={item.location}
                                onChange={(event) => updateItem(item.tempId, 'location', event.target.value)}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                color="error"
                                size="small"
                                aria-label="remove item"
                                onClick={() => removeItem(item.tempId)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <FormButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                  onClick={addItem}
                  sx={{ mt: 2 }}
                >
                  Add Item
                </FormButton>
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
