'use client';

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Popover,
  Stack,
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
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  DeleteOutline as DeleteOutlineIcon,
  DownloadOutlined as DownloadOutlinedIcon,
  EditOutlined as EditOutlinedIcon,
  EmojiEventsOutlined as EmojiEventsOutlinedIcon,
  MonetizationOnOutlined as MonetizationOnOutlinedIcon,
  Refresh as RefreshIcon,
  SavingsOutlined as SavingsOutlinedIcon,
  TrendingDownOutlined as TrendingDownOutlinedIcon,
  TrendingUpOutlined as TrendingUpOutlinedIcon,
} from '@mui/icons-material';
import { ConfirmationDialog, Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { getTenderComparison, runTenderComparison } from '@/services/tender-comparisons/api';
import {
  deleteTenderItemNote,
  getTenderItemNotes,
  type TenderItemNoteDto,
  upsertTenderItemNote,
} from '@/services/tender-item-notes/api';
import { getTenderApi } from '@/services/workspace/api';
import type {
  ComparisonPriceCell,
  ComparisonResult,
  ComparisonSummary,
  Tender,
  TenderComparison,
} from '@core-panel/shared';

const COLORS = {
  primaryNavy: '#0f172a',
  accentBlue: '#3b82f6',
  successGreen: '#16a34a',
  warningOrange: '#ea580c',
  dangerRed: '#dc2626',
  gold: '#ca8a04',
  surface: '#f8fafc',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  white: '#ffffff',
};

const TENANT_ACCENT_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#10b981', '#ec4899'];

type ComparisonPriceCellCompat = ComparisonPriceCell & {
  price?: number | null;
};

interface NoteEditorState {
  anchorEl: HTMLElement | null;
  siraNo: number | null;
  value: string;
}

const EMPTY_SUMMARY: ComparisonSummary = {
  potentialSavings: 0,
  minimumPossibleTotal: 0,
  maximumPossibleTotal: 0,
  tenantStats: {},
};

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
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

function formatOptionalAmount(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) {
    return '—';
  }

  return formatAmount(value);
}

function truncateText(value: string, maxLength = 50): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function getCellTutar(cell: ComparisonPriceCellCompat): number | null {
  if (typeof cell.tutar === 'number') {
    return cell.tutar;
  }

  return typeof cell.price === 'number' ? cell.price : null;
}

function normalizeCell(cell?: ComparisonPriceCellCompat): ComparisonPriceCell {
  const tutar = cell ? getCellTutar(cell) : null;

  return {
    malzemeBirimFiyat: cell?.malzemeBirimFiyat ?? null,
    isciliikBirimFiyat: cell?.isciliikBirimFiyat ?? null,
    hasMalzemeIscilikAyri: cell?.hasMalzemeIscilikAyri ?? false,
    tutar,
    isCheapest: false,
    isMostExpensive: false,
  };
}

