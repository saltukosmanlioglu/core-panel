'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Chip, Autocomplete, TextField } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormInput } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { CrudModal } from '@/components/crud-modal';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import {
  deleteMaterialSupplierApi,
  getMaterialSuppliersApi,
  createMaterialSupplierApi,
  updateMaterialSupplierApi,
  type MaterialSupplier,
} from '@/services/material-suppliers/api';
import { getCategoriesApi, getSupplierCategoriesApi, getSupplierCategoriesBatchApi, updateSupplierCategoriesApi } from '@/services/categories/api';
import type { Category } from '@core-panel/shared';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';

interface SupplierFormData {
  name: string;
  contactName: string;
  contactPhone: string;
  categoryIds: string[];
}

export default function MaterialSuppliersPage() {
  const [suppliers, setSuppliers] = useState<MaterialSupplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supplierCategoryMap, setSupplierCategoryMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<MaterialSupplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({ name: '', contactName: '', contactPhone: '', categoryIds: [] });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const loadSupplierCategoryMap = async (supplierList: MaterialSupplier[]): Promise<Record<string, string[]>> => {
    if (supplierList.length === 0) return {};
    return getSupplierCategoriesBatchApi(supplierList.map((s) => s.id));
  };

  const load = async () => {
    setLoading(true);
    try {
      const [suppliersRes, catsRes] = await Promise.all([getMaterialSuppliersApi(), getCategoriesApi()]);
      const categoryMap = await loadSupplierCategoryMap(suppliersRes);
      setSuppliers(suppliersRes);
      setCategories(catsRes);
      setSupplierCategoryMap(categoryMap);
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Yüklenemedi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
      showError('Kategori bilgileri alınamadı');
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
      void load();
      showSuccess(editingSupplier ? 'Malzemeci güncellendi' : 'Malzemeci eklendi');
    } catch (err: any) {
      showError(err?.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMaterialSupplierApi(deleteId);
      showSuccess('Malzemeci silindi');
      setDeleteId(null);
      void load();
    } catch {
      showError('Silme işlemi başarısız');
    }
  };

  return (
    <Box>
      <PageHeader title="Malzemeciler" subtitle={`${suppliers.length} kayıt`} addLabel="Yeni Malzemeci" onAdd={openCreate} />

      <DataTable<MaterialSupplier>
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
            field: 'categories',
            headerName: 'Kategoriler',
            flex: 1,
            renderCell: (row) => {
              const supplierCatIds = supplierCategoryMap[row.id] ?? [];
              const visibleCats = categories.filter(c => supplierCatIds.includes(c.id));
              return (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {visibleCats.length === 0 && <Typography variant="caption" color="text.secondary">—</Typography>}
                  {visibleCats.slice(0, 2).map(c => <Chip key={c.id} label={c.name} size="small" variant="outlined" sx={{ fontSize: '11px' }} />)}
                  {visibleCats.length > 2 && <Chip label={`+${visibleCats.length - 2}`} size="small" sx={{ fontSize: '11px' }} />}
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

      <CrudModal
        open={modalOpen}
        title={editingSupplier ? 'Malzemeci Düzenle' : 'Yeni Malzemeci Ekle'}
        saving={saving}
        saveDisabled={!formData.name.trim()}
        onClose={handleClose}
        onSave={handleSave}
      >
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
      </CrudModal>

      <ConfirmationDialog
        open={!!deleteId}
        title="Malzemeci Sil"
        description="Bu malzemeciyi silmek istediğinize emin misiniz?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Sil"
      />
      <Notification {...notificationProps} />
    </Box>
  );
}
