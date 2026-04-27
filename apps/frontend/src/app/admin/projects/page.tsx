'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getProjectsApi, deleteProjectApi, createProjectApi, updateProjectApi } from '@/services/workspace/api';
import type { Project } from '@core-panel/shared';
import axios from 'axios';

const statusColors: Record<string, { bg: string; color: string }> = {
  active: { bg: '#DCFCE7', color: '#15803D' },
  completed: { bg: '#DBEAFE', color: '#1D4ED8' },
  cancelled: { bg: '#F3F4F6', color: '#6B7280' },
};

interface ProjectFormData {
  name: string;
  description: string;
  status: string;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>({ name: '', description: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchProjects = () => {
    setLoading(true);
    getProjectsApi()
      .then(setProjects)
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Yüklenemedi') : 'Yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const openCreate = () => {
    setEditingProject(null);
    setFormData({ name: '', description: '', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description ?? '',
      status: project.status ?? 'active',
    });
    setModalOpen(true);
  };

  const handleClose = () => {
    if (!saving) {
      setModalOpen(false);
      setEditingProject(null);
      setFormData({ name: '', description: '', status: 'active' });
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingProject) {
        await updateProjectApi(editingProject.id, formData);
        showSnackbar('Proje güncellendi');
      } else {
        await createProjectApi(formData);
        showSnackbar('Proje eklendi');
      }
      handleClose();
      fetchProjects();
    } catch {
      showSnackbar('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProjectApi(deleteId);
      setDeleteId(null);
      fetchProjects();
      showSnackbar('Proje silindi');
    } catch {
      showSnackbar('Silinemedi', 'error');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#111827">İnşaatlar</Typography>
            <Typography variant="body2" color="text.secondary">{projects.length} kayıt</Typography>
          </Box>
          <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={openCreate}>
            İnşaat Ekle
          </FormButton>
        </Box>

        <DataTable<Project>
          rows={projects}
          loading={loading}
          getRowId={(r) => r.id}
          columns={[
            {
              field: 'name', headerName: 'Ad', flex: 1, sortable: true,
              renderCell: (r) => <Typography sx={{ fontWeight: 500, fontSize: '14px', color: '#1F2937' }}>{r.name}</Typography>,
            },
            {
              field: 'description', headerName: 'Açıklama', flex: 2,
              renderCell: (r) => (
                <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>
                  {r.description ? (r.description.length > 50 ? `${r.description.substring(0, 50)}...` : r.description) : '—'}
                </Typography>
              ),
            },
            {
              field: 'status', headerName: 'Durum', width: 130, sortable: true,
              renderCell: (r) => {
                const labelMap: Record<string, string> = { active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal Edildi' };
                return (
                  <Chip 
                    label={labelMap[r.status] || r.status} 
                    size="small"
                    sx={{ ...(statusColors[r.status] ?? statusColors.cancelled), fontWeight: 600, fontSize: '11px' }} 
                  />
                );
              },
            },
            {
              field: 'createdAt', headerName: 'Oluşturulma Tarihi', width: 120, sortable: true,
              renderCell: (r) => <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</Typography>,
            },
          ]}
          actions={[
            { label: 'Düzenle', icon: <EditIcon fontSize="small" />, onClick: (r) => openEdit(r), color: 'primary' },
            { label: 'Sil', icon: <DeleteIcon fontSize="small" />, onClick: (r) => setDeleteId(r.id), color: 'error' },
          ]}
          emptyMessage="Henüz inşaat yok"
        />

        <Dialog open={modalOpen} onClose={handleClose} maxWidth="sm" fullWidth disableEscapeKeyDown={saving}>
          <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
            {editingProject ? 'Proje Düzenle' : 'Yeni Proje Ekle'}
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Proje Adı"
              required
              fullWidth
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              autoFocus
            />
            <TextField
              label="Açıklama"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
            />
            <FormControl fullWidth required>
              <InputLabel>Durum</InputLabel>
              <Select
                value={formData.status}
                label="Durum"
                onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value="active">Aktif</MenuItem>
                <MenuItem value="completed">Tamamlandı</MenuItem>
                <MenuItem value="cancelled">İptal Edildi</MenuItem>
              </Select>
            </FormControl>
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
          title="İnşaat Sil"
          description="Bu projeyi silmek istediğinizden emin misiniz? Projeye ait tüm ihaleler de silinecektir."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          confirmLabel="Sil"
        />
        <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} />
    </Box>
  );
}