function buildVisibleComparison(
  result: ComparisonResult | null,
  selectedTenantIds: string[],
): ComparisonResult | null {
  if (!result) {
    return null;
  }

  const tenantIds = selectedTenantIds.filter((tenantId) => tenantId in result.tenantNames);
  const tenantNames = Object.fromEntries(
    tenantIds.map((tenantId) => [tenantId, result.tenantNames[tenantId]]),
  ) as Record<string, string>;
  const rows = result.rows.map((row) => {
    const prices = Object.fromEntries(
      tenantIds.map((tenantId) => [
        tenantId,
        normalizeCell((row.prices as Record<string, ComparisonPriceCellCompat | undefined>)[tenantId]),
      ]),
    ) as Record<string, ComparisonPriceCell>;
    const validPrices = tenantIds
      .map((tenantId) => ({ tenantId, tutar: prices[tenantId]?.tutar ?? null }))
      .filter((item): item is { tenantId: string; tutar: number } => item.tutar !== null && item.tutar > 0);

    if (validPrices.length > 1) {
      const minPrice = Math.min(...validPrices.map((item) => item.tutar));
      const maxPrice = Math.max(...validPrices.map((item) => item.tutar));

      for (const { tenantId, tutar } of validPrices) {
        prices[tenantId].isCheapest = tutar === minPrice;
        prices[tenantId].isMostExpensive = tutar === maxPrice;
      }
    }

    return {
      ...row,
      prices,
    };
  });

  const totals = Object.fromEntries(tenantIds.map((tenantId) => [tenantId, 0])) as Record<string, number>;
  for (const row of rows) {
    for (const tenantId of tenantIds) {
      const tutar = row.prices[tenantId]?.tutar;
      if (tutar && tutar > 0) {
        totals[tenantId] += tutar;
      }
    }
  }

  const cheapestTenantId = Object.entries(totals)
    .filter(([, total]) => total > 0)
    .sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;

  let minimumPossibleTotal = 0;
  let maximumPossibleTotal = 0;
  const tenantStats = Object.fromEntries(
    tenantIds.map((tenantId) => [
      tenantId,
      {
        cheapestCount: 0,
        mostExpensiveCount: 0,
        missingItems: 0,
      },
    ]),
  ) as ComparisonSummary['tenantStats'];

  for (const row of rows) {
    const validPrices = Object.entries(row.prices)
      .filter(([, cell]) => cell.tutar !== null && cell.tutar > 0)
      .map(([tenantId, cell]) => ({ tenantId, tutar: cell.tutar as number }));

    if (validPrices.length > 0) {
      minimumPossibleTotal += Math.min(...validPrices.map((item) => item.tutar));
      maximumPossibleTotal += Math.max(...validPrices.map((item) => item.tutar));
    }

    for (const [tenantId, cell] of Object.entries(row.prices)) {
      const stats = tenantStats[tenantId];
      if (!stats) {
        continue;
      }

      if (cell.isCheapest) {
        stats.cheapestCount += 1;
      }

      if (cell.isMostExpensive) {
        stats.mostExpensiveCount += 1;
      }

      if (cell.tutar === null || cell.tutar === 0) {
        stats.missingItems += 1;
      }
    }
  }

  return {
    rows,
    totals,
    cheapestTenantId,
    tenantNames,
    summary: {
      potentialSavings: maximumPossibleTotal - minimumPossibleTotal,
      minimumPossibleTotal,
      maximumPossibleTotal,
      tenantStats,
    },
  };
}

