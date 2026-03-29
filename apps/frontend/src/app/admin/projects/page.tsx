'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getProjectsApi, deleteProjectApi } from '@/services/dashboard/api';
import type { Project } from '@core-panel/shared';
import axios from 'axios';

const statusColors: Record<string, { bg: string; color: string }> = {
  active: { bg: '#DCFCE7', color: '#15803D' },
  inactive: { bg: '#F3F4F6', color: '#6B7280' },
  completed: { bg: '#DBEAFE', color: '#1D4ED8' },
};

export default function AdminProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getProjectsApi()
      .then(setProjects)
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Yüklenemedi') : 'Yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProjectApi(deleteTarget.id);
      setSnackbar({ open: true, message: `"${deleteTarget.name}" silindi`, severity: 'success' });
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Silinemedi') : 'Silinemedi';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#111827">İnşaatlar</Typography>
            <Typography variant="body2" color="text.secondary">{projects.length} kayıt</Typography>
          </Box>
          <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/admin/projects/create')}>
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
              renderCell: (r) => <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{r.description ?? '—'}</Typography>,
            },
            {
              field: 'status', headerName: 'Durum', width: 130, sortable: true,
              renderCell: (r) => (
                <Chip label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} size="small"
                  sx={{ ...(statusColors[r.status] ?? statusColors.active), fontWeight: 600, fontSize: '11px' }} />
              ),
            },
            {
              field: 'createdAt', headerName: 'Oluşturulma Tarihi', width: 120, sortable: true,
              renderCell: (r) => <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{new Date(r.createdAt).toLocaleDateString()}</Typography>,
            },
          ]}
          actions={[
            { label: 'Düzenle', icon: <EditIcon fontSize="small" />, onClick: (r) => router.push(`/admin/projects/${r.id}`), color: 'primary' },
            { label: 'Sil', icon: <DeleteIcon fontSize="small" />, onClick: (r) => setDeleteTarget(r), color: 'error' },
          ]}
          emptyMessage="Henüz inşaat yok"
        />

        <ConfirmationDialog
          open={!!deleteTarget}
          title="İnşaat Sil"
          description={`"${deleteTarget?.name}" inşaatını silmek istediğinize emin misiniz? İlişkili tüm ihaleler de silinecektir.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
          confirmLabel="Sil"
        />
        <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
