'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Download as DownloadIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormButton } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { DataTable } from '@/components/data-table';
import { TenderStatusChip } from '@/components/tender-status-chip';
import { getCompaniesApi } from '@/services/admin/api';
import { getTendersApi, deleteTenderApi } from '@/services/workspace/api';
import { getTenderItemsApi } from '@/services/tender-items/api';
import { exportTenderForm } from '@/utils/exportTenderForm';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';
import type { Tender } from '@core-panel/shared';

export default function AdminTendersPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Tender | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const load = () => {
    setLoading(true);
    getTendersApi()
      .then(setTenders)
      .catch((err: unknown) => showError(getErrorMessage(err, 'Yüklenemedi')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    getCompaniesApi().then(companies => {
      setCompanyName(companies[0]?.name ?? '');
    }).catch(() => undefined);
  }, []);

  const handleExportTender = async (tender: Tender) => {
    try {
      const items = await getTenderItemsApi(tender.id);
      await exportTenderForm({
        tenderTitle: tender.title,
        projectName: tender.projectName ?? '',
        categoryName: tender.categoryName ?? '',
        deadline: tender.deadline ?? null,
        companyName,
        items: items.map(item => ({
          rowNo: item.rowNo,
          posNo: item.posNo ?? null,
          description: item.description,
          unit: item.unit,
          quantity: Number(item.quantity),
          location: item.location ?? null,
        })),
      });
    } catch {
      showError('Excel indirilemedi');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTenderApi(deleteTarget.id);
      showSuccess(`"${deleteTarget.title}" silindi`);
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Silinemedi'));
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
              renderCell: (r) => <TenderStatusChip status={r.status} />,
            },
            {
              field: 'deadline', headerName: 'Son Tarih', width: 120, sortable: true,
              renderCell: (r) => <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{r.deadline ? new Date(r.deadline).toLocaleDateString('tr-TR') : '—'}</Typography>,
            },
          ]}
          actions={[
            { label: 'Teklif Formu İndir', icon: <DownloadIcon fontSize="small" />, onClick: (r) => { void handleExportTender(r); } },
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
        <Notification {...notificationProps} />
    </Box>
  );
}
