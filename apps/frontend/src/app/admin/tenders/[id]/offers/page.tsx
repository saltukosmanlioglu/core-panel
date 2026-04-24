'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Box,
  Card,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { getTenderComparison, runTenderComparison } from '@/services/tender-comparisons/api';
import { getTenderApi } from '@/services/workspace/api';
import type { ComparisonPriceCell, Tender, TenderComparison } from '@core-panel/shared';

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

function formatMoney(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getFallbackCell(): ComparisonPriceCell {
  return {
    price: null,
    isCheapest: false,
    isMostExpensive: false,
  };
}

export default function AdminTenderOffersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tender, setTender] = useState<Tender | null>(null);
  const [comparison, setComparison] = useState<TenderComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRunComparison = async () => {
    try {
      setRerunning(true);
      const nextComparison = await runTenderComparison(id);
      setComparison(nextComparison);
      setSnackbar({
        open: true,
        message: 'AI comparison completed',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'AI comparison could not be run'),
        severity: 'error',
      });
    } finally {
      setRerunning(false);
    }
  };

  const result = comparison?.resultJson ?? null;
  const tenantEntries = useMemo(
    () => Object.entries(result?.tenantNames ?? {}).sort((left, right) => left[1].localeCompare(right[1], 'tr')),
    [result],
  );
  const totalValues = tenantEntries.map(([tenantId]) => result?.totals?.[tenantId] ?? 0);
  const minTotal = totalValues.length > 0 ? Math.min(...totalValues) : null;
  const maxTotal = totalValues.length > 0 ? Math.max(...totalValues) : null;

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton
          variant="ghost"
          size="sm"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => router.push(`/admin/tenders/${id}`)}
        >
          Geri
        </FormButton>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', mb: 4, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            {loading ? 'Karşılaştırma Yükleniyor...' : tender?.title ?? 'İhale'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            {comparison?.updatedAt
              ? `Son karşılaştırma: ${new Date(comparison.updatedAt).toLocaleString('tr-TR')}`
              : 'Henüz karşılaştırma çalıştırılmadı'}
          </Typography>
        </Box>
        <FormButton
          variant="secondary"
          size="sm"
          startIcon={rerunning ? undefined : <RefreshIcon sx={{ fontSize: 16 }} />}
          onClick={handleRunComparison}
          loading={rerunning}
        >
          Karşılaştırmayı Yeniden Çalıştır
        </FormButton>
      </Box>

      <Card sx={{ p: 4 }}>
        {loading ? (
          <Box className="flex justify-center py-10">
            <CircularProgress size={32} />
          </Box>
        ) : !comparison ? (
          <Box sx={{ display: 'grid', gap: 2, justifyItems: 'start' }}>
            <Typography variant="body1" sx={{ color: '#111827', fontWeight: 600 }}>
              Henüz AI karşılaştırması yok
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Önce teklif dosyalarını yükleyin, ardından karşılaştırmayı çalıştırın.
            </Typography>
            <FormButton
              variant="primary"
              size="sm"
              startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
              onClick={handleRunComparison}
              loading={rerunning}
            >
              Run AI Comparison
            </FormButton>
          </Box>
        ) : comparison.status === 'pending' ? (
          <Box sx={{ display: 'grid', gap: 2, justifyItems: 'center', py: 8 }}>
            <CircularProgress size={32} />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              AI dosyaları analiz ediyor...
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Karşılaştırma tamamlandığında bu sayfayı yenileyebilirsiniz.
            </Typography>
          </Box>
        ) : comparison.status === 'failed' ? (
          <Box sx={{ display: 'grid', gap: 2, justifyItems: 'start' }}>
            <Typography variant="body1" sx={{ color: '#991B1B', fontWeight: 600 }}>
              Karşılaştırma başarısız oldu
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              {comparison.errorMessage ?? 'Anthropic comparison could not be completed.'}
            </Typography>
            <FormButton
              variant="secondary"
              size="sm"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={handleRunComparison}
              loading={rerunning}
            >
              Tekrar Dene
            </FormButton>
          </Box>
        ) : !result || tenantEntries.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Karşılaştırma sonucu boş döndü.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700, minWidth: 260 }}>Tanım</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Birim</TableCell>
                  {tenantEntries.map(([tenantId, tenantName]) => (
                    <TableCell key={tenantId} sx={{ fontWeight: 700, minWidth: 160 }}>
                      {tenantName}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {result.rows.map((row, index) => (
                  <TableRow key={`${row.description}-${index}`} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{row.description}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    {tenantEntries.map(([tenantId]) => {
                      const cell = row.prices[tenantId] ?? getFallbackCell();

                      return (
                        <TableCell
                          key={`${row.description}-${tenantId}`}
                          sx={{
                            backgroundColor: cell.isCheapest ? '#DCFCE7' : cell.isMostExpensive ? '#FEE2E2' : 'transparent',
                            color: cell.isCheapest ? '#166534' : cell.isMostExpensive ? '#991B1B' : '#111827',
                            fontWeight: cell.isCheapest || cell.isMostExpensive ? 700 : 500,
                          }}
                        >
                          {formatMoney(cell.price)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Toplam</TableCell>
                  <TableCell />
                  {tenantEntries.map(([tenantId]) => {
                    const total = result.totals[tenantId] ?? 0;
                    const isMin = minTotal !== null && total === minTotal;
                    const isMax = maxTotal !== null && total === maxTotal && maxTotal !== minTotal;

                    return (
                      <TableCell
                        key={`total-${tenantId}`}
                        sx={{
                          backgroundColor: isMin ? '#DCFCE7' : isMax ? '#FEE2E2' : 'transparent',
                          color: isMin ? '#166534' : isMax ? '#991B1B' : '#111827',
                          fontWeight: 700,
                        }}
                      >
                        {formatMoney(total)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
}
