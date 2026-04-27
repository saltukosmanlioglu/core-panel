'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Category } from '@core-panel/shared';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { FormButton, FormInput } from '@/components/form-elements';
import {
  createCategoryApi,
  deleteCategoryApi,
  getCategoriesApi,
  updateCategoryApi,
} from '@/services/categories/api';

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchCategories = () => {
    setLoading(true);
    getCategoriesApi()
      .then(setCategories)
      .catch((error) => {
        showSnackbar(getErrorMessage(error, 'Kategoriler yüklenemedi'), 'error');
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
        showSnackbar('Kategori güncellendi');
      } else {
        await createCategoryApi({ name });
        showSnackbar('Kategori eklendi');
      }
      handleClose();
      fetchCategories();
    } catch (error: any) {
      showSnackbar(getErrorMessage(error, 'Bir hata oluştu'), 'error');
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
      showSnackbar('Kategori silindi');
    } catch {
      showSnackbar('Silinemedi', 'error');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#111827">Kategoriler</Typography>
          <Typography variant="body2" color="text.secondary">{categories.length} kayıt</Typography>
        </Box>
        <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={openCreate}>
          Yeni Kategori
        </FormButton>
      </Box>

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

      <Dialog open={modalOpen} onClose={handleClose} maxWidth="sm" fullWidth disableEscapeKeyDown={saving}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={handleClose} disabled={saving}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteId}
        title="Kategori Sil"
        description="Bu kategoriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Sil"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} />
    </Box>
  );
}
