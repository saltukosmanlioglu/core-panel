'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Chip, Tooltip, IconButton, CircularProgress } from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getCompaniesApi, deleteCompanyApi, reprovisionCompanySchemaApi } from '@/services/admin/api';
import type { Company } from '@core-panel/shared';
import { useUser } from '@/contexts/UserContext';
import { UserRole } from '@core-panel/shared';
import axios from 'axios';

export default function CompaniesPage() {
  const router = useRouter();
  const { user } = useUser();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reprovisioning, setReprovisioning] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = () => {
    setLoading(true);
    getCompaniesApi()
      .then(setCompanies)
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
      await deleteCompanyApi(deleteTarget.id);
      setSnackbar({ open: true, message: `"${deleteTarget.name}" deleted successfully`, severity: 'success' });
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Delete failed') : 'Delete failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleReprovision = async (company: Company) => {
    setReprovisioning(company.id);
    try {
      const updated = await reprovisionCompanySchemaApi(company.id);
      setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSnackbar({ open: true, message: `Schema re-provisioned for "${company.name}"`, severity: 'success' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Re-provision failed') : 'Re-provision failed';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setReprovisioning(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#111827">Companies</Typography>
          <Typography variant="body2" color="text.secondary">{companies.length} total</Typography>
        </Box>
        {isSuperAdmin && (
          <FormButton variant="primary" size="md" startIcon={<AddIcon />} onClick={() => router.push('/admin/companies/create')}>
            Add Company
          </FormButton>
        )}
      </Box>

      <DataTable<Company>
        rows={companies}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Name',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name}</Typography>
            ),
          },
          {
            field: 'schemaProvisioned',
            headerName: 'Schema',
            width: 160,
            sortable: false,
            renderCell: (row) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {row.schemaProvisioned ? (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                    label="Provisioned"
                    size="small"
                    sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600, fontSize: '11px', '& .MuiChip-icon': { color: '#065F46' } }}
                  />
                ) : (
                  <Chip
                    icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                    label="Not provisioned"
                    size="small"
                    sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600, fontSize: '11px', '& .MuiChip-icon': { color: '#991B1B' } }}
                  />
                )}
                <Tooltip title="Re-provision schema">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleReprovision(row)}
                      disabled={reprovisioning === row.id}
                      sx={{ color: '#6B7280', '&:hover': { color: '#111827' } }}
                    >
                      {reprovisioning === row.id ? (
                        <CircularProgress size={14} />
                      ) : (
                        <RefreshIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ),
          },
          {
            field: 'createdAt',
            headerName: 'Created',
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
          ...(isSuperAdmin ? [{
            label: 'Edit',
            icon: <EditIcon fontSize="small" />,
            onClick: (row: Company) => router.push(`/admin/companies/${row.id}`),
            color: 'primary' as const,
          }] : []),
          ...(isSuperAdmin ? [{
            label: 'Delete',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row: Company) => setDeleteTarget(row),
            color: 'error' as const,
          }] : []),
        ]}
        emptyMessage="No companies yet"
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Company"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all associated tenants and the company's data schema.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmLabel="Delete"
      />
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
