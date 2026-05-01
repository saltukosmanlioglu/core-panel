'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { GeneralExpense, ProgressPayment, Tenant, TenantPaymentSummary, Tender } from '@core-panel/shared';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  CloudDownload as CloudDownloadIcon,
  DeleteOutline as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FileDownload as FileDownloadIcon,
  Inventory2 as MaterialIcon,
  Payments as PaymentsIcon,
  PrecisionManufacturing as EquipmentIcon,
  ReceiptLong as ReceiptIcon,
  TaskAlt as ApproveIcon,
  Work as LaborIcon,
} from '@mui/icons-material';
import { Notification } from '@/components';
import { getTenantsApi } from '@/services/admin/api';
import { getTendersApi } from '@/services/workspace/api';
import {
  approveProgressPaymentApi,
  createExpenseApi,
  createPaymentTransactionApi,
  createProgressPaymentApi,
  deleteExpenseApi,
  downloadPaymentsExportApi,
  getExpenseSummaryApi,
  getExpensesApi,
  getProgressPaymentsApi,
  getTenantPaymentSummariesApi,
  type ExpensePayload,
  type ProgressPaymentItemPayload,
} from '@/services/payments/api';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getErrorMessage } from '@/utils/getErrorMessage';

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
});

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Taslak', bg: '#F3F4F6', color: '#6B7280' },
  approved: { label: 'Onaylandı', bg: '#DBEAFE', color: '#1D4ED8' },
  paid: { label: 'Ödendi', bg: '#DCFCE7', color: '#15803D' },
  overdue: { label: 'Gecikmiş', bg: '#FEE2E2', color: '#DC2626' },
  pending: { label: 'Bekleyen', bg: '#FEF3C7', color: '#B45309' },
};

const categoryLabels: Record<string, string> = {
  material: 'Malzeme',
  labor: 'İşçilik',
  equipment: 'Ekipman',
  other: 'Diğer',
};

const frequencyLabels: Record<string, string> = {
  weekly: 'Haftalık',
  biweekly: 'İki Haftalık',
  monthly: 'Aylık',
  custom: 'Özel',
  none: 'Yok',
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR');
}

function isOverdue(date: string | null | undefined) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date) < today;
}

function isDueSoon(date: string | null | undefined) {
  if (!date || isOverdue(date)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  return due.getTime() - today.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function uploadUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return `${base}${path}`;
}

function StatusChip({ status }: { status: string }) {
  const style = statusMap[status] ?? statusMap.draft;
  return (
    <Chip
      label={style.label}
      size="small"
      sx={{ bgcolor: style.bg, color: style.color, fontWeight: 800, fontSize: 11 }}
    />
  );
}

function categoryIcon(category: string) {
  const sx = { fontSize: 20 };
  if (category === 'material') return <MaterialIcon sx={{ ...sx, color: '#2563EB' }} />;
  if (category === 'labor') return <LaborIcon sx={{ ...sx, color: '#059669' }} />;
  if (category === 'equipment') return <EquipmentIcon sx={{ ...sx, color: '#B45309' }} />;
  return <ReceiptIcon sx={{ ...sx, color: '#64748B' }} />;
}

function TenantCard({
  summary,
  onDetail,
  onAddTransaction,
  onApprove,
}: {
  summary: TenantPaymentSummary;
  onDetail: () => void;
  onAddTransaction: () => void;
  onApprove: () => void;
}) {
  const paidRatio = summary.totalAmount > 0 ? Math.min(100, (summary.paidAmount / summary.totalAmount) * 100) : 0;
  const progressColor = paidRatio > 80 ? '#16A34A' : paidRatio > 50 ? '#F59E0B' : '#EF4444';
  const dueColor = isOverdue(summary.nextDueDate) ? '#DC2626' : isDueSoon(summary.nextDueDate) ? '#D97706' : '#6B7280';

  return (
    <Card
      sx={{
        aspectRatio: '16 / 9',
        minHeight: 260,
        p: 2,
        display: 'grid',
        gridTemplateRows: '1fr auto auto',
        gap: 1.5,
        position: 'relative',
        overflow: 'hidden',
        '&:hover .payment-actions': { opacity: 1, transform: 'translateY(0)' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>
            {summary.tenantName ?? summary.tenantId}
          </Typography>
          <Typography noWrap sx={{ fontSize: 13, color: '#6B7280', mt: 0.5 }}>
            {summary.contactName ?? 'Yetkili yok'}
          </Typography>
        </Box>
        <StatusChip status={summary.status} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {[
          { label: 'Toplam', value: summary.totalAmount, color: '#111827' },
          { label: 'Ödenen', value: summary.paidAmount, color: '#15803D' },
          { label: 'Kalan', value: summary.remainingAmount, color: summary.overdueAmount > 0 ? '#DC2626' : isDueSoon(summary.nextDueDate) ? '#D97706' : '#4B5563' },
        ].map((metric) => (
          <Box key={metric.label} sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 1, p: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: '#6B7280' }}>{metric.label}</Typography>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 900, color: metric.color }}>{formatCurrency(metric.value)}</Typography>
          </Box>
        ))}
      </Box>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {summary.lastPaymentDate ? `Son ödeme: ${formatDate(summary.lastPaymentDate)}` : 'Ödeme yok'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: dueColor, fontWeight: 800 }}>
            Vade: {formatDate(summary.nextDueDate)}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={paidRatio}
          sx={{ height: 7, borderRadius: 99, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: progressColor } }}
        />
      </Box>

      <Box
        className="payment-actions"
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: 'rgba(17,24,39,0.72)',
          opacity: 0,
          transform: 'translateY(8px)',
          transition: 'opacity 0.16s ease, transform 0.16s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <Button variant="contained" onClick={onDetail}>Detay</Button>
        <Button variant="contained" color="success" onClick={onAddTransaction}>İşlem Ekle</Button>
        {summary.status === 'draft' && <Button variant="contained" color="info" onClick={onApprove}>Onayla</Button>}
      </Box>
    </Card>
  );
}