function SummaryCard(props: {
  title: string;
  value: string;
  subtitle: string;
  accentColor: string;
  backgroundColor: string;
  icon: JSX.Element;
}) {
  const { title, value, subtitle, accentColor, backgroundColor, icon } = props;

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `4px solid ${accentColor}`,
        backgroundColor,
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '12px',
              backgroundColor: COLORS.white,
              color: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ color: COLORS.textPrimary, fontWeight: 800, mb: 1.25 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: COLORS.textSecondary, lineHeight: 1.5 }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function AdminTenderOffersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tender, setTender] = useState<Tender | null>(null);
  const [comparison, setComparison] = useState<TenderComparison | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState(false);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState>({
    anchorEl: null,
    siraNo: null,
    value: '',
  });
  const [deleteDialogSiraNo, setDeleteDialogSiraNo] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [tenderData, comparisonData] = await Promise.all([
        getTenderApi(id),
        getTenderComparison(id),
      ]);

      setTender(tenderData);
      setComparison(comparisonData);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Comparison data could not be loaded'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const noteItems = await getTenderItemNotes(id);
      const nextNotes: Record<number, string> = {};

      for (const item of noteItems as TenderItemNoteDto[]) {
        nextNotes[item.siraNo] = item.note;
      }

      setNotes(nextNotes);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kalem notları yüklenemedi'),
        severity: 'error',
      });
    } finally {
      setNotesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const rawResult = comparison?.resultJson as ComparisonResult | null;
  const allTenantEntries = useMemo(
    () => Object.entries(rawResult?.tenantNames ?? {}).sort((left, right) => left[1].localeCompare(right[1], 'tr')),
    [rawResult],
  );

  useEffect(() => {
    const tenantIds = allTenantEntries.map(([tenantId]) => tenantId);

    if (!selectionInitialized && tenantIds.length > 0) {
      setSelectedTenantIds(tenantIds);
      setSelectionInitialized(true);
      return;
    }

    if (!selectionInitialized) {
      return;
    }

    setSelectedTenantIds((current) => current.filter((tenantId) => tenantIds.includes(tenantId)));
  }, [allTenantEntries, selectionInitialized]);

  const visibleResult = useMemo(
    () => buildVisibleComparison(rawResult, selectedTenantIds),
    [rawResult, selectedTenantIds],
  );
  const summary = visibleResult?.summary ?? EMPTY_SUMMARY;
  const visibleTenantEntries = useMemo(
    () => allTenantEntries.filter(([tenantId]) => tenantId in (visibleResult?.tenantNames ?? {})),
    [allTenantEntries, visibleResult],
  );
  const tenantColumnModes = useMemo(
    () =>
      Object.fromEntries(
        visibleTenantEntries.map(([tenantId]) => [
          tenantId,
          visibleResult?.rows.some((row) => row.prices[tenantId]?.hasMalzemeIscilikAyri) ?? false,
        ]),
      ) as Record<string, boolean>,
    [visibleResult, visibleTenantEntries],
  );
  const totalValues = visibleTenantEntries.map(([tenantId]) => visibleResult?.totals?.[tenantId] ?? 0);
  const minTotal = totalValues.length > 0 ? Math.min(...totalValues) : null;
  const maxTotal = totalValues.length > 0 ? Math.max(...totalValues) : null;
  const tableMinWidth = useMemo(
    () => visibleTenantEntries.reduce((width, [tenantId]) => width + (tenantColumnModes[tenantId] ? 300 : 150), 860),
    [tenantColumnModes, visibleTenantEntries],
  );
  const cheapestTenantName = visibleResult?.cheapestTenantId
    ? (visibleResult.tenantNames[visibleResult.cheapestTenantId] ?? '—')
    : '—';

  const handleRunComparison = async () => {
    try {
      setRerunning(true);
      const nextComparison = await runTenderComparison(id);
      setComparison(nextComparison);
      setSnackbar({ open: true, message: 'Karşılaştırma tamamlandı', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Karşılaştırma çalıştırılamadı'),
        severity: 'error',
      });
    } finally {
      setRerunning(false);
    }
  };

  const handleTenantToggle = (tenantId: string) => {
    setSelectedTenantIds((current) =>
      current.includes(tenantId)
        ? current.filter((idValue) => idValue !== tenantId)
        : [...current, tenantId],
    );
  };

  const handleOpenNoteEditor = (event: MouseEvent<HTMLElement>, siraNo: number) => {
    setNoteEditor({
      anchorEl: event.currentTarget,
      siraNo,
      value: notes[siraNo] ?? '',
    });
  };

  const handleCloseNoteEditor = () => {
    if (savingNote) {
      return;
    }

    setNoteEditor({
      anchorEl: null,
      siraNo: null,
      value: '',
    });
  };

  const handleSaveNote = async () => {
    if (noteEditor.siraNo === null) {
      return;
    }

    const nextNote = noteEditor.value.trim();
    if (!nextNote) {
      setSnackbar({
        open: true,
        message: 'Not boş olamaz',
        severity: 'error',
      });
      return;
    }

    try {
      setSavingNote(true);
      await upsertTenderItemNote(id, noteEditor.siraNo, nextNote);
      await loadNotes();
      handleCloseNoteEditor();
      setSnackbar({
        open: true,
        message: 'Not kaydedildi',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Not kaydedilemedi'),
        severity: 'error',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async () => {
    if (deleteDialogSiraNo === null) {
      return;
    }

    try {
      setDeletingNote(true);
      await deleteTenderItemNote(id, deleteDialogSiraNo);
      await loadNotes();
      setDeleteDialogSiraNo(null);
      setSnackbar({
        open: true,
        message: 'Not silindi',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Not silinemedi'),
        severity: 'error',
      });
    } finally {
      setDeletingNote(false);
    }
  };

  return (
    <Box sx={{ backgroundColor: COLORS.surface, minHeight: '100%', p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Card
          sx={{
            borderRadius: 3,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 16px 36px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ height: 8, background: 'linear-gradient(90deg, #0f172a 0%, #3b82f6 100%)' }} />
          <CardContent sx={{ p: { xs: 2.5, md: 3 }, '&:last-child': { pb: { xs: 2.5, md: 3 } } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                flexDirection: { xs: 'column', lg: 'row' },
                alignItems: { xs: 'flex-start', lg: 'center' },
              }}
            >
              <Box>
                <FormButton
                  variant="ghost"
                  size="sm"
                  startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                  onClick={() => router.push(`/admin/tenders/${id}`)}
                  sx={{ px: 0, mb: 2, color: COLORS.textSecondary, '&:hover': { backgroundColor: 'transparent', color: COLORS.primaryNavy } }}
                >
                  Geri
                </FormButton>
                <Typography variant="h4" sx={{ fontWeight: 800, color: COLORS.textPrimary, mb: 0.75, fontSize: { xs: 28, md: 34 } }}>
                  {(loading ? 'Karşılaştırma Yükleniyor...' : tender?.title ?? 'İhale')} — Teklif Karşılaştırması
                </Typography>
                <Typography variant="body1" sx={{ color: COLORS.textSecondary }}>
                  {comparison?.updatedAt
                    ? `Son karşılaştırma: ${new Date(comparison.updatedAt).toLocaleString('tr-TR')}`
                    : 'Henüz karşılaştırma çalıştırılmadı'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' } }}>
                <FormButton
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/admin/tenders/${id}/award`)}
                  sx={{
                    backgroundColor: COLORS.primaryNavy,
                    '&:hover': { backgroundColor: '#111827' },
                  }}
                >
                  İhaleyi Değerlendir
                </FormButton>
                <FormButton
                  variant="secondary"
                  size="sm"
                  startIcon={rerunning ? undefined : <RefreshIcon sx={{ fontSize: 16 }} />}
                  onClick={handleRunComparison}
                  loading={rerunning}
                  sx={{
                    borderColor: COLORS.accentBlue,
                    color: COLORS.accentBlue,
                    '&:hover': { borderColor: COLORS.accentBlue, backgroundColor: '#eff6ff' },
                  }}
                >
                  Karşılaştırmayı Yeniden Çalıştır
                </FormButton>
                <Tooltip title="Excel indirme işlevi bu görsel yenileme kapsamında eklenmedi">
                  <Box component="span">
                    <FormButton
                      variant="secondary"
                      size="sm"
                      startIcon={<DownloadOutlinedIcon sx={{ fontSize: 16 }} />}
                      disabled
                      sx={{
                        borderColor: COLORS.border,
                        color: COLORS.textSecondary,
                      }}
                    >
                      Excel İndir
                    </FormButton>
                  </Box>
                </Tooltip>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: 3,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress size={32} />
              </Box>
            ) : !comparison ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  justifyItems: 'start',
                  p: { xs: 1, md: 2 },
                  borderRadius: 3,
                  backgroundColor: '#f8fafc',
                }}
              >
                <Typography variant="h6" sx={{ color: COLORS.textPrimary, fontWeight: 800 }}>
                  Henüz karşılaştırma yok
                </Typography>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                  Önce teklif dosyalarını yükleyin, ardından karşılaştırmayı çalıştırın.
                </Typography>
                <FormButton
                  variant="primary"
                  size="sm"
                  startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                  onClick={handleRunComparison}
                  loading={rerunning}
                  sx={{
                    backgroundColor: COLORS.primaryNavy,
                    '&:hover': { backgroundColor: '#111827' },
                  }}
                >
                  Karşılaştırmayı Çalıştır
                </FormButton>
              </Box>
            ) : comparison.status === 'pending' ? (
              <Box sx={{ display: 'grid', gap: 2, justifyItems: 'center', py: 10 }}>
                <CircularProgress size={32} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.textPrimary }}>
                  Teklif dosyaları analiz ediliyor...
                </Typography>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                  Karşılaştırma tamamlandığında bu sayfayı yenileyebilirsiniz.
                </Typography>
              </Box>
            ) : comparison.status === 'failed' ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  justifyItems: 'start',
                  p: { xs: 1, md: 2 },
                  borderRadius: 3,
                  backgroundColor: '#fff7ed',
                }}
              >
                <Typography variant="h6" sx={{ color: COLORS.warningOrange, fontWeight: 800 }}>
                  Karşılaştırma başarısız oldu
                </Typography>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                  {comparison.errorMessage ?? 'Karşılaştırma tamamlanamadı.'}
                </Typography>
                <FormButton
                  variant="secondary"
                  size="sm"
                  startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                  onClick={handleRunComparison}
                  loading={rerunning}
                  sx={{
                    borderColor: COLORS.warningOrange,
                    color: COLORS.warningOrange,
                    '&:hover': { borderColor: COLORS.warningOrange, backgroundColor: '#fff7ed' },
                  }}
                >
                  Tekrar Dene
                </FormButton>
              </Box>
            ) : !visibleResult ? (
              <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                Karşılaştırma sonucu boş döndü.
              </Typography>
            ) : (
              <Stack spacing={3}>
                <Card
                  sx={{
                    borderRadius: 3,
                    border: `1px solid ${COLORS.border}`,
                    backgroundColor: '#fbfdff',
                    boxShadow: 'none',
                  }}
                >
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Typography variant="body1" sx={{ color: COLORS.textPrimary, fontWeight: 800, mb: 1.5 }}>
                      Firmalar
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                      {allTenantEntries.map(([tenantId, tenantName]) => {
                        const selected = selectedTenantIds.includes(tenantId);

                        return (
                          <Chip
                            key={tenantId}
                            label={tenantName}
                            clickable
                            onClick={() => handleTenantToggle(tenantId)}
                            variant={selected ? 'filled' : 'outlined'}
                            sx={{
                              borderRadius: '999px',
                              fontWeight: 700,
                              backgroundColor: selected ? COLORS.accentBlue : COLORS.white,
                              color: selected ? COLORS.white : COLORS.textPrimary,
                              borderColor: selected ? COLORS.accentBlue : COLORS.border,
                              '& .MuiChip-deleteIcon': {
                                color: selected ? COLORS.white : COLORS.textSecondary,
                              },
                            }}
                          />
                        );
                      })}
                    </Box>
                    <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                      {visibleTenantEntries.length} firma gösteriliyor
                    </Typography>
                  </CardContent>
                </Card>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      xl: 'repeat(4, minmax(0, 1fr))',
                    },
                  }}
                >
                  <SummaryCard
                    title="Potansiyel Tasarruf"
                    value={formatCurrency(summary.potentialSavings)}
                    subtitle="En pahalı ile en ucuz arasındaki fark"
                    accentColor={COLORS.successGreen}
                    backgroundColor="#f0fdf4"
                    icon={<SavingsOutlinedIcon sx={{ fontSize: 20 }} />}
                  />
                  <SummaryCard
                    title="Minimum Toplam"
                    value={formatCurrency(summary.minimumPossibleTotal)}
                    subtitle="Her kalemde en ucuzu seçerek"
                    accentColor={COLORS.accentBlue}
                    backgroundColor="#eff6ff"
                    icon={<TrendingDownOutlinedIcon sx={{ fontSize: 20 }} />}
                  />
                  <SummaryCard
                    title="Maksimum Toplam"
                    value={formatCurrency(summary.maximumPossibleTotal)}
                    subtitle="Her kalemde en pahalıyı seçerek"
                    accentColor={COLORS.dangerRed}
                    backgroundColor="#fef2f2"
                    icon={<TrendingUpOutlinedIcon sx={{ fontSize: 20 }} />}
                  />
                  <SummaryCard
                    title="En Avantajlı Firma"
                    value={cheapestTenantName}
                    subtitle="En düşük toplam teklif"
                    accentColor={COLORS.gold}
                    backgroundColor="#fefce8"
                    icon={<EmojiEventsOutlinedIcon sx={{ fontSize: 20 }} />}
                  />
                </Box>

                <Card
                  sx={{
                    borderRadius: 3,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: 'none',
                  }}
                >
                  <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <Box sx={{ px: 2.5, py: 2 }}>
                      <Typography variant="h6" sx={{ color: COLORS.textPrimary, fontWeight: 800 }}>
                        Firma Özeti
                      </Typography>
                    </Box>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary }}>Firma</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary }}>En Ucuz</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary }}>En Pahalı</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary }}>Eksik</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary }}>Toplam</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleTenantEntries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5}>
                                <Typography variant="body2" sx={{ color: COLORS.textSecondary, py: 1 }}>
                                  Görüntülenecek firma seçilmedi.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            visibleTenantEntries.map(([tenantId, tenantName], index) => {
                              const stats = summary.tenantStats[tenantId] ?? {
                                cheapestCount: 0,
                                mostExpensiveCount: 0,
                                missingItems: 0,
                              };
                              const total = visibleResult.totals[tenantId] ?? 0;
                              const accentColor = TENANT_ACCENT_COLORS[index % TENANT_ACCENT_COLORS.length];
                              const isMin = minTotal !== null && total === minTotal;
                              const isMax = maxTotal !== null && total === maxTotal && maxTotal !== minTotal;

                              return (
                                <TableRow key={tenantId}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Box
                                        sx={{
                                          width: 10,
                                          height: 10,
                                          borderRadius: '999px',
                                          backgroundColor: accentColor,
                                          flexShrink: 0,
                                        }}
                                      />
                                      <Typography variant="body2" sx={{ color: COLORS.textPrimary, fontWeight: 700 }}>
                                        {tenantName}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>{stats.cheapestCount}</TableCell>
                                  <TableCell>{stats.mostExpensiveCount}</TableCell>
                                  <TableCell>{stats.missingItems}</TableCell>
                                  <TableCell
                                    sx={{
                                      fontWeight: 800,
                                      color: isMin ? COLORS.successGreen : isMax ? COLORS.dangerRed : COLORS.textPrimary,
                                    }}
                                  >
                                    {formatCurrency(total)}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                <Card
                  sx={{
                    borderRadius: 3,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: 'none',
                    overflow: 'hidden',
                  }}
                >
                  <TableContainer
                    sx={{
                      maxHeight: 600,
                      overflowX: 'auto',
                      '& .MuiTableCell-stickyHeader': {
                        backgroundColor: COLORS.white,
                        zIndex: 2,
                      },
                    }}
                  >
                    <Table size="small" stickyHeader sx={{ minWidth: tableMinWidth }}>
                      <TableHead>
                        <TableRow>
                          <TableCell rowSpan={2} sx={{ fontWeight: 800, width: 40, color: COLORS.textPrimary }}>
                            #
                          </TableCell>
                          <TableCell rowSpan={2} sx={{ fontWeight: 800, minWidth: 240, color: COLORS.textPrimary }}>
                            Tanım
                          </TableCell>
                          <TableCell rowSpan={2} sx={{ fontWeight: 800, width: 60, color: COLORS.textPrimary }}>
                            Birim
                          </TableCell>
                          {visibleTenantEntries.map(([tenantId, tenantName], index) => (
                            <TableCell
                              key={tenantId}
                              align="center"
                              colSpan={tenantColumnModes[tenantId] ? 3 : 1}
                              sx={{
                                fontWeight: 800,
                                color: COLORS.textPrimary,
                                minWidth: tenantColumnModes[tenantId] ? 270 : 140,
                                borderTop: `4px solid ${TENANT_ACCENT_COLORS[index % TENANT_ACCENT_COLORS.length]}`,
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {tenantName}
                              </Typography>
                            </TableCell>
                          ))}
                          <TableCell rowSpan={2} sx={{ fontWeight: 800, minWidth: 220, color: COLORS.textPrimary }}>
                            Not
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          {visibleTenantEntries.flatMap(([tenantId]) =>
                            tenantColumnModes[tenantId]
                              ? [
                                  <TableCell key={`${tenantId}-material`} sx={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 700, minWidth: 90 }}>
                                    Malzeme
                                  </TableCell>,
                                  <TableCell key={`${tenantId}-labor`} sx={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 700, minWidth: 90 }}>
                                    İşçilik
                                  </TableCell>,
                                  <TableCell key={`${tenantId}-total`} sx={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 700, minWidth: 90 }}>
                                    Tutar
                                  </TableCell>,
                                ]
                              : [
                                  <TableCell key={`${tenantId}-single-total`} sx={{ minWidth: 120 }}>
                                    <Box sx={{ display: 'grid', gap: 0.2 }}>
                                      <Typography variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: 700 }}>
                                        Tutar
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        Malzeme dahil
                                      </Typography>
                                    </Box>
                                  </TableCell>,
                                ],
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleResult.rows.map((row) => {
                          const note = notes[row.siraNo];

                          return (
                            <TableRow
                              key={row.siraNo}
                              hover
                              sx={{
                                '&:nth-of-type(odd)': { backgroundColor: '#f8fafc' },
                                '&:hover .note-action': { opacity: 1 },
                              }}
                            >
                              <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary }}>{row.siraNo}</TableCell>
                              <TableCell sx={{ fontWeight: 600, color: COLORS.textPrimary }}>{row.description}</TableCell>
                              <TableCell sx={{ color: COLORS.textSecondary }}>{row.unit}</TableCell>
                              {visibleTenantEntries.flatMap(([tenantId]) => {
                                const cell = normalizeCell((row.prices as Record<string, ComparisonPriceCellCompat | undefined>)[tenantId]);
                                const tutar = cell.tutar;
                                const isMissing = tutar === null || tutar === 0;
                                const totalCellSx = {
                                  backgroundColor: cell.isCheapest ? '#dcfce7' : cell.isMostExpensive ? '#fee2e2' : 'transparent',
                                  color: cell.isCheapest ? COLORS.successGreen : cell.isMostExpensive ? COLORS.dangerRed : COLORS.textPrimary,
                                  fontWeight: cell.isCheapest || cell.isMostExpensive ? 700 : 500,
                                };

                                if (tenantColumnModes[tenantId]) {
                                  return [
                                    <TableCell key={`${row.siraNo}-${tenantId}-material`} sx={{ color: COLORS.textPrimary }}>
                                      {formatOptionalAmount(cell.malzemeBirimFiyat)}
                                    </TableCell>,
                                    <TableCell key={`${row.siraNo}-${tenantId}-labor`} sx={{ color: COLORS.textPrimary }}>
                                      {formatOptionalAmount(cell.isciliikBirimFiyat)}
                                    </TableCell>,
                                    <TableCell key={`${row.siraNo}-${tenantId}-total`} sx={totalCellSx}>
                                      {isMissing ? (
                                        <Tooltip title="Bu firma bu kalemi teklif etmedi">
                                          <Box component="span" sx={{ color: '#94a3b8', fontStyle: 'italic', cursor: 'help' }}>
                                            —
                                          </Box>
                                        </Tooltip>
                                      ) : (
                                        formatAmount(tutar)
                                      )}
                                    </TableCell>,
                                  ];
                                }

                                return [
                                  <TableCell key={`${row.siraNo}-${tenantId}-single-total`} sx={totalCellSx}>
                                    {isMissing ? (
                                      <Tooltip title="Bu firma bu kalemi teklif etmedi">
                                        <Box component="span" sx={{ color: '#94a3b8', fontStyle: 'italic', cursor: 'help' }}>
                                          —
                                        </Box>
                                      </Tooltip>
                                    ) : (
                                      formatAmount(tutar)
                                    )}
                                  </TableCell>,
                                ];
                              })}
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    {notesLoading ? (
                                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                                        Yükleniyor...
                                      </Typography>
                                    ) : note ? (
                                      <Tooltip title={note}>
                                        <Typography
                                          variant="body2"
                                          sx={{
                                            color: COLORS.textSecondary,
                                            fontStyle: 'italic',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                        >
                                          {truncateText(note)}
                                        </Typography>
                                      </Tooltip>
                                    ) : (
                                      <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                        —
                                      </Typography>
                                    )}
                                  </Box>
                                  <Tooltip title={note ? 'Notu düzenle' : 'Not ekle'}>
                                    <IconButton
                                      size="small"
                                      className="note-action"
                                      onClick={(event) => handleOpenNoteEditor(event, row.siraNo)}
                                      sx={{ opacity: 0.85, color: COLORS.textSecondary }}
                                    >
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  {note ? (
                                    <Tooltip title="Notu sil">
                                      <IconButton
                                        size="small"
                                        className="note-action"
                                        onClick={() => setDeleteDialogSiraNo(row.siraNo)}
                                        sx={{ opacity: 0.85, color: COLORS.dangerRed }}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                          <TableCell />
                          <TableCell sx={{ fontWeight: 800, color: COLORS.textPrimary, fontSize: 15 }}>Toplam</TableCell>
                          <TableCell />
                          {visibleTenantEntries.flatMap(([tenantId]) => {
                            const total = visibleResult.totals[tenantId] ?? 0;
                            const isMin = minTotal !== null && total === minTotal;
                            const isMax = maxTotal !== null && total === maxTotal && maxTotal !== minTotal;
                            const totalCell = (
                              <TableCell
                                key={`total-${tenantId}`}
                                sx={{
                                  backgroundColor: isMin ? '#dcfce7' : isMax ? '#fee2e2' : 'transparent',
                                  color: isMin ? COLORS.successGreen : isMax ? COLORS.dangerRed : COLORS.textPrimary,
                                  fontWeight: 800,
                                  fontSize: 15,
                                }}
                              >
                                {formatAmount(total)}
                              </TableCell>
                            );

                            if (tenantColumnModes[tenantId]) {
                              return [
                                <TableCell key={`total-${tenantId}-material`} />,
                                <TableCell key={`total-${tenantId}-labor`} />,
                                totalCell,
                              ];
                            }

                            return [totalCell];
                          })}
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>

                <Alert
                  severity="info"
                  variant="outlined"
                  icon={<MonetizationOnOutlinedIcon fontSize="inherit" />}
                  sx={{
                    borderRadius: 3,
                    borderColor: '#bfdbfe',
                    backgroundColor: '#f8fbff',
                    color: COLORS.textPrimary,
                    '& .MuiAlert-icon': { color: COLORS.accentBlue },
                  }}
                >
                  Malzeme ve İşçilik birim fiyat olarak gösterilmiştir. Tutar = Miktar × (Malzeme + İşçilik)
                </Alert>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Popover
        open={Boolean(noteEditor.anchorEl)}
        anchorEl={noteEditor.anchorEl}
        onClose={handleCloseNoteEditor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
          },
        }}
      >
        <Box sx={{ p: 2.5, width: 360, display: 'grid', gap: 2 }}>
          <Typography variant="body1" sx={{ fontWeight: 800, color: COLORS.textPrimary }}>
            Kalem Notu
          </Typography>
          <TextField
            multiline
            minRows={4}
            value={noteEditor.value}
            onChange={(event) => setNoteEditor((current) => ({ ...current, value: event.target.value }))}
            placeholder="Bu kalem için not ekleyin"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <FormButton variant="ghost" size="sm" onClick={handleCloseNoteEditor} disabled={savingNote}>
              İptal
            </FormButton>
            <FormButton
              variant="primary"
              size="sm"
              onClick={handleSaveNote}
              loading={savingNote}
              sx={{
                backgroundColor: COLORS.primaryNavy,
                '&:hover': { backgroundColor: '#111827' },
              }}
            >
              Kaydet
            </FormButton>
          </Box>
        </Box>
      </Popover>

      <ConfirmationDialog
        open={deleteDialogSiraNo !== null}
        title="Not Silinsin mi?"
        description="Bu kalem notu silinecek. Bu işlem geri alınamaz."
        onCancel={() => setDeleteDialogSiraNo(null)}
        onConfirm={handleDeleteNote}
        loading={deletingNote}
        confirmLabel="Sil"
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
