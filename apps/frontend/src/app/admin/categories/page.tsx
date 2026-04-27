'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Category } from '@core-panel/shared';
import { ConfirmationDialog, Notification } from '@/components';
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
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getCategoriesApi()
      .then(setCategories)
      .catch((error) => {
        setSnackbar({ open: true, message: getErrorMessage(error, 'Kategoriler yüklenemedi'), severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await createCategoryApi({ name });
      setNewName('');
      setSnackbar({ open: true, message: 'Kategori eklendi', severity: 'success' });
      load();
    } catch (error) {
      setSnackbar({ open: true, message: getErrorMessage(error, 'Kategori eklenemedi'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await updateCategoryApi(editingId, { name });
      cancelEdit();
      setSnackbar({ open: true, message: 'Kategori güncellendi', severity: 'success' });
      load();
    } catch (error) {
      setSnackbar({ open: true, message: getErrorMessage(error, 'Kategori güncellenemedi'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteCategoryApi(deleteTarget.id);
      setDeleteTarget(null);
      setSnackbar({ open: true, message: 'Kategori silindi', severity: 'success' });
      load();
    } catch (error) {
      setSnackbar({ open: true, message: getErrorMessage(error, 'Kategori silinemedi'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} color="#111827" sx={{ mb: 0.5 }}>
        Kategoriler
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {categories.length} kayıt
      </Typography>

      <Paper variant="outlined" sx={{ maxWidth: 720, borderRadius: '4px', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', gap: 1.5, p: 2, alignItems: 'flex-end' }}>
          <FormInput
            label="Kategori adı"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleAdd();
            }}
          />
          <FormButton variant="primary" size="md" onClick={handleAdd} loading={saving} sx={{ mb: 0.2 }}>
            Ekle
          </FormButton>
        </Box>
        <Divider />

        {loading ? (
          <Box sx={{ p: 3, color: '#6B7280', fontSize: 14 }}>Loading...</Box>
        ) : categories.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">Henüz kategori yok</Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {categories.map((category) => {
              const isEditing = editingId === category.id;
              return (
                <Box
                  key={category.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <FormInput
                        label="Kategori adı"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void handleUpdate();
                          if (event.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <Typography sx={{ fontWeight: 600, color: '#1F2937', fontSize: 14 }}>
                        {category.name}
                      </Typography>
                    )}
                  </Box>
                  {isEditing ? (
                    <>
                      <Tooltip title="Kaydet">
                        <IconButton onClick={handleUpdate} disabled={saving} size="small" color="primary">
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Vazgeç">
                        <IconButton onClick={cancelEdit} disabled={saving} size="small">
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip title="Düzenle">
                        <IconButton onClick={() => startEdit(category)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <IconButton onClick={() => setDeleteTarget(category)} size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Kategori Sil"
        description={`"${deleteTarget?.name}" kategorisini silmek istediğinize emin misiniz?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={saving}
        confirmLabel="Sil"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} />
    </Box>
  );
}
