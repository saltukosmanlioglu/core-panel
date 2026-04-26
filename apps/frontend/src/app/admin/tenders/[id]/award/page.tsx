'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { ConfirmationDialog, DataTable, Notification } from '@/components';
import type { DataTableColumn } from '@/components';
import { FormButton } from '@/components/form-elements';
import {
  bulkUpsertAwardItems,
  finalizeTender as finalizeTenderApi,
  getTenderAuditLog,
  getTenderAwardItems,
  getTenderRecommendations,
} from '@/services/tender-awards/api';
import { getTenderComparison } from '@/services/tender-comparisons/api';
import { getTenderApi } from '@/services/workspace/api';
import type {
  AwardItemStatus,
  ItemRecommendation,
  RecommendationType,
  Tender,
  TenderAuditLog,
  TenderAwardItem,
  TenderComparison,
} from '@core-panel/shared';

interface AwardDraftRow {
  siraNo: number;
  description: string;
  recommendedTenantId: string | null;
  recommendationType: RecommendationType;
  recommendationNote: string;
  priceDiffPercent: number | null;
  awardedTenantId: string | null;
  status: AwardItemStatus | '';
  note: string;
}

const STATUS_OPTIONS: Array<{ value: AwardItemStatus; label: string; color: string }> = [
  { value: 'awarded', label: 'Atandı', color: '#166534' },
  { value: 'pending_negotiation', label: 'Müzakerede', color: '#C2410C' },
  { value: 'excluded', label: 'Hariç tutuldu', color: '#4B5563' },
];

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

