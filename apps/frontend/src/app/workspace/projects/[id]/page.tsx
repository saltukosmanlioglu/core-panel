'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Box, Card, CircularProgress, Typography } from '@mui/material';
import { Gavel as GavelIcon, CheckCircle as CheckIcon, HourglassEmpty as PendingIcon } from '@mui/icons-material';
import { Notification } from '@/components';
import { getTendersApi } from '@/services/workspace/api';
import type { Tender } from '@core-panel/shared';

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2.5 }}>
      <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Box sx={{ color }}>{icon}</Box>
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '28px', lineHeight: 1, mb: 0.25 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
          {label}
        </Typography>
      </Box>
    </Card>
  );
}

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' as const });

  useEffect(() => {
    getTendersApi({ projectId: id })
      .then(setTenders)
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err)
          ? ((err.response?.data as { error?: string })?.error ?? 'Proje verileri yüklenemedi')
          : 'Proje verileri yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const openCount = tenders.filter((t) => t.status === 'open').length;
  const awardedCount = tenders.filter((t) => t.status === 'awarded').length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: '#1F2937' }} />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
        <StatCard icon={<GavelIcon sx={{ fontSize: 24 }} />}   label="Toplam İhale"   value={tenders.length}                  color="#1F2937" />
        <StatCard icon={<PendingIcon sx={{ fontSize: 24 }} />} label="Açık İhale"     value={openCount}                       color="#3B82F6" />
        <StatCard icon={<CheckIcon sx={{ fontSize: 24 }} />}   label="Verilmiş İhale" value={awardedCount}                    color="#10B981" />
      </Box>
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </>
  );
}
