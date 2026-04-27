'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { FormButton } from '@/components/form-elements';
import { getTenderItemsApi } from '@/services/tender-items/api';
import { getTendersApi } from '@/services/workspace/api';
import type { Tender } from '@core-panel/shared';

const statusColors: Record<string, { backgroundColor: string; color: string }> = {
  draft: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  open: { backgroundColor: '#DCFCE7', color: '#15803D' },
  closed: { backgroundColor: '#FEF3C7', color: '#92400E' },
  awarded: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
};

export default function ProjectTendersPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const projectTenders = await getTendersApi({ projectId: id });
        const countEntries = await Promise.all(
          projectTenders.map(async (tender) => {
            const items = await getTenderItemsApi(tender.id);
            return [tender.id, items.length] as const;
          }),
        );

        if (!active) {
          return;
        }

        setTenders(projectTenders);
        setItemCounts(Object.fromEntries(countEntries));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827' }}>
          İhaleler
        </Typography>
        {!loading ? (
          <Typography variant="body2" color="text.secondary">
            {tenders.length} kayıt
          </Typography>
        ) : null}
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Deadline</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : tenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" sx={{ color: '#6B7280', py: 2 }}>
                    Bu inşaata ait ihale yok.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tenders.map((tender) => {
                const colors = statusColors[tender.status] ?? statusColors.draft;

                return (
                  <TableRow key={tender.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {tender.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{tender.categoryName ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={tender.status}
                        sx={{ ...colors, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>{tender.deadline ? new Date(tender.deadline).toLocaleDateString('tr-TR') : '—'}</TableCell>
                    <TableCell>{itemCounts[tender.id] ?? 0}</TableCell>
                    <TableCell align="right">
                      <FormButton
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/workspace/projects/${id}/tenders/${tender.id}`)}
                      >
                        Yönet
                      </FormButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
