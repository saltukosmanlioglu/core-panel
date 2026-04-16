'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Chip, Tooltip, IconButton, CircularProgress } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { getCompaniesApi, reprovisionCompanySchemaApi } from '@/services/admin/api';
import type { Company } from '@core-panel/shared';
import axios from 'axios';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprovisioning, setReprovisioning] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    setLoading(true);
    getCompaniesApi()
      .then(setCompanies)
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Yüklenemedi') : 'Yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleReprovision = async (company: Company) => {
    setReprovisioning(company.id);
    try {
      const updated = await reprovisionCompanySchemaApi(company.id);
      setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSnackbar({ open: true, message: `"${company.name}" için şema yeniden oluşturuldu`, severity: 'success' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Şema oluşturulamadı') : 'Şema oluşturulamadı';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setReprovisioning(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#111827">Şirketim</Typography>
          <Typography variant="body2" color="text.secondary">{companies.length} kayıt</Typography>
        </Box>
      </Box>

      <DataTable<Company>
        rows={companies}
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
            field: 'schemaProvisioned',
            headerName: 'Şema',
            width: 160,
            sortable: false,
            renderCell: (row) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {row.schemaProvisioned ? (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                    label="Şema Oluşturuldu"
                    size="small"
                    sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600, fontSize: '11px', '& .MuiChip-icon': { color: '#065F46' } }}
                  />
                ) : (
                  <Chip
                    icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                    label="Şema Oluşturulmadı"
                    size="small"
                    sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600, fontSize: '11px', '& .MuiChip-icon': { color: '#991B1B' } }}
                  />
                )}
                <Tooltip title="Şemayı Yeniden Oluştur">
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
        emptyMessage="Henüz şirket yok"
      />

      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
