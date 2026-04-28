'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
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
  status: z.enum(['draft', 'open', 'closed', 'awarded']),
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

const UNIT_OPTIONS = [
  { value: 'm2', label: 'm² (Metrekare)' },
  { value: 'm3', label: 'm³ (Metreküp)' },
  { value: 'mt', label: 'Metretül' },
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'ton', label: 'Ton' },
  { value: 'm', label: 'Metre (m)' },
  { value: 'lt', label: 'Litre (lt)' },
];

const statusOptions = [
  { label: 'Taslak', value: 'draft' },
  { label: 'Açık', value: 'open' },
  { label: 'Kapalı', value: 'closed' },
];

const emptyItemDraft: ItemRow = {
  tempId: '',
  posNo: '',
  description: '',
  unit: '',
  quantity: '',
  location: '',
};

export function TenderForm({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemRow>(emptyItemDraft);
  const [itemDialogError, setItemDialogError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

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

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const updateItemDraft = (field: keyof ItemRow, value: string) => {
    setItemDraft((current) => ({ ...current, [field]: value }));
  };

  const openAddItemDialog = () => {
    setEditingItemId(null);
    setItemDraft({ ...emptyItemDraft, tempId: Math.random().toString(36).slice(2) });
    setItemDialogError('');
    setItemDialogOpen(true);
  };

  const openEditItemDialog = (item: ItemRow) => {
    setEditingItemId(item.tempId);
    setItemDraft({ ...item });
    setItemDialogError('');
    setItemDialogOpen(true);
  };

  const closeItemDialog = () => {
    setItemDialogOpen(false);
    setEditingItemId(null);
    setItemDraft(emptyItemDraft);
    setItemDialogError('');
  };

  const getSingleItemValidationMessage = (item: ItemRow) => {
    const quantity = Number(item.quantity);

    if (!item.description.trim()) {
      return 'Açıklama zorunludur';
    }

    if (!item.unit.trim()) {
      return 'Birim zorunludur';
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return 'Miktar pozitif olmalıdır';
    }

    return null;
  };

  const saveItemDraft = () => {
    const itemError = getSingleItemValidationMessage(itemDraft);

    if (itemError) {
      setItemDialogError(itemError);
      return;
    }

    const nextItem = {
      ...itemDraft,
      posNo: itemDraft.posNo.trim(),
      description: itemDraft.description.trim(),
      unit: itemDraft.unit.trim(),
      quantity: itemDraft.quantity.trim(),
      location: itemDraft.location.trim(),
    };

    if (editingItemId) {
      setItems((prev) => prev.map((item) => (item.tempId === editingItemId ? nextItem : item)));
    } else {
      setItems((prev) => [...prev, nextItem]);
    }

    closeItemDialog();
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>Yükleniyor...</Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
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
                </Grid>
                <Grid item xs={12} md={6}>
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
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormInput
                    label="Başlık"
                    error={!!errors.title}
                    errorMessage={errors.title?.message}
                    {...register('title')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
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
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormInput
                    label="Son Tarih"
                    type="datetime-local"
                    error={!!errors.deadline}
                    errorMessage={errors.deadline?.message}
                    {...register('deadline')}
                  />
                </Grid>
                <Grid item xs={12} md={6} />
                <Grid item xs={12}>
                  <FormInput
                    label="Açıklama"
                    multiline
                    rows={3}
                    fullWidth
                    error={!!errors.description}
                    errorMessage={errors.description?.message}
                    {...register('description')}
                  />
                </Grid>
              </Grid>
              <Divider sx={{ my: 1 }} />
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      İş Kalemleri
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6B7280' }}>
                      {items.length} kalem
                    </Typography>
                  </Box>
                  <FormButton
                    variant="secondary"
                    size="sm"
                    type="button"
                    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                    onClick={openAddItemDialog}
                  >
                    Kalem Ekle
                  </FormButton>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 48, fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ minWidth: 120, fontWeight: 700 }}>Pos No</TableCell>
                        <TableCell sx={{ minWidth: 220, fontWeight: 700 }}>Tanım</TableCell>
                        <TableCell sx={{ minWidth: 100, fontWeight: 700 }}>Birim</TableCell>
                        <TableCell sx={{ minWidth: 120, fontWeight: 700 }}>Miktar</TableCell>
                        <TableCell sx={{ minWidth: 160, fontWeight: 700 }}>Konum</TableCell>
                        <TableCell align="right" sx={{ width: 96, fontWeight: 700 }}>İşlemler</TableCell>
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
                            <TableCell>{item.posNo || '—'}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{UNIT_OPTIONS.find((option) => option.value === item.unit)?.label ?? item.unit}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.location || '—'}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                color="primary"
                                size="small"
                                aria-label="edit item"
                                onClick={() => openEditItemDialog(item)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
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
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
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

      <Dialog open={itemDialogOpen} onClose={closeItemDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          {editingItemId ? 'Kalem Düzenle' : 'Yeni Kalem'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <FormInput
            label="Pos No"
            value={itemDraft.posNo}
            onChange={(event) => updateItemDraft('posNo', event.target.value)}
          />
          <FormInput
            label="Tanım"
            multiline
            rows={3}
            value={itemDraft.description}
            onChange={(event) => updateItemDraft('description', event.target.value)}
          />
          <FormSelect
            label="Birim"
            options={UNIT_OPTIONS}
            placeholder="Birim seç"
            value={itemDraft.unit}
            onChange={(event) => updateItemDraft('unit', String(event.target.value))}
          />
          <FormInput
            label="Miktar"
            type="number"
            value={itemDraft.quantity}
            inputProps={{ min: 0.001, step: 0.001 }}
            onChange={(event) => updateItemDraft('quantity', event.target.value)}
          />
          <FormInput
            label="Konum"
            value={itemDraft.location}
            onChange={(event) => updateItemDraft('location', event.target.value)}
          />
          {itemDialogError ? (
            <Typography variant="body2" sx={{ color: '#EF4444' }}>
              {itemDialogError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <FormButton variant="secondary" size="sm" type="button" onClick={closeItemDialog}>
            İptal
          </FormButton>
          <FormButton variant="primary" size="sm" type="button" onClick={saveItemDraft}>
            Kaydet
          </FormButton>
        </DialogActions>
      </Dialog>

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
