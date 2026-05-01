'use client';

import { useCallback, useEffect, useState } from 'react';
import { use } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  InputAdornment,
  LinearProgress,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  People as PeopleIcon,
  Apartment as ApartmentIcon,
  SquareFoot as SquareFootIcon,
  Percent as PercentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
// Grid is unused — removed in favour of Box for compat
import type { PaymentPlan, PaymentPlanInstallment, PropertyOwner } from '@core-panel/shared';
import { getPropertyOwnersApi, createPropertyOwnerApi, updatePropertyOwnerApi, deletePropertyOwnerApi, type PropertyOwnerPayload } from '@/services/property-owners/api';
import { getPaymentPlansApi, createPaymentPlanApi, deletePaymentPlanApi, payInstallmentApi, type CreatePaymentPlanPayload } from '@/services/payment-plans/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 });
const fmtCurrency = (v: number) => fmt.format(v);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR');

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1, backgroundColor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── owner form ────────────────────────────────────────────────────────────────

const emptyForm = (): PropertyOwnerPayload => ({
  fullName: '',
  phone: '',
  email: '',
  idNumber: '',
  floorNumber: undefined,
  apartmentNumber: '',
  apartmentSizeSqm: undefined,
  sharePercentage: undefined,
  apartmentCount: 1,
  note: '',
});

function OwnerDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: PropertyOwnerPayload | null;
  onClose: () => void;
  onSave: (data: PropertyOwnerPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<PropertyOwnerPayload>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : emptyForm());
      setError('');
    }
  }, [open, initial]);

  const set = (k: keyof PropertyOwnerPayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value === '' ? undefined : e.target.value }));
  const setNum = (k: keyof PropertyOwnerPayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value === '' ? undefined : Number(e.target.value) }));

  const handleSave = async () => {
    if (!form.fullName?.trim()) { setError('Ad Soyad zorunludur'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Tapu Sahibi Düzenle' : 'Tapu Sahibi Ekle'}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Ad Soyad *" fullWidth value={form.fullName ?? ''} onChange={set('fullName')} sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <TextField label="Telefon" value={form.phone ?? ''} onChange={set('phone')} />
          <TextField label="E-posta" value={form.email ?? ''} onChange={set('email')} />
        </Box>
        <TextField label="TC Kimlik No" fullWidth value={form.idNumber ?? ''} onChange={set('idNumber')} sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <TextField label="Kat No" type="number" value={form.floorNumber ?? ''} onChange={setNum('floorNumber')} />
          <TextField label="Daire No" value={form.apartmentNumber ?? ''} onChange={set('apartmentNumber')} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <TextField
            label="Daire m²"
            type="number"
            value={form.apartmentSizeSqm ?? ''}
            onChange={setNum('apartmentSizeSqm')}
            InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
          />
          <TextField
            label="Hisse %"
            type="number"
            value={form.sharePercentage ?? ''}
            onChange={setNum('sharePercentage')}
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          />
        </Box>
        <TextField
          label="Daire Adedi"
          type="number"
          fullWidth
          value={form.apartmentCount ?? 1}
          onChange={setNum('apartmentCount')}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Not"
          fullWidth
          multiline
          rows={2}
          value={form.note ?? ''}
          onChange={set('note')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>İptal</Button>
        <Button onClick={() => void handleSave()} variant="contained" disabled={saving}
          sx={{ backgroundColor: '#2D6A4F', '&:hover': { backgroundColor: '#235c43' } }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Kaydet'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── plan form ─────────────────────────────────────────────────────────────────

interface InstallmentRow { dueDate: string; amount: string }

function PlanDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreatePaymentPlanPayload) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<InstallmentRow[]>([{ dueDate: '', amount: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setTitle(''); setTotalAmount(''); setNote(''); setRows([{ dueDate: '', amount: '' }]); setError(''); }
  }, [open]);

  const rowSum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const total = Number(totalAmount) || 0;

  const handleSave = async () => {
    if (!totalAmount) { setError('Toplam tutar zorunludur'); return; }
    if (rows.some((r) => !r.dueDate || !r.amount)) { setError('Tüm taksit alanlarını doldurun'); return; }
    if (rows.length > 0 && Math.abs(rowSum - total) > 0.01) { setError(`Taksit toplamı (${fmtCurrency(rowSum)}) toplam tutarla eşleşmiyor (${fmtCurrency(total)})`); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: title || undefined,
        totalAmount: total,
        note: note || undefined,
        installments: rows.map((r) => ({ dueDate: r.dueDate, amount: Number(r.amount) })),
      });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ödeme Planı Ekle</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Başlık" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }} />
        <TextField
          label="Toplam Tutar *"
          fullWidth
          type="number"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">₺</InputAdornment> }}
          sx={{ mb: 2 }}
        />
        <TextField label="Not" fullWidth multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} sx={{ mb: 2 }} />

        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Taksitler</Typography>
        {rows.map((row, i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField
              label="Vade Tarihi"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={row.dueDate}
              onChange={(e) => setRows((prev) => prev.map((r, j) => j === i ? { ...r, dueDate: e.target.value } : r))}
            />
            <TextField
              label="Tutar"
              type="number"
              size="small"
              InputProps={{ startAdornment: <InputAdornment position="start">₺</InputAdornment> }}
              value={row.amount}
              onChange={(e) => setRows((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
            />
            <IconButton size="small" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} disabled={rows.length === 1}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setRows((prev) => [...prev, { dueDate: '', amount: '' }])}>
            Taksit Ekle
          </Button>
          <Typography variant="caption" color={Math.abs(rowSum - total) > 0.01 && total > 0 ? 'error' : 'text.secondary'}>
            Toplam: {fmtCurrency(rowSum)} / {fmtCurrency(total)}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>İptal</Button>
        <Button onClick={() => void handleSave()} variant="contained" disabled={saving}
          sx={{ backgroundColor: '#2D6A4F', '&:hover': { backgroundColor: '#235c43' } }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Kaydet'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── pay dialog ────────────────────────────────────────────────────────────────

function PayDialog({
  open,
  installment,
  onClose,
  onPay,
}: {
  open: boolean;
  installment: PaymentPlanInstallment | null;
  onClose: () => void;
  onPay: (planId: string, installmentId: string, paidDate: string, note: string, file?: File) => Promise<void>;
}) {
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setPaidDate(new Date().toISOString().slice(0, 10)); setNote(''); setFile(undefined); setError(''); }
  }, [open]);

  if (!installment) return null;

  const handlePay = async () => {
    setSaving(true);
    setError('');
    try {
      await onPay(installment.planId, installment.id, paidDate, note, file);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Ödendi İşaretle</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" sx={{ mb: 2 }}>
          Taksit: <strong>{fmtCurrency(installment.amount)}</strong> — Vade: {fmtDate(installment.dueDate)}
        </Typography>
        <TextField
          label="Ödeme Tarihi"
          type="date"
          fullWidth
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />
        <TextField label="Not" fullWidth value={note} onChange={(e) => setNote(e.target.value)} sx={{ mb: 2 }} />
        <Button variant="outlined" component="label" fullWidth>
          {file ? file.name : 'Makbuz Yükle (opsiyonel)'}
          <input type="file" hidden accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0])} />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>İptal</Button>
        <Button onClick={() => void handlePay()} variant="contained" color="success" disabled={saving}>
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Onayla'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── owner drawer ──────────────────────────────────────────────────────────────

function OwnerDrawer({
  owner,
  plans,
  onClose,
  onAddPlan,
  onDeletePlan,
  onPayInstallment,
}: {
  owner: PropertyOwner | null;
  plans: PaymentPlan[];
  onClose: () => void;
  onAddPlan: () => void;
  onDeletePlan: (id: string) => void;
  onPayInstallment: (inst: PaymentPlanInstallment) => void;
}) {
  if (!owner) return null;

  return (
    <Drawer anchor="right" open={!!owner} onClose={onClose} PaperProps={{ sx: { width: 500, p: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>{owner.fullName}</Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
        {owner.floorNumber != null && <Typography variant="body2">Kat: <strong>{owner.floorNumber}</strong></Typography>}
        {owner.apartmentNumber && <Typography variant="body2">Daire No: <strong>{owner.apartmentNumber}</strong></Typography>}
        {owner.apartmentSizeSqm != null && <Typography variant="body2">Alan: <strong>{owner.apartmentSizeSqm} m²</strong></Typography>}
        {owner.sharePercentage != null && <Typography variant="body2">Hisse: <strong>%{owner.sharePercentage}</strong></Typography>}
        {owner.apartmentCount > 1 && <Typography variant="body2">Daire Adedi: <strong>{owner.apartmentCount}</strong></Typography>}
        {owner.phone && <Typography variant="body2">Tel: <strong>{owner.phone}</strong></Typography>}
        {owner.email && <Typography variant="body2">E-posta: <strong>{owner.email}</strong></Typography>}
        {owner.idNumber && <Typography variant="body2">TC: <strong>{owner.idNumber}</strong></Typography>}
        {owner.note && <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>{owner.note}</Typography>}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Ödeme Planları</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAddPlan}
          sx={{ backgroundColor: '#2D6A4F', color: 'white', '&:hover': { backgroundColor: '#235c43' } }}>
          Plan Ekle
        </Button>
      </Box>

      {plans.length === 0 && (
        <Typography variant="body2" color="text.secondary">Henüz ödeme planı yok.</Typography>
      )}

      {plans.map((plan) => (
        <Card key={plan.id} variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ pb: '12px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>{plan.title ?? 'Ödeme Planı'}</Typography>
                <Chip
                  label={plan.status === 'completed' ? 'Tamamlandı' : 'Aktif'}
                  size="small"
                  color={plan.status === 'completed' ? 'success' : 'default'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
              <Tooltip title="Planı Sil">
                <IconButton size="small" color="error" onClick={() => onDeletePlan(plan.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.5, textAlign: 'center' }}>
              {[
                { label: 'Toplam', value: fmtCurrency(plan.totalAmount) },
                { label: 'Ödenen', value: fmtCurrency(plan.paidAmount) },
                { label: 'Kalan', value: fmtCurrency(plan.remainingAmount) },
              ].map((item) => (
                <Box key={item.label} sx={{ backgroundColor: '#f8f9fa', borderRadius: 1, p: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                </Box>
              ))}
            </Box>

            {plan.totalAmount > 0 && (
              <LinearProgress
                variant="determinate"
                value={(plan.paidAmount / plan.totalAmount) * 100}
                sx={{ mb: 1.5, height: 6, borderRadius: 3 }}
                color={plan.status === 'completed' ? 'success' : 'primary'}
              />
            )}

            {plan.installments.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Taksitler</Typography>
                {plan.installments.map((inst) => (
                  <Box key={inst.id} sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    py: 0.75, borderBottom: '1px solid #f0f0f0',
                    '&:last-child': { borderBottom: 'none' },
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {inst.status === 'paid'
                        ? <CheckCircleIcon sx={{ fontSize: 16, color: '#2D6A4F' }} />
                        : <ScheduleIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                      }
                      <Box>
                        <Typography variant="caption">{fmtDate(inst.dueDate)}</Typography>
                        <Typography variant="body2" fontWeight={600}>{fmtCurrency(inst.amount)}</Typography>
                      </Box>
                    </Box>
                    {inst.status === 'paid'
                      ? <Chip label="Ödendi" size="small" color="success" />
                      : (
                        <Button size="small" variant="outlined" color="success" onClick={() => onPayInstallment(inst)}>
                          Ödendi İşaretle
                        </Button>
                      )}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Drawer>
  );
}

// ── owner card ────────────────────────────────────────────────────────────────

function PlanMiniSummary({ plan }: { plan: PaymentPlan }) {
  const pct = plan.totalAmount > 0 ? (plan.paidAmount / plan.totalAmount) * 100 : 0;
  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f0f0f0' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{plan.title ?? 'Ödeme Planı'}</Typography>
        <Typography variant="caption" color="text.secondary">{Math.round(pct)}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 4, borderRadius: 2 }} color={pct >= 100 ? 'success' : 'primary'} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption">Ödenen: {fmtCurrency(plan.paidAmount)}</Typography>
        <Typography variant="caption">Kalan: {fmtCurrency(plan.remainingAmount)}</Typography>
      </Box>
    </Box>
  );
}

function OwnerCard({
  owner,
  plans,
  onClick,
  onEdit,
  onDelete,
}: {
  owner: PropertyOwner;
  plans: PaymentPlan[];
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const firstPlan = plans[0] ?? null;

  return (
    <Card
      variant="outlined"
      sx={{ cursor: 'pointer', transition: 'all 0.15s', '&:hover': { boxShadow: 4, borderColor: '#2D6A4F' }, position: 'relative' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: '70%' }}>{owner.fullName}</Typography>
          {owner.sharePercentage != null && (
            <Chip label={`%${owner.sharePercentage}`} size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2D6A4F', fontWeight: 600 }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
          {owner.floorNumber != null && (
            <Box sx={{ width: '48%' }}><Typography variant="caption" color="text.secondary">Kat: <strong>{owner.floorNumber}</strong></Typography></Box>
          )}
          {owner.apartmentNumber && (
            <Box sx={{ width: '48%' }}><Typography variant="caption" color="text.secondary">Daire No: <strong>{owner.apartmentNumber}</strong></Typography></Box>
          )}
          {owner.apartmentSizeSqm != null && (
            <Box sx={{ width: '48%' }}><Typography variant="caption" color="text.secondary">Alan: <strong>{owner.apartmentSizeSqm} m²</strong></Typography></Box>
          )}
          {owner.apartmentCount > 1 && (
            <Box sx={{ width: '48%' }}><Typography variant="caption" color="text.secondary">Daire: <strong>{owner.apartmentCount}</strong></Typography></Box>
          )}
        </Box>

        {(owner.phone || owner.email) && (
          <Box sx={{ mt: 1 }}>
            {owner.phone && <Typography variant="caption" color="text.secondary" display="block">{owner.phone}</Typography>}
            {owner.email && <Typography variant="caption" color="text.secondary" display="block">{owner.email}</Typography>}
          </Box>
        )}

        {firstPlan && <PlanMiniSummary plan={firstPlan} />}

        {hovered && (
          <Box
            sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5, backgroundColor: 'white', borderRadius: 1, boxShadow: 2, p: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title="Düzenle">
              <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Sil">
              <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function PropertyOwnersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [owners, setOwners] = useState<PropertyOwner[]>([]);
  const [plansByOwner, setPlansByOwner] = useState<Record<string, PaymentPlan[]>>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PropertyOwner | null>(null);

  const [drawerOwner, setDrawerOwner] = useState<PropertyOwner | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PaymentPlanInstallment | null>(null);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' as 'success' | 'error' });

  const showMsg = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const loadOwners = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPropertyOwnersApi(projectId);
      setOwners(data);
    } catch {
      showMsg('Tapu sahipleri yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void loadOwners(); }, [loadOwners]);

  const loadPlans = useCallback(async (ownerId: string) => {
    try {
      const data = await getPaymentPlansApi(ownerId);
      setPlansByOwner((prev) => ({ ...prev, [ownerId]: data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    owners.forEach((o) => void loadPlans(o.id));
  }, [owners, loadPlans]);

  const handleSaveOwner = async (data: PropertyOwnerPayload) => {
    if (editTarget) {
      const updated = await updatePropertyOwnerApi(editTarget.id, data);
      setOwners((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (drawerOwner?.id === updated.id) setDrawerOwner(updated);
      showMsg('Güncellendi');
    } else {
      const created = await createPropertyOwnerApi(projectId, data);
      setOwners((prev) => [...prev, created]);
      showMsg('Eklendi');
    }
    setEditTarget(null);
  };

  const handleDeleteOwner = async (id: string) => {
    if (!confirm('Bu tapu sahibini silmek istediğinizden emin misiniz?')) return;
    try {
      await deletePropertyOwnerApi(id);
      setOwners((prev) => prev.filter((o) => o.id !== id));
      if (drawerOwner?.id === id) setDrawerOwner(null);
      showMsg('Silindi');
    } catch {
      showMsg('Silinemedi', 'error');
    }
  };

  const handleAddPlan = async (data: CreatePaymentPlanPayload) => {
    if (!drawerOwner) return;
    const plan = await createPaymentPlanApi(drawerOwner.id, data);
    setPlansByOwner((prev) => ({ ...prev, [drawerOwner.id]: [...(prev[drawerOwner.id] ?? []), plan] }));
    showMsg('Plan eklendi');
  };

  const handleDeletePlan = async (id: string) => {
    if (!drawerOwner) return;
    if (!confirm('Bu ödeme planını silmek istediğinizden emin misiniz?')) return;
    try {
      await deletePaymentPlanApi(id);
      setPlansByOwner((prev) => ({ ...prev, [drawerOwner.id]: (prev[drawerOwner.id] ?? []).filter((p) => p.id !== id) }));
      showMsg('Plan silindi');
    } catch {
      showMsg('Silinemedi', 'error');
    }
  };

  const handlePayInstallment = async (planId: string, installmentId: string, paidDate: string, note: string, file?: File) => {
    if (!drawerOwner) return;
    const { plan } = await payInstallmentApi(planId, installmentId, { paidDate, note: note || undefined }, file);
    setPlansByOwner((prev) => ({
      ...prev,
      [drawerOwner.id]: (prev[drawerOwner.id] ?? []).map((p) => (p.id === plan.id ? plan : p)),
    }));
    showMsg('Ödeme kaydedildi');
  };

  // metrics
  const totalOwners = owners.length;
  const totalApartments = owners.reduce((s, o) => s + o.apartmentCount, 0);
  const totalSqm = owners.reduce((s, o) => s + (o.apartmentSizeSqm ?? 0), 0);
  const avgShare = owners.length > 0
    ? owners.reduce((s, o) => s + (o.sharePercentage ?? 0), 0) / owners.filter((o) => o.sharePercentage != null).length || 0
    : 0;

  const drawerPlans = drawerOwner ? (plansByOwner[drawerOwner.id] ?? []) : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Tapu Sahipleri</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setEditTarget(null); setDialogOpen(true); }}
          sx={{ backgroundColor: '#2D6A4F', '&:hover': { backgroundColor: '#235c43' } }}
        >
          Tapu Sahibi Ekle
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard label="Toplam Tapu Sahibi" value={totalOwners} icon={<PeopleIcon fontSize="small" />} color="#2D6A4F" />
        <StatCard label="Toplam Daire" value={totalApartments} icon={<ApartmentIcon fontSize="small" />} color="#1E3A5F" />
        <StatCard label="Toplam m²" value={`${totalSqm.toLocaleString('tr-TR')} m²`} icon={<SquareFootIcon fontSize="small" />} color="#f59e0b" />
        <StatCard label="Ortalama Hisse %" value={`%${avgShare.toFixed(1)}`} icon={<PercentIcon fontSize="small" />} color="#6366f1" />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : owners.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, color: '#9CA3AF' }}>
          <PeopleIcon sx={{ fontSize: 48, opacity: 0.4, display: 'block', mx: 'auto', mb: 1 }} />
          <Typography>Henüz tapu sahibi yok</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {owners.map((owner) => (
            <OwnerCard
              key={owner.id}
              owner={owner}
              plans={plansByOwner[owner.id] ?? []}
              onClick={() => setDrawerOwner(owner)}
              onEdit={(e) => { e.stopPropagation(); setEditTarget(owner); setDialogOpen(true); }}
              onDelete={(e) => { e.stopPropagation(); void handleDeleteOwner(owner.id); }}
            />
          ))}
        </Box>
      )}

      <OwnerDialog
        open={dialogOpen}
        initial={editTarget ? {
          fullName: editTarget.fullName,
          phone: editTarget.phone ?? '',
          email: editTarget.email ?? '',
          idNumber: editTarget.idNumber ?? '',
          floorNumber: editTarget.floorNumber ?? undefined,
          apartmentNumber: editTarget.apartmentNumber ?? '',
          apartmentSizeSqm: editTarget.apartmentSizeSqm ?? undefined,
          sharePercentage: editTarget.sharePercentage ?? undefined,
          apartmentCount: editTarget.apartmentCount,
          note: editTarget.note ?? '',
        } : null}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        onSave={handleSaveOwner}
      />

      <OwnerDrawer
        owner={drawerOwner}
        plans={drawerPlans}
        onClose={() => setDrawerOwner(null)}
        onAddPlan={() => setPlanDialogOpen(true)}
        onDeletePlan={(id) => void handleDeletePlan(id)}
        onPayInstallment={(inst) => setPayTarget(inst)}
      />

      <PlanDialog
        open={planDialogOpen}
        onClose={() => setPlanDialogOpen(false)}
        onSave={handleAddPlan}
      />

      <PayDialog
        open={!!payTarget}
        installment={payTarget}
        onClose={() => setPayTarget(null)}
        onPay={handlePayInstallment}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
