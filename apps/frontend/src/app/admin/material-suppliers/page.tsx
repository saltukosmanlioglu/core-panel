'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Button, CircularProgress, Chip, Autocomplete, TextField } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton, FormInput } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import {
  deleteMaterialSupplierApi,
  getMaterialSuppliersApi,
  createMaterialSupplierApi,
  updateMaterialSupplierApi,
  type MaterialSupplier,
} from '@/services/material-suppliers/api';
import { getCategoriesApi, getSupplierCategoriesApi, updateSupplierCategoriesApi } from '@/services/categories/api';
import type { Category } from '@core-panel/shared';
import axios from 'axios';

interface SupplierWithCategories extends MaterialSupplier {
  categoryIds?: string[];
}

interface SupplierFormData {
  name: string;
  contactName: string;
  contactPhone: string;
  categoryIds: string[];
}

export default function MaterialSuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithCategories[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<MaterialSupplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({ name: '', contactName: '', contactPhone: '', categoryIds: [] });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    Promise.all([getMaterialSuppliersApi(), getCategoriesApi()])
      .then(([suppliersRes, catsRes]) => {
        setSuppliers(suppliersRes);
        setCategories(catsRes);
      })
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err) ? ((err.response?.data as any)?.error ?? 'Yüklenemedi') : 'Yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingSupplier(null);
    setFormData({ name: '', contactName: '', contactPhone: '', categoryIds: [] });
    setModalOpen(true);
  };

  const openEdit = async (supplier: MaterialSupplier) => {
    setEditingSupplier(supplier);
    try {
      const catIds = await getSupplierCategoriesApi(supplier.id);
      setFormData({
        name: supplier.name,
        contactName: supplier.contactName ?? '',
        contactPhone: supplier.contactPhone ?? '',
        categoryIds: catIds,
      });
      setModalOpen(true);
    } catch {
      setSnackbar({ open: true, message: 'Kategori bilgileri alınamadı', severity: 'error' });
    }
  };

  const handleClose = () => { if (!saving) setModalOpen(false); };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      let supplierId: string;
      const payload = {
        name: formData.name,
        contactName: formData.contactName || undefined,
        contactPhone: formData.contactPhone || undefined,
      };
      if (editingSupplier) {
        await updateMaterialSupplierApi(editingSupplier.id, payload);
        supplierId = editingSupplier.id;
      } else {
        const res = await createMaterialSupplierApi(payload);
        supplierId = res.id;
      }
      await updateSupplierCategoriesApi(supplierId, formData.categoryIds);
      handleClose();
      load();
      setSnackbar({ open: true, message: editingSupplier ? 'Malzemeci güncellendi' : 'Malzemeci eklendi', severity: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Bir hata oluştu';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMaterialSupplierApi(deleteId);
      setSnackbar({ open: true, message: 'Malzemeci silindi', severity: 'success' });
      setDeleteId(null);
      load();
    } catch {
      setSnackbar({ open: true, message: 'Silme işlemi başarısız', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#111827">Malzemeciler</Typography>
          <Typography variant="body2" color="text.secondary">{suppliers.length} kayıt</Typography>
        </Box>
        <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={openCreate}>
          Yeni Malzemeci
        </FormButton>
      </Box>

      <DataTable<SupplierWithCategories>
        rows={suppliers}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Firma Adı',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name}</Typography>
            ),
          },
          {
            field: 'categoryIds',
            headerName: 'Kategoriler',
            flex: 1,
            renderCell: (row) => {
              const visibleCats = categories.filter(c => (row.categoryIds ?? []).includes(c.id));
              if (!visibleCats.length) return <Typography sx={{ color: '#9CA3AF', fontSize: '13px' }}>—</Typography>;
              return (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {visibleCats.slice(0, 2).map(c => <Chip key={c.id} label={c.name} size="small" sx={{ fontSize: '11px' }} />)}
                  {visibleCats.length > 2 && <Chip label={`+${visibleCats.length - 2}`} size="small" variant="outlined" sx={{ fontSize: '11px' }} />}
                </Box>
              );
            },
          },
          {
            field: 'contactName',
            headerName: 'İlgili Kişi',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: row.contactName ? '#1F2937' : '#9CA3AF', fontSize: '13px' }}>
                {row.contactName || '—'}
              </Typography>
            ),
          },
          {
            field: 'contactPhone',
            headerName: 'Telefon',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: row.contactPhone ? '#1F2937' : '#9CA3AF', fontSize: '13px' }}>
                {row.contactPhone || '—'}
              </Typography>
            ),
          },
        ]}
        actions={[
          {
            label: 'Düzenle',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => openEdit(row),
            color: 'primary',
          },
          {
            label: 'Sil',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row) => setDeleteId(row.id),
            color: 'error',
          },
        ]}
        emptyMessage="Henüz malzemeci yok"
      />

      <Dialog open={modalOpen} onClose={handleClose} maxWidth="sm" fullWidth disableEscapeKeyDown={saving}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          {editingSupplier ? 'Malzemeci Düzenle' : 'Yeni Malzemeci Ekle'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <FormInput label="Firma Adı" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <FormInput label="İlgili Kişi Adı" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
          <FormInput label="Telefon Numarası" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
          <Autocomplete
            multiple
            options={categories}
            getOptionLabel={(o) => o.name}
            value={categories.filter((c) => formData.categoryIds.includes(c.id))}
            onChange={(_, v) => setFormData({ ...formData, categoryIds: v.map((c) => c.id) })}
            renderInput={(params) => <TextField {...params} label="Kategoriler" placeholder="Kategori seçin..." />}
            isOptionEqualToValue={(o, v) => o.id === v.id}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={handleClose} disabled={saving}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteId}
        title="Malzemeci Sil"
        description="Bu malzemeciyi silmek istediğinize emin misiniz?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Sil"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} />
    </Box>
  );
}
