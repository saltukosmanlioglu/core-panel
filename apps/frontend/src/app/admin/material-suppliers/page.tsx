'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import {
  deleteMaterialSupplierApi,
  getMaterialSuppliersApi,
  type MaterialSupplier,
} from '@/services/material-suppliers/api';
import axios from 'axios';

export default function MaterialSuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<MaterialSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<MaterialSupplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getMaterialSuppliersApi()
      .then(setSuppliers)
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
      await deleteMaterialSupplierApi(deleteTarget.id);
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
          <Typography variant="h5" fontWeight={700} color="#111827">Malzemeciler</Typography>
          <Typography variant="body2" color="text.secondary">{suppliers.length} kayıt</Typography>
        </Box>
        <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/admin/material-suppliers/create')}>
          Yeni Malzemeci
        </FormButton>
      </Box>

      <DataTable<MaterialSupplier>
        rows={suppliers}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Firma Adı',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name}</Typography>
            ),
          },
          {
            field: 'contactName',
            headerName: 'İlgili Kişi',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: row.contactName ? '#1F2937' : '#9CA3AF', fontSize: '13px' }}>
                {row.contactName || '—'}
              </Typography>
            ),
          },
          {
            field: 'contactPhone',
            headerName: 'Telefon',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: row.contactPhone ? '#1F2937' : '#9CA3AF', fontSize: '13px' }}>
                {row.contactPhone || '—'}
              </Typography>
            ),
          },
        ]}
        actions={[
          {
            label: 'Düzenle',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => router.push(`/admin/material-suppliers/${row.id}`),
            color: 'primary',
          },
          {
            label: 'Sil',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row) => setDeleteTarget(row),
            color: 'error',
          },
        ]}
        emptyMessage="Henüz malzemeci yok"
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Malzemeci Sil"
        description={`"${deleteTarget?.name}" malzemecisini silmek istediğinize emin misiniz?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmLabel="Sil"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
