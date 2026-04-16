'use client';

import { useEffect, useState } from 'react';
import { Box, Card, Typography, CircularProgress } from '@mui/material';
import {
  Apartment as ApartmentIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { getStatsApi } from '@/services/admin/api';
import { Notification } from '@/components';
import axios from 'axios';

interface Stats {
  tenants: number;
  users: number;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2.5 }}>
      <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Box sx={{ color }}>{icon}</Box>
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '28px', lineHeight: 1, mb: 0.25 }}>
          {value.toLocaleString()}
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
          {label}
        </Typography>
      </Box>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' as const });

  useEffect(() => {
    getStatsApi()
      .then(setStats)
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err)
          ? ((err.response?.data as { error?: string })?.error ?? 'İstatistikler yüklenemedi')
          : 'İstatistikler yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Genel Bakış</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>
        Şirket istatistiklerinize genel bakış
      </Typography>

      {loading ? (
        <Box className="flex justify-center py-12"><CircularProgress sx={{ color: '#1F2937' }} /></Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { sm: 'repeat(2, 1fr)' }, gap: 3 }}>
          <StatCard icon={<ApartmentIcon sx={{ fontSize: 24 }} />} label="Taşeronlarınız" value={stats?.tenants ?? 0} color="#3B82F6" />
          <StatCard icon={<PeopleIcon sx={{ fontSize: 24 }} />} label="Kullanıcılarınız" value={stats?.users ?? 0} color="#10B981" />
        </Box>
      )}

      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </Box>
  );
}