function getRecommendationMeta(type: RecommendationType): {
  label: string;
  backgroundColor: string;
  color: string;
} {
  switch (type) {
    case 'strongly_recommended':
      return { label: '✓ Kesinlikle önerilir', backgroundColor: '#DCFCE7', color: '#166534' };
    case 'recommended':
      return { label: '↑ Önerilir', backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'close_price':
      return { label: '≈ Yakın fiyat', backgroundColor: '#E5E7EB', color: '#374151' };
    case 'no_competition':
      return { label: '⚠ Tek teklif', backgroundColor: '#FED7AA', color: '#C2410C' };
    case 'missing':
      return { label: '✗ Teklif yok', backgroundColor: '#FEE2E2', color: '#B91C1C' };
    case 'negotiate':
      return { label: '↔ Müzakere edin', backgroundColor: '#FEF3C7', color: '#A16207' };
    default:
      return { label: type, backgroundColor: '#F3F4F6', color: '#374151' };
  }
}

function getTenderStatusMeta(status?: string | null): {
  label: string;
  backgroundColor: string;
  color: string;
} {
  switch (status) {
    case 'awarded':
      return { label: 'Sonlandırıldı', backgroundColor: '#DCFCE7', color: '#166534' };
    case 'published':
      return { label: 'Yayınlandı', backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'draft':
    default:
      return { label: 'Taslak', backgroundColor: '#E5E7EB', color: '#374151' };
  }
}

function buildAwardRows(
  comparison: TenderComparison | null,
  awardItems: TenderAwardItem[],
  recommendations: ItemRecommendation[],
): AwardDraftRow[] {
  const rows = comparison?.resultJson?.rows ?? [];
  const awardMap = new Map(awardItems.map((item) => [item.siraNo, item]));
  const recommendationMap = new Map(recommendations.map((item) => [item.siraNo, item]));

  return rows.map((row) => {
    const savedItem = awardMap.get(row.siraNo);
    const recommendation = recommendationMap.get(row.siraNo);

    return {
      siraNo: row.siraNo,
      description: row.description,
      recommendedTenantId: recommendation?.recommendedTenantId ?? null,
      recommendationType: recommendation?.recommendationType ?? 'missing',
      recommendationNote: recommendation?.recommendationNote ?? 'Sistem önerisi yok',
      priceDiffPercent: recommendation?.priceDiffPercent ?? null,
      awardedTenantId: savedItem?.awardedTenantId ?? recommendation?.recommendedTenantId ?? null,
      status: (savedItem?.status as AwardItemStatus | undefined) ?? '',
      note: savedItem?.note ?? '',
    };
  });
}

function translateAuditLog(log: TenderAuditLog): string {
  const details = (log.details ?? {}) as Record<string, unknown>;

  switch (log.action) {
    case 'tender_finalized':
      return 'İhale sonlandırıldı';
    case 'items_awarded': {
      const itemCount = Number(details.itemCount ?? 0);
      const awardedCount = Number(details.awardedCount ?? 0);
      const pendingCount = Number(details.pendingCount ?? 0);
      const excludedCount = Number(details.excludedCount ?? 0);
      return `${itemCount} kalem güncellendi (${awardedCount} atandı, ${pendingCount} müzakerede, ${excludedCount} hariç)`;
    }
    case 'comparison_run': {
      const tenantCount = Number(details.tenantCount ?? 0);
      return tenantCount > 0
        ? `Karşılaştırma çalıştırıldı (${tenantCount} firma)`
        : 'Karşılaştırma çalıştırıldı';
    }
    default:
      return log.action;
  }
}

export default function AdminTenderAwardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tender, setTender] = useState<Tender | null>(null);
  const [comparison, setComparison] = useState<TenderComparison | null>(null);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [awardRows, setAwardRows] = useState<AwardDraftRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<TenderAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [tenderData, comparisonData, awardItems, recommendations, logs] = await Promise.all([
        getTenderApi(id),
        getTenderComparison(id),
        getTenderAwardItems(id),
        getTenderRecommendations(id),
        getTenderAuditLog(id),
      ]);

      setTender(tenderData);
      setComparison(comparisonData);
      setAwardRows(buildAwardRows(comparisonData, awardItems, recommendations));
      setTenantNames(comparisonData?.resultJson?.tenantNames ?? {});
      setAuditLogs(logs);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Değerlendirme verileri yüklenemedi'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasAllStatuses = awardRows.length > 0 && awardRows.every((row) => row.status !== '');
  const tenderStatusMeta = getTenderStatusMeta(tender?.status);

  const handleChangeRow = useCallback(
    (siraNo: number, updater: (row: AwardDraftRow) => AwardDraftRow) => {
      setAwardRows((current) => current.map((row) => (row.siraNo === siraNo ? updater(row) : row)));
    },
    [],
  );

  const handleApplyRecommendations = () => {
    setAwardRows((current) =>
      current.map((row) => ({
        ...row,
        awardedTenantId: row.recommendedTenantId,
        status: row.recommendedTenantId ? 'awarded' : 'pending_negotiation',
      })),
    );
  };

  const buildPayload = () =>
    awardRows
      .filter((row) => row.status !== '')
      .map((row) => ({
        siraNo: row.siraNo,
        description: row.description,
        awardedTenantId: row.awardedTenantId,
        status: row.status as AwardItemStatus,
        note: row.note.trim() || undefined,
      }));

  const handleSave = async () => {
    const payload = buildPayload();

    if (payload.length === 0) {
      setSnackbar({
        open: true,
        message: 'Kaydedilecek en az bir kalem durumu seçin',
        severity: 'error',
      });
      return;
    }

    try {
      setSaving(true);
      await bulkUpsertAwardItems(id, payload);
      await loadData();
      setSnackbar({
        open: true,
        message: 'Kalem atamaları kaydedildi',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kalem atamaları kaydedilemedi'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!hasAllStatuses) {
      setSnackbar({
        open: true,
        message: 'İhaleyi sonlandırmadan önce tüm kalemlere durum verin',
        severity: 'error',
      });
      return;
    }

    try {
      setFinalizing(true);
      await bulkUpsertAwardItems(id, buildPayload());
      await finalizeTenderApi(id);
      setSnackbar({
        open: true,
        message: 'İhale başarıyla sonlandırıldı',
        severity: 'success',
      });
      setTimeout(() => {
        router.push('/admin/tenders');
      }, 800);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'İhale sonlandırılamadı'),
        severity: 'error',
      });
    } finally {
      setFinalizing(false);
      setConfirmFinalizeOpen(false);
    }
  };

  const columns = useMemo<DataTableColumn<AwardDraftRow>[]>(
    () => [
      {
        field: 'siraNo',
        headerName: '#',
        width: 70,
        sortable: true,
      },
      {
        field: 'description',
        headerName: 'Tanım',
        width: 300,
        sortable: false,
      },
      {
        field: 'recommendationType',
        headerName: 'Sistem Önerisi',
        width: 220,
        sortable: false,
        renderCell: (row) => {
          const meta = getRecommendationMeta(row.recommendationType);

          return (
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              <Chip
                size="small"
                label={meta.label}
                sx={{
                  backgroundColor: meta.backgroundColor,
                  color: meta.color,
                  fontWeight: 700,
                  maxWidth: 'fit-content',
                }}
              />
              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                {row.recommendationNote}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'awardedTenantId',
        headerName: 'Atanan Firma',
        width: 220,
        sortable: false,
        renderCell: (row) => (
          <Select
            size="small"
            fullWidth
            value={row.awardedTenantId ?? ''}
            onChange={(event) =>
              handleChangeRow(row.siraNo, (current) => ({
                ...current,
                awardedTenantId: event.target.value ? String(event.target.value) : null,
              }))
            }
          >
            <MenuItem value="">—</MenuItem>
            {Object.entries(tenantNames).map(([tenantId, tenantName]) => (
              <MenuItem key={tenantId} value={tenantId}>
                {tenantName}
              </MenuItem>
            ))}
          </Select>
        ),
      },
      {
        field: 'status',
        headerName: 'Durum',
        width: 200,
        sortable: false,
        renderCell: (row) => (
          <Select
            size="small"
            fullWidth
            value={row.status}
            displayEmpty
            onChange={(event) =>
              handleChangeRow(row.siraNo, (current) => ({
                ...current,
                status: event.target.value as AwardItemStatus | '',
              }))
            }
          >
            <MenuItem value="">Durum seçin</MenuItem>
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        ),
      },
      {
        field: 'note',
        headerName: 'Not',
        width: 260,
        sortable: false,
        renderCell: (row) => (
          <TextField
            size="small"
            fullWidth
            value={row.note}
            onChange={(event) =>
              handleChangeRow(row.siraNo, (current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            placeholder="Not ekleyin"
          />
        ),
      },
    ],
    [handleChangeRow, tenantNames],
  );

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <FormButton
            variant="ghost"
            size="sm"
            startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
            onClick={() => router.push(`/admin/tenders/${id}/offers`)}
          >
            Geri
          </FormButton>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827' }}>
            {loading ? 'İhale Yükleniyor...' : tender?.title ?? 'İhale'}
          </Typography>
          <Chip
            label={tenderStatusMeta.label}
            sx={{
              backgroundColor: tenderStatusMeta.backgroundColor,
              color: tenderStatusMeta.color,
              fontWeight: 700,
            }}
          />
        </Box>

        <FormButton
          variant="danger"
          size="sm"
          onClick={() => setConfirmFinalizeOpen(true)}
          disabled={!hasAllStatuses || finalizing || tender?.status === 'awarded'}
          loading={finalizing}
        >
          İhaleyi Sonlandır
        </FormButton>
      </Box>

      <Card sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress size={32} />
          </Box>
        ) : comparison?.resultJson ? (
          <DataTable
            title="Kalem Atamaları"
            columns={columns}
            rows={awardRows}
            getRowId={(row) => String(row.siraNo)}
            defaultPageSize={50}
            emptyMessage="Karşılaştırma verisi bulunamadı"
            toolbarActions={(
              <>
                <FormButton variant="secondary" size="sm" onClick={handleApplyRecommendations}>
                  Tümünü Öneriye Göre Ata
                </FormButton>
                <FormButton variant="primary" size="sm" onClick={handleSave} loading={saving}>
                  Kaydet
                </FormButton>
              </>
            )}
          />
        ) : (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, color: '#111827' }}>
              Karşılaştırma verisi bulunamadı
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Önce ihale karşılaştırmasını çalıştırın, ardından değerlendirme ekranını kullanın.
            </Typography>
          </Box>
        )}
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', mb: 2 }}>
          Aktivite Geçmişi
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : auditLogs.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Henüz aktivite kaydı bulunmuyor.
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 2 }}>
            {auditLogs.map((log) => (
              <Box key={log.id} sx={{ borderBottom: '1px solid #E5E7EB', pb: 2, '&:last-child': { borderBottom: 'none', pb: 0 } }}>
                <Typography variant="body2" sx={{ color: '#6B7280', mb: 0.5 }}>
                  {`🕐 ${new Date(log.createdAt).toLocaleString('tr-TR')} — ${log.createdByName ?? log.createdBy}`}
                </Typography>
                <Typography variant="body1" sx={{ color: '#111827', fontWeight: 600 }}>
                  {translateAuditLog(log)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Card>

      <ConfirmationDialog
        open={confirmFinalizeOpen}
        title="İhaleyi Sonlandır"
        description="İhaleyi sonlandırmak istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onCancel={() => setConfirmFinalizeOpen(false)}
        onConfirm={handleFinalize}
        loading={finalizing}
        confirmLabel="Sonlandır"
      />

      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
}
