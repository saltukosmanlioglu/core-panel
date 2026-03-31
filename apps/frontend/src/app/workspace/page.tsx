'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CircularProgress, Typography } from '@mui/material';
import { Assignment as AssignmentIcon, Gavel as GavelIcon, HourglassEmpty as PendingIcon } from '@mui/icons-material';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import { getProjectsApi, getTendersApi } from '@/services/workspace/api';
import { Notification } from '@/components';
import { useUser } from '@/contexts/UserContext';
import axios from 'axios';

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

export default function WorkspacePage() {
  const { user } = useUser();
  const [projectCount, setProjectCount] = useState(0);
  const [tenderCount, setTenderCount] = useState(0);
  const [openTenderCount, setOpenTenderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' as const });

  useEffect(() => {
    Promise.all([getProjectsApi(), getTendersApi()])
      .then(([projects, tenders]) => {
        setProjectCount(projects.length);
        setTenderCount(tenders.length);
        setOpenTenderCount(tenders.filter((t) => t.status === 'open').length);
      })
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err)
          ? ((err.response?.data as { error?: string })?.error ?? 'İstatistikler yüklenemedi')
          : 'İstatistikler yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceLayout>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Genel Bakış</Typography>
        <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>
          Hoş geldiniz{user?.name ? `, ${user.name}` : ''}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress sx={{ color: '#1F2937' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            <StatCard icon={<AssignmentIcon sx={{ fontSize: 24 }} />} label="Toplam İnşaat"    value={projectCount}    color="#1F2937" />
            <StatCard icon={<GavelIcon sx={{ fontSize: 24 }} />}      label="Toplam İhale"     value={tenderCount}     color="#3B82F6" />
            <StatCard icon={<PendingIcon sx={{ fontSize: 24 }} />}    label="Açık İhale"       value={openTenderCount} color="#10B981" />
          </Box>
        )}
      </Box>

      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </WorkspaceLayout>
  );
}
