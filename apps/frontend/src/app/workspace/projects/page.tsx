'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import {
  Assignment as AssignmentIcon,
  CalendarToday as CalendarTodayIcon,
  ChevronRight as ChevronRightIcon,
  HomeWork as HomeWorkIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { Notification } from '@/components';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import { useUser } from '@/contexts/UserContext';
import { getTenantsApi } from '@/services/admin/api';
import { getProjectsApi, getTendersApi, updateProjectStatusApi } from '@/services/workspace/api';
import { UserRole, type Project } from '@core-panel/shared';

const getStatusStyle = (status: string) => ({
  active:    { label: 'Aktif',      bg: 'rgba(59,130,246,0.2)',  color: '#bfdbfe',  border: 'rgba(191,219,254,0.35)', headerBg: '#1E3A5F' },
  approved:  { label: 'Onaylandı',  bg: 'rgba(22,163,74,0.2)',   color: '#86efac',  border: 'rgba(134,239,172,0.35)', headerBg: '#166534' },
  lost:      { label: 'İş Kaybedildi', bg: 'rgba(220,38,38,0.22)', color: '#fecaca', border: 'rgba(254,202,202,0.35)', headerBg: '#7f1d1d' },
  completed: { label: 'Tamamlandı', bg: 'rgba(99,102,241,0.2)',  color: '#a5b4fc',  border: 'rgba(165,180,252,0.3)', headerBg: '#374151' },
  cancelled: { label: 'İptal',      bg: 'rgba(148,163,184,0.2)', color: '#94a3b8',  border: 'rgba(148,163,184,0.3)', headerBg: '#64748b' },
}[status] ?? { label: status, bg: 'rgba(148,163,184,0.2)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)', headerBg: '#374151' });

function truncateDescription(description: string | null): string {
  if (!description) {
    return 'Açıklama eklenmemiş.';
  }

  return description.length > 80 ? `${description.slice(0, 80)}...` : description;
}

