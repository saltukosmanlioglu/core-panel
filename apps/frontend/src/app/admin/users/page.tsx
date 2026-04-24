'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Chip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getAdminUsersApi, deleteAdminUserApi } from '@/services/admin/api';
import type { User } from '@core-panel/shared';
import axios from 'axios';

const roleColors: Record<string, { bg: string; color: string }> = {
  company_admin: { bg: '#EDE9FE', color: '#5B21B6' },
  user: { bg: 'rgba(31,41,55,0.08)', color: '#1F2937' },
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getAdminUsersApi()
      .then(setUsers)
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
      await deleteAdminUserApi(deleteTarget.id);
      setSnackbar({ open: true, message: `"${deleteTarget.email}" başarıyla silindi`, severity: 'success' });
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
          <Typography variant="h5" fontWeight={700} color="#111827">Kullanıcılar</Typography>
          <Typography variant="body2" color="text.secondary">{users.length} kayıt</Typography>
        </Box>
        <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/admin/users/create')}>
          Kullanıcı Ekle
        </FormButton>
      </Box>

      <DataTable<User>
        rows={users}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Ad',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Box>
                <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name ?? '—'}</Typography>
                <Typography sx={{ color: '#6B7280', fontSize: '12px' }}>{row.email}</Typography>
              </Box>
            ),
          },
          {
            field: 'role',
            headerName: 'Rol',
            width: 160,
            sortable: true,
            renderCell: (row) => (
              <Chip
                label={row.role.replace(/_/g, ' ')}
                size="small"
                sx={{ ...(roleColors[row.role] ?? roleColors.user), fontWeight: 600, fontSize: '11px', textTransform: 'capitalize' }}
              />
            ),
          },
          {
            field: 'tenantName',
            headerName: 'Taşeron',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{row.tenantName ?? '—'}</Typography>
            ),
          },
          {
            field: 'isActive',
            headerName: 'Durum',
            width: 110,
            renderCell: (row) => (
              <Chip
                label={row.isActive ? 'Aktif' : 'Pasif'}
                size="small"
                sx={{
                  backgroundColor: row.isActive ? '#DCFCE7' : '#F3F4F6',
                  color: row.isActive ? '#10B981' : '#6B7280',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              />
            ),
          },
          {
            field: 'createdAt',
            headerName: 'Oluşturulma Tarihi',
            width: 120,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>
                {new Date(row.createdAt).toLocaleDateString()}
              </Typography>
            ),
          },
        ]}
        actions={[
          {
            label: 'Düzenle',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => router.push(`/admin/users/${row.id}`),
            color: 'primary',
          },
          {
            label: 'Sil',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row) => setDeleteTarget(row),
            color: 'error',
          },
        ]}
        emptyMessage="Henüz kullanıcı yok"
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Kullanıcı Sil"
        description={`"${deleteTarget?.email}" kullanıcısını silmek istediğinize emin misiniz? Kullanıcı Auth0'dan da kaldırılacaktır.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmLabel="Sil"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
