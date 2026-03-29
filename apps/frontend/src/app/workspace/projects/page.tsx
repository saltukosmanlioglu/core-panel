'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, Chip, Typography, Skeleton } from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import { getProjectsApi } from '@/services/workspace/api';
import type { Project } from '@core-panel/shared';

const statusConfig: Record<string, { bg: string; color: string; band: string }> = {
  active:    { bg: '#DCFCE7', color: '#15803D', band: '#22C55E' },
  inactive:  { bg: '#F3F4F6', color: '#6B7280', band: '#9CA3AF' },
  completed: { bg: '#DBEAFE', color: '#1D4ED8', band: '#3B82F6' },
};

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const cfg = statusConfig[project.status] ?? statusConfig.active;
  return (
    <Card onClick={onClick} sx={{ aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } }}>
      {/* Color band */}
      <Box sx={{ height: 6, backgroundColor: cfg.band, flexShrink: 0 }} />

      {/* Body */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5, gap: 1, minHeight: 0 }}>
        {/* Icon + name */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ mt: 0.25, color: cfg.band, flexShrink: 0 }}>
            <AssignmentIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#111827', lineHeight: 1.3, flex: 1 }}>
            {project.name}
          </Typography>
        </Box>

        {/* Description */}
        <Typography sx={{
          fontSize: '12px', color: '#6B7280', lineHeight: 1.5, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {project.description ?? 'Açıklama girilmemiş.'}
        </Typography>

        {/* Footer */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 1 }}>
          <Chip
            label={project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            size="small"
            sx={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: '11px', height: 22 }}
          />
          <Typography sx={{ fontSize: '11px', color: '#9CA3AF' }}>
            {new Date(project.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Box sx={{ aspectRatio: '16 / 9' }}>
      <Skeleton variant="rounded" width="100%" height="100%" />
    </Box>
  );
}

export default function DashboardProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectsApi()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceLayout>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700} color="#111827">İnşaatlar</Typography>
          {!loading && (
            <Typography variant="body2" color="text.secondary">{projects.length} kayıt</Typography>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
            : projects.length === 0
            ? (
              <Box sx={{ gridColumn: '1 / -1', py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9CA3AF', gap: 1 }}>
                <AssignmentIcon sx={{ fontSize: 48, opacity: 0.4 }} />
                <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>Henüz inşaat yok</Typography>
              </Box>
            )
            : projects.map((p) => <ProjectCard key={p.id} project={p} onClick={() => router.push(`/workspace/projects/${p.id}`)} />)
          }
        </Box>
      </Box>
    </WorkspaceLayout>
  );
}
