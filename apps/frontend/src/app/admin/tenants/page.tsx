'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getTenantsApi, deleteTenantApi } from '@/services/admin/api';
import type { Tenant } from '@core-panel/shared';
import axios from 'axios';

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getTenantsApi()
      .then(setTenants)
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
      await deleteTenantApi(deleteTarget.id);
      setSnackbar({ open: true, message: `"${deleteTarget.name}" başarıyla silindi`, severity: 'success' });
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
          <Typography variant="h5" fontWeight={700} color="#111827">Taşeronlar</Typography>
          <Typography variant="body2" color="text.secondary">{tenants.length} kayıt</Typography>
        </Box>
        <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/admin/tenants/create')}>
          Taşeron Ekle
        </FormButton>
      </Box>

      <DataTable<Tenant>
        rows={tenants}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Ad',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name}</Typography>
            ),
          },
          {
            field: 'companyName',
            headerName: 'Şirket',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              row.companyName
                ? <Chip label={row.companyName} size="small" sx={{ backgroundColor: 'rgba(31,41,55,0.08)', color: '#1F2937', fontWeight: 500, fontSize: '12px' }} />
                : <Typography sx={{ color: '#9CA3AF', fontSize: '13px' }}>—</Typography>
            ),
          },
          {
            field: 'createdAt',
            headerName: 'Oluşturulma Tarihi',
            width: 160,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>
                {new Date(row.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </Typography>
            ),
          },
        ]}
        actions={[
          {
            label: 'Düzenle',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => router.push(`/admin/tenants/${row.id}`),
            color: 'primary',
          },
          {
            label: 'Sil',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row) => setDeleteTarget(row),
            color: 'error',
          },
        ]}
        emptyMessage="Henüz taşeron yok"
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Taşeron Sil"
        description={`"${deleteTarget?.name}" taşeronunu silmek istediğinize emin misiniz?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmLabel="Sil"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
