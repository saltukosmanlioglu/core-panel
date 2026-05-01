'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { ConfirmationDialog, Notification } from '@/components';
import { CrudModal } from '@/components/crud-modal';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { getProjectsApi, deleteProjectApi, createProjectApi, updateProjectApi } from '@/services/workspace/api';
import type { Project } from '@core-panel/shared';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';

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
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const fetchProjects = () => {
    setLoading(true);
    getProjectsApi()
      .then(setProjects)
      .catch((err: unknown) => showError(getErrorMessage(err, 'Yüklenemedi')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

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
        showSuccess('Proje güncellendi');
      } else {
        await createProjectApi(formData);
        showSuccess('Proje eklendi');
      }
      handleClose();
      fetchProjects();
    } catch {
      showError('Bir hata oluştu');
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
      showSuccess('Proje silindi');
    } catch {
      showError('Silinemedi');
    }
  };

  return (
    <Box>
      <PageHeader title="İnşaatlar" subtitle={`${projects.length} kayıt`} addLabel="İnşaat Ekle" onAdd={openCreate} />

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

        <CrudModal
          open={modalOpen}
          title={editingProject ? 'İnşaat Düzenle' : 'Yeni İnşaat Ekle'}
          saving={saving}
          saveDisabled={!formData.name.trim()}
          onClose={handleClose}
          onSave={handleSave}
        >
          <TextField
            label="İnşaat Adı"
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
        </CrudModal>

        <ConfirmationDialog
          open={!!deleteId}
          title="İnşaat Sil"
          description="Bu inşaatı silmek istediğinizden emin misiniz? İnşaata ait tüm ihaleler de silinecektir."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          confirmLabel="Sil"
        />
        <Notification {...notificationProps} />
    </Box>
  );
}
