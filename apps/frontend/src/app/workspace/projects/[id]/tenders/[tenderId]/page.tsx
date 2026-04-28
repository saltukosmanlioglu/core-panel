'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AutoAwesome as AutoAwesomeIcon,
  CalendarToday as CalendarTodayIcon,
  Category as CategoryIcon,
  CompareArrows as CompareArrowsIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  EmojiEvents as EmojiEventsIcon,
  Flag as FlagIcon,
  Folder as FolderIcon,
  FormatListNumbered as FormatListNumberedIcon,
  Gavel as GavelIcon,
  History as HistoryIcon,
  InsertDriveFile as InsertDriveFileIcon,
  People as PeopleIcon,
  Save as SaveIcon,
  Savings as SavingsIcon,
  SwapHoriz as SwapHorizIcon,
  Title as TitleIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { ConfirmationDialog, Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { getCompaniesApi, getTenantsApi } from '@/services/admin/api';
import { exportComparison } from '@/utils/exportComparison';
import { exportTenderForm } from '@/utils/exportTenderForm';
import { getTenantsByCategoryApi } from '@/services/categories/api';
import {
  bulkUpsertAwardItems,
  finalizeTender as finalizeTenderApi,
  getTenderAuditLog,
  getTenderAwardItems,
  getTenderRecommendations,
} from '@/services/tender-awards/api';
import { getTenderComparison, runTenderComparison } from '@/services/tender-comparisons/api';
import {
  deleteTenderItemNote,
  getTenderItemNotes,
  upsertTenderItemNote,
  type TenderItemNoteDto,
} from '@/services/tender-item-notes/api';
import { getTenderItemsApi } from '@/services/tender-items/api';
import { getTenderInvitations, updateTenderInvitations } from '@/services/tender-invitations/api';
import {
  deleteTenderOfferFile,
  getTenderOfferFiles,
  uploadTenderOfferFile,
} from '@/services/tender-offer-files/api';
import { getTenderApi } from '@/services/workspace/api';
import type {
  AwardItemStatus,
  ComparisonPriceCell,
  ComparisonResult,
  ItemRecommendation,
  RecommendationType,
  Tender,
  TenderAuditLog,
  TenderAwardItem,
  TenderComparison,
  TenderItem,
  TenderOfferFile,
  Tenant,
} from '@core-panel/shared';

// ─── Constants ────────────────────────────────────────────────────────────────

const statusColors: Record<string, { backgroundColor: string; color: string; label: string }> = {
  draft: { backgroundColor: '#F3F4F6', color: '#6B7280', label: 'Taslak' },
  open: { backgroundColor: '#DCFCE7', color: '#15803D', label: 'Açık' },
  closed: { backgroundColor: '#FEF3C7', color: '#92400E', label: 'Kapalı' },
  awarded: { backgroundColor: '#DBEAFE', color: '#1D4ED8', label: 'Atandı' },
};

const statusChipColors: Record<string, 'default' | 'success' | 'warning' | 'primary'> = {
  draft: 'default',
  open: 'success',
  closed: 'warning',
  awarded: 'primary',
};

const awardStatusOptions: Array<{ value: AwardItemStatus; label: string }> = [
  { value: 'awarded', label: 'Atandı' },
  { value: 'pending_negotiation', label: 'Müzakerede' },
  { value: 'excluded', label: 'Hariç tutuldu' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type PriceCellCompat = ComparisonPriceCell & {
  price?: number | null;
};

interface AwardDraftRow {
  rowNumber: number;
  description: string;
  recommendedTenantId: string | null;
  recommendationType: RecommendationType;
  recommendationNote: string;
  priceDiffPercent: number | null;
  awardedTenantId: string | null;
  status: AwardItemStatus | '';
  note: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('tr-TR') : '—';
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('tr-TR') : '—';
}

function formatAmount(value: number): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number): string {
  return `${formatAmount(value)}₺`;
}

function getPriceTotal(cell?: PriceCellCompat): number | null {
  if (!cell) {
    return null;
  }

  if (typeof cell.tutar === 'number') {
    return cell.tutar;
  }

  return typeof cell.price === 'number' ? cell.price : null;
}

function getRecommendationMeta(type: RecommendationType): {
  label: string;
  backgroundColor: string;
  color: string;
} {
  switch (type) {
    case 'strongly_recommended':
      return { label: 'Kesinlikle önerilir', backgroundColor: '#DCFCE7', color: '#166534' };
    case 'recommended':
      return { label: 'Önerilir', backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'close_price':
      return { label: 'Yakın fiyat', backgroundColor: '#E5E7EB', color: '#374151' };
    case 'no_competition':
      return { label: 'Tek teklif', backgroundColor: '#FED7AA', color: '#C2410C' };
    case 'negotiate':
      return { label: 'Müzakere edin', backgroundColor: '#FEF3C7', color: '#A16207' };
    case 'missing':
    default:
      return { label: 'Teklif yok', backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
}

function buildAwardRows(
  comparison: TenderComparison | null,
  awardItems: TenderAwardItem[],
  recommendations: ItemRecommendation[],
): AwardDraftRow[] {
  const sourceRows = comparison?.resultJson?.rows ?? [];
  const awardMap = new Map(awardItems.map((item) => [item.siraNo, item]));
  const recommendationMap = new Map(recommendations.map((item) => [item.siraNo, item]));

  return sourceRows.map((row) => {
    const rowNumber = row.siraNo;
    const savedItem = awardMap.get(rowNumber);
    const recommendation = recommendationMap.get(rowNumber);

    return {
      rowNumber,
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
      return tenantCount > 0 ? `Karşılaştırma çalıştırıldı (${tenantCount} firma)` : 'Karşılaştırma çalıştırıldı';
    }
    default:
      return log.action;
  }
}

function getComparisonSummary(
  result: ComparisonResult | null,
  tenantIds: string[],
): {
  minimumTotal: number;
  maximumTotal: number;
  potentialSavings: number;
  cheapestTenantId: string | null;
  totals: Record<string, number>;
} {
  const totals = Object.fromEntries(tenantIds.map((tenantId) => [tenantId, 0])) as Record<string, number>;
  let minimumTotal = 0;
  let maximumTotal = 0;

  for (const row of result?.rows ?? []) {
    const rowPrices = tenantIds
      .map((tenantId) => ({
        tenantId,
        total: getPriceTotal((row.prices as Record<string, PriceCellCompat | undefined>)[tenantId]),
      }))
      .filter((item): item is { tenantId: string; total: number } => item.total !== null && item.total > 0);

    if (rowPrices.length > 0) {
      minimumTotal += Math.min(...rowPrices.map((item) => item.total));
      maximumTotal += Math.max(...rowPrices.map((item) => item.total));
    }

    for (const item of rowPrices) {
      totals[item.tenantId] += item.total;
    }
  }

  const cheapestTenantId = Object.entries(totals)
    .filter(([, total]) => total > 0)
    .sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;

  return {
    minimumTotal,
    maximumTotal,
    potentialSavings: maximumTotal - minimumTotal,
    cheapestTenantId,
    totals,
  };
}

function getFileColor(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return '#10b981';
  if (lower.endsWith('.pdf')) return '#ef4444';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return '#3b82f6';
  return '#64748b';
}

function auditActionLabel(action: string): string {
  return ({
    comparison_run: 'AI Karşılaştırması Çalıştırıldı',
    items_awarded: 'Kalemler Güncellendi',
    tender_finalized: 'İhale Sonlandırıldı',
  } as Record<string, string>)[action] ?? action;
}

function formatLogDetails(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  if (typeof details.itemCount === 'number') parts.push(`${details.itemCount} kalem`);
  if (typeof details.awardedCount === 'number') parts.push(`${details.awardedCount} atandı`);
  if (typeof details.pendingCount === 'number') parts.push(`${details.pendingCount} müzakerede`);
  if (typeof details.excludedCount === 'number') parts.push(`${details.excludedCount} hariç`);
  if (typeof details.tenantCount === 'number') parts.push(`${details.tenantCount} firma`);
  return parts.join(', ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspaceTenderWorkflowPage() {
  const { id: projectId, tenderId } = useParams<{ id: string; tenderId: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [tender, setTender] = useState<Tender | null>(null);
  const [items, setItems] = useState<TenderItem[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [offerFiles, setOfferFiles] = useState<TenderOfferFile[]>([]);
  const [comparison, setComparison] = useState<TenderComparison | null>(null);
  const [selectedComparisonTenantIds, setSelectedComparisonTenantIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [awardRows, setAwardRows] = useState<AwardDraftRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<TenderAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [savingInvitations, setSavingInvitations] = useState(false);
  const [uploadingTenantId, setUploadingTenantId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenderOfferFile | null>(null);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [runningComparison, setRunningComparison] = useState(false);
  const [savingNoteRow, setSavingNoteRow] = useState<number | null>(null);
  const [savingAwards, setSavingAwards] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const comparisonResult = comparison?.resultJson as ComparisonResult | null;
  const statusMeta = statusColors[tender?.status ?? 'draft'] ?? statusColors.draft;
  const offerFileMap = useMemo(
    () => new Map(offerFiles.map((offerFile) => [offerFile.tenantId, offerFile])),
    [offerFiles],
  );
  const invitedTenants = useMemo(
    () => availableTenants.filter((tenant) => selectedTenantIds.includes(tenant.id)),
    [availableTenants, selectedTenantIds],
  );
  const comparisonTenantEntries = useMemo(
    () =>
      Object.entries(comparisonResult?.tenantNames ?? {})
        .filter(([tenantId]) => selectedComparisonTenantIds.includes(tenantId))
        .sort((left, right) => left[1].localeCompare(right[1], 'tr')),
    [comparisonResult, selectedComparisonTenantIds],
  );
  const allComparisonTenantEntries = useMemo(
    () => Object.entries(comparisonResult?.tenantNames ?? {}).sort((left, right) => left[1].localeCompare(right[1], 'tr')),
    [comparisonResult],
  );
  const comparisonSummary = useMemo(
    () => getComparisonSummary(comparisonResult, comparisonTenantEntries.map(([tenantId]) => tenantId)),
    [comparisonResult, comparisonTenantEntries],
  );
  const tenantNames = comparisonResult?.tenantNames ?? {};
  const canRunComparison = offerFiles.length >= 2;
  const hasAllAwardStatuses = awardRows.length > 0 && awardRows.every((row) => row.status !== '');

  const loadOfferFiles = useCallback(async () => {
    const nextOfferFiles = await getTenderOfferFiles(tenderId);
    setOfferFiles(nextOfferFiles);
  }, [tenderId]);

  const loadNotes = useCallback(async () => {
    const noteItems = await getTenderItemNotes(tenderId);
    const nextNotes: Record<number, string> = {};

    for (const item of noteItems as TenderItemNoteDto[]) {
      nextNotes[item.siraNo] = item.note;
    }

    setNotes(nextNotes);
  }, [tenderId]);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);

      const [
        tenderData,
        itemData,
        tenantData,
        invitationData,
        offerFileData,
        comparisonData,
        noteData,
        awardItemData,
        recommendationData,
        auditLogData,
      ] = await Promise.all([
        getTenderApi(tenderId),
        getTenderItemsApi(tenderId),
        getTenantsApi(),
        getTenderInvitations(tenderId),
        getTenderOfferFiles(tenderId),
        getTenderComparison(tenderId),
        getTenderItemNotes(tenderId),
        getTenderAwardItems(tenderId),
        getTenderRecommendations(tenderId),
        getTenderAuditLog(tenderId),
      ]);
      const categoryTenantIds = tenderData.categoryId
        ? await getTenantsByCategoryApi(tenderData.categoryId)
        : tenantData.map((tenant) => tenant.id);
      const filteredTenants = tenantData.filter((tenant) => categoryTenantIds.includes(tenant.id));
      const nextNotes: Record<number, string> = {};

      for (const item of noteData as TenderItemNoteDto[]) {
        nextNotes[item.siraNo] = item.note;
      }

      setTender(tenderData);
      setItems(itemData);
      setAvailableTenants(filteredTenants);
      setSelectedTenantIds(invitationData.tenantIds.filter((tenantId) => categoryTenantIds.includes(tenantId)));
      setOfferFiles(offerFileData);
      setComparison(comparisonData);
      setSelectedComparisonTenantIds(Object.keys(comparisonData?.resultJson?.tenantNames ?? {}));
      setNotes(nextNotes);
      setAwardRows(buildAwardRows(comparisonData, awardItemData, recommendationData));
      setAuditLogs(auditLogData);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'İhale iş akışı yüklenemedi'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    getCompaniesApi().then(companies => {
      setCompanyName(companies[0]?.name ?? '');
    }).catch(() => undefined);
  }, []);

  const handleExportTender = async () => {
    if (!tender) return;
    try {
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
      setSnackbar({ open: true, message: 'Excel indirilemedi', severity: 'error' });
    }
  };

  const toggleTenant = (tenantId: string) => {
    setSelectedTenantIds((current) =>
      current.includes(tenantId)
        ? current.filter((idValue) => idValue !== tenantId)
        : [...current, tenantId],
    );
  };

  const toggleComparisonTenant = (tenantId: string) => {
    setSelectedComparisonTenantIds((current) =>
      current.includes(tenantId)
        ? current.filter((idValue) => idValue !== tenantId)
        : [...current, tenantId],
    );
  };

  const handleSaveInvitations = async () => {
    try {
      setSavingInvitations(true);
      const response = await updateTenderInvitations(tenderId, selectedTenantIds);
      setSelectedTenantIds(response.tenantIds);
      await loadOfferFiles();
      setSnackbar({ open: true, message: 'Davetler kaydedildi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Davetler kaydedilemedi'),
        severity: 'error',
      });
    } finally {
      setSavingInvitations(false);
    }
  };

  const handleUpload = async (tenantId: string, file: File | null) => {
    if (!file) {
      return;
    }

    try {
      setUploadingTenantId(tenantId);
      await uploadTenderOfferFile(tenderId, tenantId, file);
      await loadOfferFiles();
      setSnackbar({ open: true, message: 'Dosya yüklendi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Dosya yüklenemedi'),
        severity: 'error',
      });
    } finally {
      setUploadingTenantId(null);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeletingTenantId(deleteTarget.tenantId);
      await deleteTenderOfferFile(tenderId, deleteTarget.tenantId);
      await loadOfferFiles();
      setDeleteTarget(null);
      setSnackbar({ open: true, message: 'Dosya silindi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Dosya silinemedi'),
        severity: 'error',
      });
    } finally {
      setDeletingTenantId(null);
    }
  };

  const handleRunComparison = async () => {
    if (!canRunComparison) {
      return;
    }

    try {
      setRunningComparison(true);
      const nextComparison = await runTenderComparison(tenderId);
      setComparison(nextComparison);
      setSelectedComparisonTenantIds(Object.keys(nextComparison.resultJson?.tenantNames ?? {}));
      const [awardItemData, recommendationData, auditLogData] = await Promise.all([
        getTenderAwardItems(tenderId),
        getTenderRecommendations(tenderId),
        getTenderAuditLog(tenderId),
      ]);
      setAwardRows(buildAwardRows(nextComparison, awardItemData, recommendationData));
      setAuditLogs(auditLogData);
      setSnackbar({ open: true, message: 'Karşılaştırma tamamlandı', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Karşılaştırma çalıştırılamadı'),
        severity: 'error',
      });
    } finally {
      setRunningComparison(false);
    }
  };

  const handleSaveNote = async (rowNumber: number) => {
    const nextNote = notes[rowNumber]?.trim() ?? '';

    try {
      setSavingNoteRow(rowNumber);
      if (nextNote) {
        await upsertTenderItemNote(tenderId, rowNumber, nextNote);
      } else {
        await deleteTenderItemNote(tenderId, rowNumber);
      }
      await loadNotes();
      setSnackbar({ open: true, message: 'Not kaydedildi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Not kaydedilemedi'),
        severity: 'error',
      });
    } finally {
      setSavingNoteRow(null);
    }
  };

  const handleChangeAwardRow = (
    rowNumber: number,
    updater: (row: AwardDraftRow) => AwardDraftRow,
  ) => {
    setAwardRows((current) => current.map((row) => (row.rowNumber === rowNumber ? updater(row) : row)));
  };

  const handleApplyRecommendations = () => {
    setAwardRows((current) =>
      current.map((row) => ({
        ...row,
        awardedTenantId: row.recommendedTenantId,
        status: row.recommendedTenantId ? 'awarded' : 'pending_negotiation',
      })),
    );
  };

  const buildAwardPayload = () =>
    awardRows
      .filter((row) => row.status !== '')
      .map((row) => ({
        siraNo: row.rowNumber,
        description: row.description,
        awardedTenantId: row.awardedTenantId,
        status: row.status as AwardItemStatus,
        note: row.note.trim() || undefined,
      }));

  const handleSaveAwards = async () => {
    const payload = buildAwardPayload();

    if (payload.length === 0) {
      setSnackbar({ open: true, message: 'Kaydedilecek en az bir kalem seçin', severity: 'error' });
      return;
    }

    try {
      setSavingAwards(true);
      await bulkUpsertAwardItems(tenderId, payload);
      const [awardItemData, recommendationData, auditLogData] = await Promise.all([
        getTenderAwardItems(tenderId),
        getTenderRecommendations(tenderId),
        getTenderAuditLog(tenderId),
      ]);
      setAwardRows(buildAwardRows(comparison, awardItemData, recommendationData));
      setAuditLogs(auditLogData);
      setSnackbar({ open: true, message: 'Kalem atamaları kaydedildi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kalem atamaları kaydedilemedi'),
        severity: 'error',
      });
    } finally {
      setSavingAwards(false);
    }
  };

  const handleFinalize = async () => {
    if (!hasAllAwardStatuses) {
      setSnackbar({ open: true, message: 'Tüm kalemlere durum verin', severity: 'error' });
      return;
    }

    try {
      setFinalizing(true);
      await bulkUpsertAwardItems(tenderId, buildAwardPayload());
      await finalizeTenderApi(tenderId);
      setSnackbar({ open: true, message: 'İhale sonlandırıldı', severity: 'success' });
      setTimeout(() => router.push(`/workspace/projects/${projectId}/tenders`), 800);
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

  const handleExportComparison = async () => {
    if (!comparisonResult || !tender) {
      return;
    }

    try {
      await exportComparison({
        tenderTitle: tender.title,
        projectName: tender.projectName ?? '',
        categoryName: tender.categoryName ?? '',
        companyName,
        result: comparisonResult,
      });
    } catch {
      setSnackbar({ open: true, message: 'Excel indirilemedi', severity: 'error' });
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            backgroundColor: '#1E3A5F', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <GavelIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>{tender?.title ?? 'İhale'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {tender?.projectName ?? '—'} · {tender?.categoryName ?? '—'} · Son Tarih: {formatDate(tender?.deadline)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => { void handleExportTender(); }}
          >
            Teklif Formu İndir
          </Button>
          <Chip
            label={statusMeta.label}
            color={statusChipColors[tender?.status ?? 'draft'] ?? 'default'}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>

      {/* ── Main card ─────────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: '1px solid #e2e8f0', px: 1 }}
        >
          <Tab label="GENEL BİLGİLER" />
          <Tab label="TEKLİFLER" />
          <Tab label="KARŞILAŞTIRMA" />
          <Tab label="DEĞERLENDİRME" />
          <Tab label="AUDİT LOG" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>

          {/* ── Tab 0: GENEL BİLGİLER ─────────────────────────────────────────── */}
          {activeTab === 0 ? (
            <Stack spacing={3}>
              {/* Info cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                {[
                  { icon: <TitleIcon fontSize="small" />, label: 'Başlık', value: tender?.title ?? '—', color: '#1E3A5F' },
                  { icon: <CategoryIcon fontSize="small" />, label: 'Kategori', value: tender?.categoryName ?? '—', color: '#0ea5e9' },
                  { icon: <FlagIcon fontSize="small" />, label: 'Durum', value: statusMeta.label, color: '#10b981' },
                  { icon: <CalendarTodayIcon fontSize="small" />, label: 'Son Tarih', value: formatDate(tender?.deadline), color: '#f59e0b' },
                ].map(card => (
                  <Paper
                    key={card.label}
                    elevation={0}
                    sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', borderLeft: `4px solid ${card.color}` }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Box sx={{ color: card.color, display: 'flex' }}>{card.icon}</Box>
                      <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                    </Box>
                    <Typography variant="body1" fontWeight={600}>{card.value}</Typography>
                  </Paper>
                ))}
              </Box>

              {/* Description */}
              {tender?.description && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Açıklama</Typography>
                  <Typography variant="body2">{tender.description}</Typography>
                </Paper>
              )}

              {/* Items table */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <FormatListNumberedIcon sx={{ color: '#1E3A5F' }} />
                  <Typography variant="h6" fontWeight={600}>İş Kalemleri</Typography>
                  <Chip label={items.length} size="small" sx={{ ml: 1 }} />
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Pos No</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Tanım</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Birim</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Miktar</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Konum</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                            İş kalemi yok.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item, idx) => (
                          <TableRow
                            key={item.id}
                            sx={{ backgroundColor: idx % 2 !== 0 ? '#fafafa' : 'transparent' }}
                          >
                            <TableCell>{item.rowNo}</TableCell>
                            <TableCell>{item.posNo ?? '—'}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>{formatAmount(item.quantity)}</TableCell>
                            <TableCell>{item.location ?? '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          ) : null}

          {/* ── Tab 1: TEKLİFLER ──────────────────────────────────────────────── */}
          {activeTab === 1 ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' }, gap: 3 }}>

              {/* Left: Davet Edilen Taşeronlar */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon sx={{ color: '#f59e0b' }} />
                    <Typography fontWeight={600}>Davet Edilen Taşeronlar</Typography>
                  </Box>
                  <Chip label={selectedTenantIds.length} size="small" color="warning" />
                </Box>
                {availableTenants.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Bu kategoriye ait taşeron bulunmuyor.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {availableTenants.map(tenant => (
                      <Paper key={tenant.id} variant="outlined" sx={{ px: 1.25, py: 0.5, borderRadius: 1.5 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedTenantIds.includes(tenant.id)}
                              onChange={() => toggleTenant(tenant.id)}
                              size="small"
                            />
                          }
                          label={<Typography variant="body2">{tenant.name}</Typography>}
                        />
                      </Paper>
                    ))}
                    <Box sx={{ pt: 1 }}>
                      <FormButton
                        variant="primary"
                        size="md"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveInvitations}
                        loading={savingInvitations}
                      >
                        Davetleri Kaydet
                      </FormButton>
                    </Box>
                  </Stack>
                )}
              </Paper>

              {/* Right: Teklif Dosyaları */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderIcon sx={{ color: '#f59e0b' }} />
                    <Typography fontWeight={600}>Teklif Dosyaları</Typography>
                  </Box>
                  <Chip label={`${offerFiles.length}/${invitedTenants.length}`} size="small" />
                </Box>
                {invitedTenants.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Dosya yüklemek için en az bir taşeron davet edin.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {invitedTenants.map(tenant => {
                      const offerFile = offerFileMap.get(tenant.id) ?? null;
                      const fileInputId = `offer-file-${tenant.id}`;
                      const isUploading = uploadingTenantId === tenant.id;
                      const isDeleting = deletingTenantId === tenant.id;

                      return (
                        <Box key={tenant.id}>
                          <input
                            id={fileInputId}
                            type="file"
                            accept=".xlsx,.xls,.pdf,.doc,.docx"
                            hidden
                            onChange={event => {
                              const file = event.target.files?.[0] ?? null;
                              void handleUpload(tenant.id, file);
                              event.target.value = '';
                            }}
                          />
                          {offerFile ? (
                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Box sx={{
                                    width: 36, height: 36, borderRadius: 1,
                                    backgroundColor: getFileColor(offerFile.originalName),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                  }}>
                                    <InsertDriveFileIcon sx={{ color: 'white', fontSize: 18 }} />
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>{tenant.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {offerFile.originalName} · {formatDateTime(offerFile.createdAt)}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                  <FormButton
                                    variant="secondary"
                                    size="sm"
                                    startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => document.getElementById(fileInputId)?.click()}
                                    loading={isUploading}
                                    disabled={isDeleting}
                                  >
                                    Değiştir
                                  </FormButton>
                                  <IconButton
                                    color="error"
                                    size="small"
                                    onClick={() => setDeleteTarget(offerFile)}
                                    disabled={isUploading || isDeleting}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            </Paper>
                          ) : (
                            <Box sx={{
                              border: '1.5px dashed #cbd5e1',
                              borderRadius: 1.5,
                              p: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{
                                  width: 36, height: 36, borderRadius: 1,
                                  backgroundColor: '#f1f5f9',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  <InsertDriveFileIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                                </Box>
                                <Box>
                                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                                    {tenant.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">Dosya yüklenmedi</Typography>
                                </Box>
                              </Box>
                              <FormButton
                                variant="secondary"
                                size="sm"
                                startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
                                onClick={() => document.getElementById(fileInputId)?.click()}
                                loading={isUploading}
                              >
                                Yükle
                              </FormButton>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Box>
          ) : null}

          {/* ── Tab 2: KARŞILAŞTIRMA ──────────────────────────────────────────── */}
          {activeTab === 2 ? (
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CompareArrowsIcon sx={{ color: '#1E3A5F' }} />
                  <Typography variant="h6" fontWeight={600}>Karşılaştırma</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => { void handleExportComparison(); }}
                    disabled={!comparisonResult}
                  >
                    Excel Export
                  </Button>
                  <Tooltip title={canRunComparison ? '' : 'En az 2 dosya yükleyin'}>
                    <Box component="span">
                      <FormButton
                        variant="primary"
                        size="sm"
                        startIcon={runningComparison ? undefined : <AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                        onClick={handleRunComparison}
                        loading={runningComparison}
                        disabled={!canRunComparison}
                      >
                        AI Karşılaştırması Çalıştır
                      </FormButton>
                    </Box>
                  </Tooltip>
                </Box>
              </Box>

              {!comparison ? (
                <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Henüz karşılaştırma çalıştırılmadı. En az 2 teklif dosyası yükleyerek başlayın.
                  </Typography>
                </Paper>
              ) : comparison.status === 'failed' ? (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #fca5a5', backgroundColor: '#FFF7ED' }}>
                  <Typography variant="body2" sx={{ color: '#C2410C', fontWeight: 700 }}>
                    {comparison.errorMessage ?? 'Karşılaştırma tamamlanamadı.'}
                  </Typography>
                </Paper>
              ) : !comparisonResult ? (
                <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Karşılaştırma sonucu boş.</Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {/* Firm filter chips */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {allComparisonTenantEntries.map(([tenantId, tenantName]) => {
                      const selected = selectedComparisonTenantIds.includes(tenantId);
                      return (
                        <Chip
                          key={tenantId}
                          label={tenantName}
                          clickable
                          onClick={() => toggleComparisonTenant(tenantId)}
                          variant={selected ? 'filled' : 'outlined'}
                          color={selected ? 'primary' : 'default'}
                          size="small"
                        />
                      );
                    })}
                  </Box>

                  {/* Summary cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                    {[
                      {
                        icon: <SavingsIcon fontSize="small" />,
                        label: 'Potansiyel Tasarruf',
                        value: formatCurrency(comparisonSummary.potentialSavings),
                        color: '#10b981',
                      },
                      {
                        icon: <TrendingDownIcon fontSize="small" />,
                        label: 'Minimum Toplam',
                        value: formatCurrency(comparisonSummary.minimumTotal),
                        color: '#3b82f6',
                      },
                      {
                        icon: <TrendingUpIcon fontSize="small" />,
                        label: 'Maksimum Toplam',
                        value: formatCurrency(comparisonSummary.maximumTotal),
                        color: '#ef4444',
                      },
                      {
                        icon: <EmojiEventsIcon fontSize="small" />,
                        label: 'En Avantajlı Firma',
                        value: comparisonSummary.cheapestTenantId
                          ? (tenantNames[comparisonSummary.cheapestTenantId] ?? '—')
                          : '—',
                        color: '#f59e0b',
                      },
                    ].map(card => (
                      <Paper
                        key={card.label}
                        elevation={0}
                        sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', borderLeft: `4px solid ${card.color}` }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Box sx={{ color: card.color, display: 'flex' }}>{card.icon}</Box>
                          <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                        </Box>
                        <Typography variant="body1" fontWeight={700}>{card.value}</Typography>
                      </Paper>
                    ))}
                  </Box>

                  {/* Comparison table */}
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, maxHeight: 620 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Tanım</TableCell>
                          <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Birim</TableCell>
                          {comparisonTenantEntries.map(([tenantId, tenantName]) => (
                            <TableCell key={tenantId} sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>
                              {tenantName}
                            </TableCell>
                          ))}
                          <TableCell sx={{ minWidth: 260, fontWeight: 600, backgroundColor: '#f8fafc' }}>Not</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparisonResult.rows.map((row) => {
                          const rowNumber = row.siraNo;
                          const rowPrices = comparisonTenantEntries
                            .map(([tenantId]) => getPriceTotal((row.prices as Record<string, PriceCellCompat | undefined>)[tenantId]))
                            .filter((total): total is number => total !== null && total > 0);
                          const minPrice = rowPrices.length > 0 ? Math.min(...rowPrices) : null;
                          const maxPrice = rowPrices.length > 0 ? Math.max(...rowPrices) : null;

                          return (
                            <TableRow key={rowNumber} sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                              <TableCell>{rowNumber}</TableCell>
                              <TableCell>{row.description}</TableCell>
                              <TableCell>{row.unit}</TableCell>
                              {comparisonTenantEntries.map(([tenantId]) => {
                                const total = getPriceTotal((row.prices as Record<string, PriceCellCompat | undefined>)[tenantId]);
                                const isLowest = total !== null && minPrice !== null && total === minPrice;
                                const isHighest = total !== null && maxPrice !== null && total === maxPrice && maxPrice !== minPrice;

                                return (
                                  <TableCell
                                    key={tenantId}
                                    sx={{
                                      backgroundColor: isLowest ? '#DCFCE7' : isHighest ? '#FEE2E2' : 'transparent',
                                      color: isLowest ? '#166534' : isHighest ? '#B91C1C' : '#111827',
                                      fontWeight: isLowest || isHighest ? 700 : 400,
                                    }}
                                  >
                                    {total === null || total === 0 ? '—' : formatAmount(total)}
                                  </TableCell>
                                );
                              })}
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <TextField
                                    size="small"
                                    value={notes[rowNumber] ?? ''}
                                    onChange={(event) =>
                                      setNotes((current) => ({ ...current, [rowNumber]: event.target.value }))
                                    }
                                    placeholder="Not"
                                    sx={{ minWidth: 160 }}
                                  />
                                  <FormButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleSaveNote(rowNumber)}
                                    loading={savingNoteRow === rowNumber}
                                  >
                                    Kaydet
                                  </FormButton>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              )}
            </Stack>
          ) : null}

          {/* ── Tab 3: DEĞERLENDİRME ──────────────────────────────────────────── */}
          {activeTab === 3 ? (
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AssignmentTurnedInIcon sx={{ color: '#1E3A5F' }} />
                  <Typography variant="h6" fontWeight={600}>Değerlendirme</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sistem önerilerini inceleyin ve kalemleri firmalara atayın.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleApplyRecommendations}
                    disabled={awardRows.length === 0}
                  >
                    Tümünü Öneriye Göre Ata
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<SaveIcon />}
                    onClick={() => { void handleSaveAwards(); }}
                    disabled={savingAwards || awardRows.length === 0}
                  >
                    Kaydet
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<GavelIcon />}
                    onClick={() => setConfirmFinalizeOpen(true)}
                    disabled={finalizing || !hasAllAwardStatuses || tender?.status === 'awarded'}
                  >
                    İhaleyi Sonlandır
                  </Button>
                </Box>
              </Box>

              {awardRows.length === 0 ? (
                <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Değerlendirme için önce karşılaştırma çalıştırın.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Tanım</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Sistem Önerisi</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Atanan Firma</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Durum</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Not</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {awardRows.map((row) => {
                        const recommendationMeta = getRecommendationMeta(row.recommendationType);

                        return (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.description}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'grid', gap: 0.5 }}>
                                <Chip
                                  size="small"
                                  label={recommendationMeta.label}
                                  sx={{
                                    width: 'fit-content',
                                    backgroundColor: recommendationMeta.backgroundColor,
                                    color: recommendationMeta.color,
                                    fontWeight: 700,
                                    fontSize: '11px',
                                  }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {row.recommendationNote}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                fullWidth
                                value={row.awardedTenantId ?? ''}
                                onChange={(event) =>
                                  handleChangeAwardRow(row.rowNumber, (current) => ({
                                    ...current,
                                    awardedTenantId: event.target.value ? String(event.target.value) : null,
                                  }))
                                }
                              >
                                <MenuItem value="">—</MenuItem>
                                {Object.entries(tenantNames).map(([tenantId, tenantName]) => (
                                  <MenuItem key={tenantId} value={tenantId}>{tenantName}</MenuItem>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={row.status}
                                onChange={(event) =>
                                  handleChangeAwardRow(row.rowNumber, (current) => ({
                                    ...current,
                                    status: event.target.value as AwardItemStatus | '',
                                  }))
                                }
                              >
                                <MenuItem value="">Durum seçin</MenuItem>
                                {awardStatusOptions.map((option) => (
                                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                value={row.note}
                                onChange={(event) =>
                                  handleChangeAwardRow(row.rowNumber, (current) => ({
                                    ...current,
                                    note: event.target.value,
                                  }))
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          ) : null}

          {/* ── Tab 4: AUDİT LOG ──────────────────────────────────────────────── */}
          {activeTab === 4 ? (
            <Stack spacing={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <HistoryIcon sx={{ color: '#1E3A5F' }} />
                <Typography variant="h6" fontWeight={600}>Aktivite Geçmişi</Typography>
              </Box>
              {auditLogs.length === 0 ? (
                <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Henüz aktivite kaydı bulunmuyor.
                  </Typography>
                </Paper>
              ) : (
                auditLogs.map((log) => (
                  <Box
                    key={log.id}
                    sx={{ display: 'flex', gap: 2, pb: 2, mb: 1, borderBottom: '1px solid #f1f5f9' }}
                  >
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      backgroundColor: '#e8f0f7', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <HistoryIcon sx={{ color: '#1E3A5F', fontSize: 18 }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{auditActionLabel(log.action)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(log.createdAt).toLocaleString('tr-TR')} · {log.createdByName ?? log.createdBy}
                      </Typography>
                      {log.details && formatLogDetails(log.details) && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formatLogDetails(log.details)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </Stack>
          ) : null}

        </Box>
      </Paper>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      <ConfirmationDialog
        open={!!deleteTarget}
        title="Dosya Sil"
        description="Bu teklif dosyasını silmek istediğinize emin misiniz?"
        onConfirm={handleDeleteFile}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteTarget ? deletingTenantId === deleteTarget.tenantId : false}
        confirmLabel="Sil"
      />
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
