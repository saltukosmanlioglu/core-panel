'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Card, Chip, Typography, Skeleton } from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';
import { getTendersApi } from '@/services/workspace/api';
import type { Tender } from '@core-panel/shared';

const statusConfig: Record<string, { bg: string; color: string; band: string }> = {
  draft:   { bg: '#F3F4F6', color: '#6B7280', band: '#9CA3AF' },
  open:    { bg: '#DCFCE7', color: '#15803D', band: '#22C55E' },
  closed:  { bg: '#FEF3C7', color: '#92400E', band: '#F59E0B' },
  awarded: { bg: '#DBEAFE', color: '#1D4ED8', band: '#3B82F6' },
};

function TenderCard({ tender, onClick }: { tender: Tender; onClick: () => void }) {
  const cfg = statusConfig[tender.status] ?? statusConfig.draft;
  return (
    <Card onClick={onClick} sx={{ aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } }}>
      <Box sx={{ height: 6, backgroundColor: cfg.band, flexShrink: 0 }} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5, gap: 1, minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ mt: 0.25, color: cfg.band, flexShrink: 0 }}>
            <GavelIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#111827', lineHeight: 1.3, flex: 1 }}>
            {tender.title}
          </Typography>
        </Box>
        <Typography sx={{
          fontSize: '12px', color: '#6B7280', lineHeight: 1.5, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {tender.description ?? 'Açıklama girilmemiş.'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 1 }}>
          <Chip
            label={tender.status.charAt(0).toUpperCase() + tender.status.slice(1)}
            size="small"
            sx={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: '11px', height: 22 }}
          />
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {tender.budget && (
              <Typography sx={{ fontSize: '11px', color: '#374151', fontWeight: 600 }}>
                ${Number(tender.budget).toLocaleString()}
              </Typography>
            )}
            {tender.deadline && (
              <Typography sx={{ fontSize: '11px', color: '#9CA3AF' }}>
                {new Date(tender.deadline).toLocaleDateString()}
              </Typography>
            )}
          </Box>
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

export default function ProjectTendersPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTendersApi()
      .then((all) => setTenders(all.filter((t) => t.projectId === id)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Box>
      {!loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{tenders.length} kayıt</Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : tenders.length === 0
          ? (
            <Box sx={{ gridColumn: '1 / -1', py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9CA3AF', gap: 1 }}>
              <GavelIcon sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>Bu inşaata ait ihale yok</Typography>
            </Box>
          )
          : tenders.map((t) => (
            <TenderCard key={t.id} tender={t} onClick={() => router.push(`/admin/tenders/${t.id}`)} />
          ))
        }
      </Box>
    </Box>
  );
}
