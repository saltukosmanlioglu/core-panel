'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import type {
  Edge,
  ParcelCalculation,
} from '@/services/parcel-calculations/types';
import type {
  EdgeRole,
  NumericInputValue,
} from '../types';
import {
  formatArea,
  numberFormatter,
} from '../utils';

interface ZoningSummaryProps {
  edges: Edge[];
  edgeRoles: EdgeRole[];
  edgeSetbacks: NumericInputValue[];
  calculationResult: ParcelCalculation | null;
  floorCount: number;
  onBack: () => void;
  onNext: () => void;
}

export function ZoningSummary({
  edges,
  edgeRoles,
  edgeSetbacks,
  calculationResult,
  floorCount,
  onBack,
  onNext,
}: ZoningSummaryProps) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          İmar Durumu Özeti
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
          Belgelerden okunan ve hesaplanan imar bilgileri
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
              Yapılaşma Koşulları
            </Typography>
            {[
              ['TAKS', '0.30'],
              ['KAKS', '1.50'],
              ['Kat Adedi', floorCount],
              ['Bina Yüksekliği', '—'],
              ['İnşaat Nizamı', '—'],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{String(value)}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
              Bahçe Çekmeleri
            </Typography>
            {edges.map((edge, index) => {
              const role = edgeRoles[index] ?? 'side';
              if (role === 'inactive') return null;
              const roleLabel = role === 'front' ? 'Yol' : role === 'side' ? 'Yan' : 'Arka';
              return (
                <Box key={`${edge.label}-summary-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
                  <Typography sx={{ fontSize: 12 }}>
                    {edge.label || String.fromCharCode(65 + index)} ({roleLabel})
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                    {numberFormatter.format(parseFloat(String(edgeSetbacks[index] ?? 0)) || 0)} m
                  </Typography>
                </Box>
              );
            })}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
              Hesaplama Sonuçları
            </Typography>
            {[
              ['Parsel Alanı', calculationResult?.parcelArea ? formatArea(calculationResult.parcelArea) : '—'],
              ['Taban Oturumu', calculationResult?.footprintArea ? formatArea(calculationResult.footprintArea) : '—'],
              ['Toplam İnşaat', calculationResult?.totalConstructionArea ? formatArea(calculationResult.totalConstructionArea) : '—'],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{value}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button size="small" variant="outlined" onClick={onBack}>
          ← Geri
        </Button>
        <Button size="small" variant="contained" onClick={onNext}>
          Sonuçları Gör →
        </Button>
      </Box>
    </Stack>
  );
}
