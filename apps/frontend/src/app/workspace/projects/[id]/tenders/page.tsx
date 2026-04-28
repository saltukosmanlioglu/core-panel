'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
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
import { Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { TenderStatusChip } from '@/components/tender-status-chip';
import { getTenderItemsApi } from '@/services/tender-items/api';
import { getTendersApi } from '@/services/workspace/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';
import type { Tender } from '@core-panel/shared';

export default function ProjectTendersPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { showError, notificationProps } = useSnackbar();

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
      } catch (err: unknown) {
        showError(getErrorMessage(err, 'İhaleler yüklenemedi'));
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
              <TableCell sx={{ fontWeight: 700 }}>Başlık</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kategori</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Durum</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Son Tarih</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kalem</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>İşlemler</TableCell>
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
              tenders.map((tender) => (
                  <TableRow key={tender.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {tender.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{tender.categoryName ?? '—'}</TableCell>
                    <TableCell>
                      <TenderStatusChip status={tender.status} />
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
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Notification {...notificationProps} />
    </Box>
  );
}