function ProjectCard({
  project,
  tenderCount,
  tenantCount,
  isAdmin,
  onClick,
  onStatusChange,
}: {
  project: Project;
  tenderCount: number;
  tenantCount: number;
  isAdmin: boolean;
  onClick: () => void;
  onStatusChange: (status: 'active' | 'approved' | 'lost', note?: string) => void;
}) {
  const statusStyle = getStatusStyle(project.status);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostNote, setLostNote] = useState('');

  const runStatusChange = (status: 'active' | 'approved' | 'lost', note?: string) => {
    setMenuAnchor(null);
    onStatusChange(status, note);
  };

  return (
    <Box
      sx={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 1.5,
        boxShadow: '0 1px 4px rgba(15,23,42,0.08)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: '#1E3A5F',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(30,58,95,0.16)',
        },
      }}
      onClick={onClick}
    >
      <Box sx={{ backgroundColor: statusStyle.headerBg, px: 2.5, pt: 2, pb: 1.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1,
              backgroundColor: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HomeWorkIcon sx={{ color: 'white', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'white', lineHeight: 1.3 }}>
                {project.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', mt: 0.25 }}>
                İnşaat Projesi
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
              border: `0.5px solid ${statusStyle.border}`,
              fontSize: 11, fontWeight: 500,
              px: 1.25, py: 0.4,
              borderRadius: 10,
              whiteSpace: 'nowrap',
            }}>
              {statusStyle.label}
            </Box>
            {isAdmin && (
              <>
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuAnchor(event.currentTarget);
                  }}
                  sx={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={(event: object) => {
                    (event as { stopPropagation?: () => void }).stopPropagation?.();
                    setMenuAnchor(null);
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {project.status !== 'approved' && <MenuItem onClick={() => runStatusChange('approved')}>Onayla</MenuItem>}
                  {project.status !== 'lost' && <MenuItem onClick={() => { setMenuAnchor(null); setLostOpen(true); }}>İş Kaybedildi</MenuItem>}
                  {project.status !== 'active' && <MenuItem onClick={() => runStatusChange('active')}>Aktife Al</MenuItem>}
                </Menu>
              </>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2.5, pt: 1.75, pb: 2 }}>
        <Typography sx={{
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
          mb: 1.75,
          minHeight: 38,
        }}>
          {truncateDescription(project.description)}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.75 }}>
          {[
            { value: tenderCount, label: 'İhale', color: '#1E3A5F' },
            { value: tenantCount, label: 'Taşeron', color: '#f59e0b' },
            { value: 0, label: 'Tamamlandı', color: '#10b981' },
          ].map((stat) => (
            <Box key={stat.label} sx={{
              backgroundColor: 'var(--color-background-secondary)',
              borderRadius: 1.5,
              py: 1, px: 1.25,
              textAlign: 'center',
            }}>
              <Typography sx={{ fontSize: 18, fontWeight: 500, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'var(--color-text-secondary)', mt: 0.5 }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          pt: 1.5, borderTop: '0.5px solid var(--color-border-tertiary)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarTodayIcon sx={{ fontSize: 13, color: 'var(--color-text-secondary)' }} />
            <Typography sx={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {new Date(project.updatedAt).toLocaleDateString('tr-TR')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#1E3A5F' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#1E3A5F' }}>Detay</Typography>
            <ChevronRightIcon sx={{ fontSize: 14, color: '#1E3A5F' }} />
          </Box>
        </Box>
      </Box>
      <Dialog open={lostOpen} onClose={() => setLostOpen(false)} onClick={(event) => event.stopPropagation()} maxWidth="xs" fullWidth>
        <DialogTitle>İş Kaybedildi Notu</DialogTitle>
        <DialogContent>
          <TextField
            label="Not"
            value={lostNote}
            onChange={(event) => setLostNote(event.target.value)}
            multiline
            rows={3}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLostOpen(false)}>İptal</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setLostOpen(false);
              runStatusChange('lost', lostNote);
              setLostNote('');
            }}
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CardSkeleton() {
  return (
    <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 'var(--border-radius-lg)' }} />
  );
}

export default function DashboardProjectsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTenderCounts, setProjectTenderCounts] = useState<Record<string, number>>({});
  const [tenantCount, setTenantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' as const });

  useEffect(() => {
    getProjectsApi()
      .then(setProjects)
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err)
          ? ((err.response?.data as { error?: string })?.error ?? 'İnşaatlar yüklenemedi')
          : 'İnşaatlar yüklenemedi';
        setSnackbar({ open: true, message: msg, severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      setProjectTenderCounts({});
      return;
    }

    let cancelled = false;

    Promise.all(
      projects.map(async (project) => {
        try {
          const tenders = await getTendersApi({ projectId: project.id });
          return { id: project.id, count: tenders.length };
        } catch {
          return { id: project.id, count: 0 };
        }
      }),
    ).then((results) => {
      if (cancelled) {
        return;
      }

      const nextCounts: Record<string, number> = {};
      results.forEach((result) => {
        nextCounts[result.id] = result.count;
      });
      setProjectTenderCounts(nextCounts);
    });

    return () => {
      cancelled = true;
    };
  }, [projects]);

  useEffect(() => {
    getTenantsApi()
      .then((tenants) => setTenantCount(tenants.length))
      .catch(() => undefined);
  }, []);

  const handleStatusChange = async (projectId: string, status: 'active' | 'approved' | 'lost', note?: string) => {
    try {
      const updated = await updateProjectStatusApi(projectId, { status, note });
      setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)));
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { error?: string })?.error ?? 'Durum güncellenemedi')
        : 'Durum güncellenemedi';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  };

  return (
    <WorkspaceLayout>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700} color="#111827">İnşaatlar</Typography>
          {!loading && (
            <Typography variant="body2" color="text.secondary">{projects.length} kayıt</Typography>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
            : projects.length === 0
            ? (
              <Box sx={{ gridColumn: '1 / -1', py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9CA3AF', gap: 1 }}>
                <AssignmentIcon sx={{ fontSize: 48, opacity: 0.4 }} />
                <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>Henüz inşaat yok</Typography>
              </Box>
            )
            : projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                tenderCount={projectTenderCounts[p.id] ?? 0}
                tenantCount={tenantCount}
                isAdmin={user?.role === UserRole.COMPANY_ADMIN}
                onClick={() => router.push(`/workspace/projects/${p.id}`)}
                onStatusChange={(status, note) => void handleStatusChange(p.id, status, note)}
              />
            ))
          }
        </Box>
      </Box>
      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </WorkspaceLayout>
  );
}
