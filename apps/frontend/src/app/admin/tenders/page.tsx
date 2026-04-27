'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getTendersApi, deleteTenderApi } from '@/services/workspace/api';
import type { Tender } from '@core-panel/shared';
import axios from 'axios';

const statusColors: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#F3F4F6', color: '#6B7280' },
  open: { bg: '#DCFCE7', color: '#15803D' },
  closed: { bg: '#FEF3C7', color: '#92400E' },
  awarded: { bg: '#DBEAFE', color: '#1D4ED8' },
};

export default function AdminTendersPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Tender | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getTendersApi()
      .then(setTenders)
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
      await deleteTenderApi(deleteTarget.id);
      setSnackbar({ open: true, message: `"${deleteTarget.title}" silindi`, severity: 'success' });
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
            <Typography variant="h5" fontWeight={700} color="#111827">İhaleler</Typography>
            <Typography variant="body2" color="text.secondary">{tenders.length} kayıt</Typography>
          </Box>
          <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/admin/tenders/create')}>
            İhale Ekle
          </FormButton>
        </Box>

        <DataTable<Tender>
          rows={tenders}
          loading={loading}
          getRowId={(r) => r.id}
          columns={[
            {
              field: 'title', headerName: 'Başlık', flex: 1, sortable: true,
              renderCell: (r) => <Typography sx={{ fontWeight: 500, fontSize: '14px', color: '#1F2937' }}>{r.title}</Typography>,
            },
            {
              field: 'projectName', headerName: 'İnşaat', flex: 1, sortable: true,
              renderCell: (r) => <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{r.projectName ?? '—'}</Typography>,
            },
            {
              field: 'status', headerName: 'Durum', width: 120, sortable: true,
              renderCell: (r) => (
                <Chip label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} size="small"
                  sx={{ ...(statusColors[r.status] ?? statusColors.draft), fontWeight: 600, fontSize: '11px' }} />
              ),
            },
            {
              field: 'deadline', headerName: 'Son Tarih', width: 120, sortable: true,
              renderCell: (r) => <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{r.deadline ? new Date(r.deadline).toLocaleDateString() : '—'}</Typography>,
            },
          ]}
          actions={[
            { label: 'Düzenle', icon: <EditIcon fontSize="small" />, onClick: (r) => router.push(`/admin/tenders/${r.id}/edit`), color: 'primary' },
            { label: 'Sil', icon: <DeleteIcon fontSize="small" />, onClick: (r) => setDeleteTarget(r), color: 'error' },
          ]}
          emptyMessage="Henüz ihale yok"
        />

        <ConfirmationDialog
          open={!!deleteTarget}
          title="İhale Sil"
          description={`"${deleteTarget?.title}" ihalesini silmek istediğinize emin misiniz?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
          confirmLabel="Sil"
        />
        <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
