'use client';

import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Category } from '@core-panel/shared';
import { ConfirmationDialog, Notification } from '@/components';
import { CrudModal } from '@/components/crud-modal';
import { DataTable } from '@/components/data-table';
import { FormInput } from '@/components/form-elements';
import { PageHeader } from '@/components/page-header';
import {
  createCategoryApi,
  deleteCategoryApi,
  getCategoriesApi,
  updateCategoryApi,
} from '@/services/categories/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const fetchCategories = () => {
    setLoading(true);
    getCategoriesApi()
      .then(setCategories)
      .catch((error) => {
        showError(getErrorMessage(error, 'Kategoriler yüklenemedi'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const openCreate = () => { setEditingCategory(null); setName(''); setModalOpen(true); };
  const openEdit = (cat: Category) => { setEditingCategory(cat); setName(cat.name); setModalOpen(true); };
  const handleClose = () => { if (!saving) { setModalOpen(false); setEditingCategory(null); setName(''); } };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategoryApi(editingCategory.id, { name });
        showSuccess('Kategori güncellendi');
      } else {
        await createCategoryApi({ name });
        showSuccess('Kategori eklendi');
      }
      handleClose();
      fetchCategories();
    } catch (error: any) {
      showError(getErrorMessage(error, 'Bir hata oluştu'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCategoryApi(deleteId);
      setDeleteId(null);
      fetchCategories();
      showSuccess('Kategori silindi');
    } catch {
      showError('Silinemedi');
    }
  };

  return (
    <Box>
      <PageHeader title="Kategoriler" subtitle={`${categories.length} kayıt`} addLabel="Yeni Kategori" onAdd={openCreate} />

      <DataTable<Category>
        rows={categories}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Kategori Adı',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name}</Typography>
            ),
          },
          {
            field: 'createdAt',
            headerName: 'Oluşturulma Tarihi',
            width: 180,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>
                {row.createdAt ? new Date(row.createdAt).toLocaleDateString('tr-TR') : '—'}
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
        emptyMessage="Henüz kategori yok"
      />

      <CrudModal
        open={modalOpen}
        title={editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
        saving={saving}
        saveDisabled={!name.trim()}
        onClose={handleClose}
        onSave={handleSave}
      >
        <FormInput
          label="Kategori Adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) void handleSave();
          }}
        />
      </CrudModal>

      <ConfirmationDialog
        open={!!deleteId}
        title="Kategori Sil"
        description="Bu kategoriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Sil"
      />
      <Notification {...notificationProps} />
    </Box>
  );
}
