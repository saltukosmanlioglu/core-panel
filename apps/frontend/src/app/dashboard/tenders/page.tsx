'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { getTendersApi, deleteTenderApi } from '@/services/dashboard/api';
import type { Tender } from '@core-panel/shared';
import axios from 'axios';

const statusColors: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#F3F4F6', color: '#6B7280' },
  open: { bg: '#DCFCE7', color: '#15803D' },
  closed: { bg: '#FEF3C7', color: '#92400E' },
  awarded: { bg: '#DBEAFE', color: '#1D4ED8' },
};

export default function TendersPage() {
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
        const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Failed to load') : 'Failed to load';
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
      setSnackbar({ open: true, message: `"${deleteTarget.title}" deleted successfully`, severity: 'success' });
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Delete failed') : 'Delete failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#111827">Tenders</Typography>
            <Typography variant="body2" color="text.secondary">{tenders.length} total</Typography>
          </Box>
          <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/dashboard/tenders/create')}>
            Add Tender
          </FormButton>
        </Box>

        <DataTable<Tender>
          rows={tenders}
          loading={loading}
          getRowId={(row) => row.id}
          columns={[
            {
              field: 'title',
              headerName: 'Title',
              flex: 1,
              sortable: true,
              renderCell: (row) => (
                <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.title}</Typography>
              ),
            },
            {
              field: 'projectName',
              headerName: 'Project',
              flex: 1,
              sortable: true,
              renderCell: (row) => (
                <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{row.projectName ?? '—'}</Typography>
              ),
            },
            {
              field: 'status',
              headerName: 'Status',
              width: 120,
              sortable: true,
              renderCell: (row) => (
                <Chip
                  label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  size="small"
                  sx={{ ...(statusColors[row.status] ?? statusColors.draft), fontWeight: 600, fontSize: '11px' }}
                />
              ),
            },
            {
              field: 'budget',
              headerName: 'Budget',
              width: 130,
              renderCell: (row) => (
                <Typography sx={{ color: '#1F2937', fontSize: '13px' }}>
                  {row.budget ? `$${Number(row.budget).toLocaleString()}` : '—'}
                </Typography>
              ),
            },
            {
              field: 'deadline',
              headerName: 'Deadline',
              width: 120,
              sortable: true,
              renderCell: (row) => (
                <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>
                  {row.deadline ? new Date(row.deadline).toLocaleDateString() : '—'}
                </Typography>
              ),
            },
          ]}
          actions={[
            {
              label: 'Edit',
              icon: <EditIcon fontSize="small" />,
              onClick: (row) => router.push(`/dashboard/tenders/${row.id}`),
              color: 'primary',
            },
            {
              label: 'Delete',
              icon: <DeleteIcon fontSize="small" />,
              onClick: (row) => setDeleteTarget(row),
              color: 'error',
            },
          ]}
          emptyMessage="No tenders yet"
        />

        <ConfirmationDialog
          open={!!deleteTarget}
          title="Delete Tender"
          description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
          confirmLabel="Delete"
        />
        <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
      </Box>
    </DashboardLayout>
  );
}
