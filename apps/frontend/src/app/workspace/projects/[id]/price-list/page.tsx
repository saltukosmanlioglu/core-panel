'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import type { PriceList } from '@core-panel/shared';
import { downloadPriceListExcelApi, getPriceListApi } from '@/services/price-list/api';

const fmt = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export default function PriceListPage() {
  const params = useParams();
  const projectId = String(params.id);

  const [data, setData] = useState<PriceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kdvRate, setKdvRate] = useState(20);
  const [kdvInput, setKdvInput] = useState('20');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPriceListApi(projectId, kdvRate)
      .then(setData)
      .catch(() => setError('Fiyat listesi yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [projectId, kdvRate]);

  const derived = useMemo(() => {
    if (!data) return null;
    const rate = kdvRate;
    const tenants = data.tenants.map((t) => ({
      ...t,
      total: t.tenders.reduce((s, td) => s + td.tenderTotal, 0),
      totalWithKdv: t.tenders.reduce((s, td) => s + td.tenderTotal, 0) * (1 + rate / 100),
    }));
    const grandTotal = tenants.reduce((s, t) => s + t.total, 0);
    return { tenants, grandTotal, grandTotalWithKdv: grandTotal * (1 + rate / 100) };
  }, [data, kdvRate]);

  async function handleExcelExport() {
    setExporting(true);
    try {
      await downloadPriceListExcelApi(projectId, kdvRate);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!data || data.tenants.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">Henüz kazanılmış ihale bulunmuyor.</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Fiyat listesi oluşturmak için en az bir ihale sonuçlandırılmış olmalıdır.
        </Typography>
      </Box>
    );
  }

  const d = derived!;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>Toplu Fiyat Listesi</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="KDV (%)"
            size="small"
            type="number"
            value={kdvInput}
            onChange={(e) => setKdvInput(e.target.value)}
            onBlur={() => {
              const v = Math.max(0, Math.min(100, Number(kdvInput) || 0));
              setKdvInput(String(v));
              setKdvRate(v);
            }}
            inputProps={{ min: 0, max: 100, step: 1 }}
            sx={{ width: 100 }}
          />
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={{ textTransform: 'none' }}
          >
            PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExcelExport}
            disabled={exporting}
            sx={{ textTransform: 'none', backgroundColor: '#10b981', '&:hover': { backgroundColor: '#059669' } }}
          >
            {exporting ? 'İndiriliyor...' : 'Excel İndir'}
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <SummaryCard label="Toplam (KDV Hariç)" value={fmt(d.grandTotal)} color="#1F2937" />
        <SummaryCard label={`KDV Tutarı (%${kdvRate})`} value={fmt(d.grandTotalWithKdv - d.grandTotal)} color="#f59e0b" />
        <SummaryCard label="Genel Toplam (KDV Dahil)" value={fmt(d.grandTotalWithKdv)} color="#10b981" />
        <SummaryCard label="Taşeron Sayısı" value={String(d.tenants.length)} color="#0ea5e9" />
      </Box>

      {/* Tenant Accordions */}
      {d.tenants.map((tenant) => (
        <Accordion key={tenant.tenantId} defaultExpanded sx={{ mb: 1, '&:before': { display: 'none' }, border: '1px solid #E5E7EB', borderRadius: '8px !important' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Box>
                <Typography fontWeight={600}>{tenant.tenantName}</Typography>
                {tenant.contactName && (
                  <Typography variant="caption" color="text.secondary">{tenant.contactName}</Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">{fmt(tenant.total)}</Typography>
                <Typography variant="body2" fontWeight={600} color="#10b981">
                  {fmt(tenant.totalWithKdv)} <span style={{ fontWeight: 400, fontSize: 11 }}>KDV Dahil</span>
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {tenant.tenders.map((tender) => (
              <Box key={tender.tenderId} sx={{ borderTop: '1px solid #F3F4F6' }}>
                <Box sx={{ px: 2, py: 1, backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{tender.tenderTitle}</Typography>
                    {tender.categoryName && (
                      <Typography variant="caption" color="text.secondary">{tender.categoryName}</Typography>
                    )}
                  </Box>
                  <Typography variant="body2" fontWeight={600}>{fmt(tender.tenderTotal)}</Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 600, fontSize: 12, color: '#6B7280', backgroundColor: '#F9FAFB' } }}>
                      <TableCell>#</TableCell>
                      <TableCell>Açıklama</TableCell>
                      <TableCell>Birim</TableCell>
                      <TableCell align="right">Miktar</TableCell>
                      <TableCell align="right">Birim Fiyat</TableCell>
                      <TableCell align="right">Toplam</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tender.items.map((item) => (
                      <TableRow key={item.siraNo} hover>
                        <TableCell sx={{ width: 40, color: '#9CA3AF', fontSize: 12 }}>{item.siraNo}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.note && <Typography variant="caption" color="text.secondary">{item.note}</Typography>}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{item.unit}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12 }}>{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(item.unitPrice)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500, fontSize: 12 }}>{fmt(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Grand Total */}
      <Box sx={{ mt: 3, p: 2, border: '2px solid #10b981', borderRadius: 2, backgroundColor: '#F0FDF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={700}>Genel Toplam</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">KDV Hariç: {fmt(d.grandTotal)}</Typography>
          <Typography variant="h6" fontWeight={700} color="#10b981">KDV Dahil: {fmt(d.grandTotalWithKdv)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700} sx={{ color, mt: 0.5 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