interface PaymentDialogState {
  tenantId: string;
  tenderId: string;
  period: string;
  paymentFrequency: string;
  dueDate: string;
  note: string;
  items: ProgressPaymentItemPayload[];
}

const emptyPaymentForm: PaymentDialogState = {
  tenantId: '',
  tenderId: '',
  period: '',
  paymentFrequency: 'none',
  dueDate: '',
  note: '',
  items: [{ description: '', quantity: 1, unit: 'adet', unitPrice: 0, amount: 0 }],
};

function AddPaymentDialog({
  open,
  tenants,
  tenders,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  tenants: Tenant[];
  tenders: Tender[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: PaymentDialogState) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PaymentDialogState>(emptyPaymentForm);
  const total = form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(emptyPaymentForm);
    }
  }, [open]);

  const updateItem = (index: number, patch: Partial<ProgressPaymentItemPayload>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        return { ...next, amount: (Number(next.quantity) || 0) * (Number(next.unitPrice) || 0) };
      }),
    }));
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Hakediş Ekle</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <Tabs value={step} onChange={(_, value) => setStep(value)} sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Tab label="Temel Bilgiler" />
          <Tab label="Kalemler" />
          <Tab label="Özet" />
        </Tabs>
        {step === 0 && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, pt: 1 }}>
            <TextField select label="Tenant" value={form.tenantId} onChange={(e) => setForm((s) => ({ ...s, tenantId: e.target.value }))} required>
              {tenants.map((tenant) => <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>)}
            </TextField>
            <TextField select label="İhale" value={form.tenderId} onChange={(e) => setForm((s) => ({ ...s, tenderId: e.target.value }))}>
              <MenuItem value="">Yok</MenuItem>
              {tenders.map((tender) => <MenuItem key={tender.id} value={tender.id}>{tender.title}</MenuItem>)}
            </TextField>
            <TextField label="Dönem" placeholder="Ocak 2026" value={form.period} onChange={(e) => setForm((s) => ({ ...s, period: e.target.value }))} />
            <TextField select label="Ödeme Sıklığı" value={form.paymentFrequency} onChange={(e) => setForm((s) => ({ ...s, paymentFrequency: e.target.value }))}>
              {Object.entries(frequencyLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField type="date" label="Vade" value={form.dueDate} onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="Not" multiline rows={3} value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} />
          </Box>
        )}
        {step === 1 && (
          <Box sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Açıklama</TableCell>
                  <TableCell width={100}>Miktar</TableCell>
                  <TableCell width={100}>Birim</TableCell>
                  <TableCell width={130}>Birim Fiyat</TableCell>
                  <TableCell width={130}>Tutar</TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {form.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell><TextField size="small" value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} /></TableCell>
                    <TableCell><TextField size="small" value={item.unit ?? ''} onChange={(e) => updateItem(index, { unit: e.target.value })} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} /></TableCell>
                    <TableCell>{formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</TableCell>
                    <TableCell><IconButton disabled={form.items.length === 1} onClick={() => setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== index) }))}><DeleteIcon /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button startIcon={<AddIcon />} onClick={() => setForm((s) => ({ ...s, items: [...s.items, { description: '', quantity: 1, unit: 'adet', unitPrice: 0, amount: 0 }] }))}>Kalem Ekle</Button>
              <Typography sx={{ fontWeight: 900 }}>Toplam: {formatCurrency(total)}</Typography>
            </Box>
          </Box>
        )}
        {step === 2 && (
          <Box sx={{ display: 'grid', gap: 1.2, pt: 1 }}>
            <Typography><strong>Tenant:</strong> {tenants.find((tenant) => tenant.id === form.tenantId)?.name ?? '-'}</Typography>
            <Typography><strong>Dönem:</strong> {form.period || '-'}</Typography>
            <Typography><strong>Kalem:</strong> {form.items.length}</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 900 }}>Toplam: {formatCurrency(total)}</Typography>
            {total <= 0 && <Alert severity="warning">Toplam tutar 0. Kalemleri kontrol edin.</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>İptal</Button>
        {step > 0 && <Button onClick={() => setStep((s) => s - 1)} disabled={saving}>Geri</Button>}
        {step < 2 ? (
          <Button variant="contained" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !form.tenantId}>İleri</Button>
        ) : (
          <Button variant="contained" onClick={() => onSave(form)} disabled={saving || !form.tenantId || total <= 0}>Kaydet</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function AddExpenseDialog({
  open,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: ExpensePayload) => void;
}) {
  const [form, setForm] = useState<ExpensePayload>({ category: 'other', description: '', amount: 0, status: 'pending', paymentDate: '', note: '', invoice: null });

  useEffect(() => {
    if (open) setForm({ category: 'other', description: '', amount: 0, status: 'pending', paymentDate: '', note: '', invoice: null });
  }, [open]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Gider Ekle</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <TextField select label="Kategori" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>
          {Object.entries(categoryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField label="Açıklama" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} required />
        <TextField label="Tutar" type="number" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: Number(e.target.value) }))} required />
        <TextField type="date" label="Ödeme Tarihi" value={form.paymentDate} onChange={(e) => setForm((s) => ({ ...s, paymentDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
        <TextField select label="Durum" value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
          <MenuItem value="pending">Bekleyen</MenuItem>
          <MenuItem value="paid">Ödendi</MenuItem>
        </TextField>
        <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
          {form.invoice ? form.invoice.name : 'Fatura Yükle'}
          <input hidden type="file" accept="application/pdf,image/*" onChange={(e) => setForm((s) => ({ ...s, invoice: e.target.files?.[0] ?? null }))} />
        </Button>
        <TextField label="Not" multiline rows={3} value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>İptal</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={saving || !form.description || form.amount <= 0}>Kaydet</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailDrawer({
  tenant,
  payments,
  open,
  transactionSaving,
  onClose,
  onApprove,
  onAddTransaction,
}: {
  tenant: TenantPaymentSummary | null;
  payments: ProgressPayment[];
  open: boolean;
  transactionSaving: boolean;
  onClose: () => void;
  onApprove: (paymentId: string) => void;
  onAddTransaction: (paymentId: string, data: { paymentDate: string; amount: number; note?: string; receipt?: File | null }) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ paymentId: '', paymentDate: '', amount: 0, note: '', receipt: null as File | null });

  useEffect(() => {
    if (open) {
      setShowForm(false);
      setForm({ paymentId: payments[0]?.id ?? '', paymentDate: new Date().toISOString().slice(0, 10), amount: 0, note: '', receipt: null });
    }
  }, [open, payments]);

  const paidRatio = tenant && tenant.totalAmount > 0 ? Math.min(100, (tenant.paidAmount / tenant.totalAmount) * 100) : 0;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 600 }, p: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 900 }}>{tenant?.tenantName ?? 'Detay'}</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: 13 }}>{tenant?.contactPhone ?? ''}</Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      {tenant && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {[
              ['Toplam', tenant.totalAmount],
              ['Ödenen', tenant.paidAmount],
              ['Kalan', tenant.remainingAmount],
            ].map(([label, value]) => (
              <Box key={label} sx={{ border: '1px solid #E5E7EB', borderRadius: 1, p: 1.5 }}>
                <Typography sx={{ color: '#6B7280', fontSize: 12 }}>{label}</Typography>
                <Typography sx={{ fontWeight: 900 }}>{formatCurrency(Number(value))}</Typography>
              </Box>
            ))}
          </Box>
          <LinearProgress variant="determinate" value={paidRatio} sx={{ height: 8, borderRadius: 99, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: '#16A34A' } }} />

          <Divider />
          <Typography sx={{ fontWeight: 900 }}>Hakedişler</Typography>
          {payments.map((payment) => (
            <Accordion key={payment.id} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2, pr: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{payment.period ?? 'Dönem yok'}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{formatCurrency(payment.totalAmount)} · Vade {formatDate(payment.dueDate)}</Typography>
                  </Box>
                  <StatusChip status={payment.status} />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={1}>
                  {payment.items.map((item) => (
                    <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography sx={{ fontSize: 13 }}>{item.description}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{formatCurrency(item.amount)}</Typography>
                    </Box>
                  ))}
                  {payment.status === 'draft' && (
                    <Button size="small" startIcon={<ApproveIcon />} onClick={() => onApprove(payment.id)} sx={{ alignSelf: 'flex-start' }}>Onayla</Button>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}

          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 900 }}>İşlemler</Typography>
            <Button startIcon={<AddIcon />} onClick={() => setShowForm((v) => !v)}>İşlem Ekle</Button>
          </Box>
          {showForm && (
            <Box sx={{ display: 'grid', gap: 1.5, border: '1px solid #E5E7EB', borderRadius: 1, p: 1.5 }}>
              <TextField select size="small" label="Hakediş" value={form.paymentId} onChange={(e) => setForm((s) => ({ ...s, paymentId: e.target.value }))}>
                {payments.map((payment) => <MenuItem key={payment.id} value={payment.id}>{payment.period ?? payment.id}</MenuItem>)}
              </TextField>
              <TextField size="small" type="date" label="Tarih" value={form.paymentDate} onChange={(e) => setForm((s) => ({ ...s, paymentDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
              <TextField size="small" type="number" label="Tutar" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: Number(e.target.value) }))} />
              <TextField size="small" label="Not" value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} />
              <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
                {form.receipt ? form.receipt.name : 'Dekont Yükle'}
                <input hidden type="file" accept="application/pdf,image/*" onChange={(e) => setForm((s) => ({ ...s, receipt: e.target.files?.[0] ?? null }))} />
              </Button>
              <Button variant="contained" disabled={transactionSaving || !form.paymentId || !form.paymentDate || form.amount <= 0} onClick={() => onAddTransaction(form.paymentId, form)}>Kaydet</Button>
            </Box>
          )}
          <Stack gap={1}>
            {payments.flatMap((payment) => payment.transactions.map((tx) => ({ payment, tx }))).map(({ payment, tx }) => (
              <Box key={tx.id} sx={{ borderLeft: '3px solid #2D6A4F', pl: 1.5, py: 0.5 }}>
                <Typography sx={{ fontWeight: 900 }}>{formatDate(tx.paymentDate)} · {formatCurrency(tx.amount)}</Typography>
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{payment.period ?? 'Dönem yok'} · {tx.note ?? 'Not yok'}</Typography>
                {tx.receiptPath && <Button size="small" component="a" href={uploadUrl(tx.receiptPath) ?? '#'} target="_blank">Dekont</Button>}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}

export default function ProjectPaymentsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tenantSummaries, setTenantSummaries] = useState<TenantPaymentSummary[]>([]);
  const [payments, setPayments] = useState<ProgressPayment[]>([]);
  const [expenses, setExpenses] = useState<GeneralExpense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState({ total: 0, paid: 0, pending: 0, thisMonth: 0, byCategory: {} as Record<string, number> });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const selectedTenant = tenantSummaries.find((tenant) => tenant.tenantId === selectedTenantId) ?? null;
  const selectedPayments = selectedTenantId ? payments.filter((payment) => payment.tenantId === selectedTenantId) : [];
  const filteredExpenses = categoryFilter === 'all' ? expenses : expenses.filter((expense) => expense.category === categoryFilter);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantList, tenderList, summaries, paymentList, expenseList, summary] = await Promise.all([
        getTenantsApi(),
        getTendersApi({ projectId }),
        getTenantPaymentSummariesApi(projectId),
        getProgressPaymentsApi(projectId),
        getExpensesApi(projectId),
        getExpenseSummaryApi(projectId),
      ]);
      setTenants(tenantList);
      setTenders(tenderList);
      setTenantSummaries(summaries);
      setPayments(paymentList);
      setExpenses(expenseList);
      setExpenseSummary(summary);
    } catch (error) {
      showError(getErrorMessage(error, 'Ödeme verileri yüklenemedi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId]);

  const handleCreatePayment = async (form: PaymentDialogState) => {
    const items = form.items.map((item) => ({ ...item, amount: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) }));
    const totalAmount = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    try {
      setSaving(true);
      await createProgressPaymentApi(projectId, {
        tenantId: form.tenantId,
        tenderId: form.tenderId || null,
        period: form.period,
        totalAmount,
        dueDate: form.dueDate || undefined,
        paymentFrequency: form.paymentFrequency,
        note: form.note,
        items,
      });
      setPaymentDialogOpen(false);
      showSuccess('Hakediş eklendi');
      await loadData();
    } catch (error) {
      showError(getErrorMessage(error, 'Hakediş eklenemedi'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExpense = async (data: ExpensePayload) => {
    try {
      setSaving(true);
      await createExpenseApi(projectId, data);
      setExpenseDialogOpen(false);
      showSuccess('Gider eklendi');
      await loadData();
    } catch (error) {
      showError(getErrorMessage(error, 'Gider eklenemedi'));
    } finally {
      setSaving(false);
    }
  };

  const handleApproveTenantDraft = async (tenantId: string) => {
    const draft = payments.find((payment) => payment.tenantId === tenantId && payment.status === 'draft');
    if (!draft) return;
    await handleApprovePayment(draft.id);
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      await approveProgressPaymentApi(paymentId);
      showSuccess('Hakediş onaylandı');
      await loadData();
    } catch (error) {
      showError(getErrorMessage(error, 'Hakediş onaylanamadı'));
    }
  };

  const handleAddTransaction = async (paymentId: string, data: { paymentDate: string; amount: number; note?: string; receipt?: File | null }) => {
    try {
      setTransactionSaving(true);
      await createPaymentTransactionApi(paymentId, data);
      showSuccess('İşlem eklendi');
      await loadData();
    } catch (error) {
      showError(getErrorMessage(error, 'İşlem eklenemedi'));
    } finally {
      setTransactionSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpenseApi(projectId, id);
      showSuccess('Gider silindi');
      await loadData();
    } catch (error) {
      showError(getErrorMessage(error, 'Gider silinemedi'));
    }
  };

  const handleExport = async () => {
    try {
      const blob = await downloadPaymentsExportApi(projectId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `odemeler-${projectId}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError(getErrorMessage(error, 'Excel indirilemedi'));
    }
  };

  const emptyPayments = !loading && tenantSummaries.length === 0;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>Ödemeler</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => void handleExport()}>Excel İndir</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setPaymentDialogOpen(true)} sx={{ bgcolor: '#2D6A4F', '&:hover': { bgcolor: '#24543F' } }}>Hakediş Ekle</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setExpenseDialogOpen(true)} sx={{ borderColor: '#2D6A4F', color: '#2D6A4F' }}>Gider Ekle</Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Hakediş Ödemeleri" />
        <Tab label="Genel Giderler" />
      </Tabs>

      {tab === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
              {[0, 1, 2].map((item) => <Skeleton key={item} variant="rounded" height={260} />)}
            </Box>
          ) : emptyPayments ? (
            <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#9CA3AF' }}>
              <PaymentsIcon sx={{ fontSize: 64, opacity: 0.45 }} />
              <Typography sx={{ color: '#6B7280', fontWeight: 800 }}>Henüz hakediş ödeme kaydı yok</Typography>
              <Button variant="contained" onClick={() => setPaymentDialogOpen(true)} sx={{ bgcolor: '#2D6A4F', '&:hover': { bgcolor: '#24543F' } }}>Hakediş Ekle</Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
              {tenantSummaries.map((summary) => (
                <TenantCard
                  key={summary.tenantId}
                  summary={summary}
                  onDetail={() => setSelectedTenantId(summary.tenantId)}
                  onAddTransaction={() => setSelectedTenantId(summary.tenantId)}
                  onApprove={() => void handleApproveTenantDraft(summary.tenantId)}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {[
              ['Toplam', expenseSummary.total],
              ['Ödenen', expenseSummary.paid],
              ['Bekleyen', expenseSummary.pending],
              ['Bu Ay', expenseSummary.thisMonth],
            ].map(([label, value]) => (
              <Card key={label} sx={{ p: 2 }}>
                <Typography sx={{ color: '#6B7280', fontSize: 13 }}>{label}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 900 }}>{formatCurrency(Number(value))}</Typography>
              </Card>
            ))}
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {['all', 'material', 'labor', 'equipment', 'other'].map((category) => (
              <Chip
                key={category}
                label={category === 'all' ? 'Tümü' : categoryLabels[category]}
                color={categoryFilter === category ? 'primary' : 'default'}
                onClick={() => setCategoryFilter(category)}
              />
            ))}
          </Stack>
          <Card sx={{ overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kategori</TableCell>
                  <TableCell>Açıklama</TableCell>
                  <TableCell>Tutar</TableCell>
                  <TableCell>Fatura</TableCell>
                  <TableCell>Tarih</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell align="right">İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{categoryIcon(expense.category)}{categoryLabels[expense.category] ?? expense.category}</Box></TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{expense.invoicePath ? <IconButton component="a" href={uploadUrl(expense.invoicePath) ?? '#'} target="_blank"><CloudDownloadIcon /></IconButton> : '-'}</TableCell>
                    <TableCell>{formatDate(expense.paymentDate)}</TableCell>
                    <TableCell><StatusChip status={expense.status} /></TableCell>
                    <TableCell align="right"><IconButton color="error" onClick={() => void handleDeleteExpense(expense.id)}><DeleteIcon /></IconButton></TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: '#6B7280' }}>Kayıt yok</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          <Fab color="primary" onClick={() => setExpenseDialogOpen(true)} sx={{ position: 'fixed', right: 28, bottom: 28, bgcolor: '#2D6A4F', '&:hover': { bgcolor: '#24543F' } }}>
            <AddIcon />
          </Fab>
        </Box>
      )}

      <DetailDrawer
        tenant={selectedTenant}
        payments={selectedPayments}
        open={!!selectedTenantId}
        transactionSaving={transactionSaving}
        onClose={() => setSelectedTenantId(null)}
        onApprove={(paymentId) => void handleApprovePayment(paymentId)}
        onAddTransaction={(paymentId, data) => void handleAddTransaction(paymentId, data)}
      />
      <AddPaymentDialog
        open={paymentDialogOpen}
        tenants={tenants}
        tenders={tenders}
        saving={saving}
        onClose={() => setPaymentDialogOpen(false)}
        onSave={(data) => void handleCreatePayment(data)}
      />
      <AddExpenseDialog
        open={expenseDialogOpen}
        saving={saving}
        onClose={() => setExpenseDialogOpen(false)}
        onSave={(data) => void handleCreateExpense(data)}
      />
      <Notification {...notificationProps} />
    </Box>
  );
}
