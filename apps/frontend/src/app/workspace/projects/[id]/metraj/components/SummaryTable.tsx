'use client';

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { calculateTakeoff } from '@core-panel/shared';
import type { FloorType } from '@core-panel/shared';

const n2 = (v: number) => v.toFixed(2);

const hCell = {
  fontWeight: 700,
  fontSize: 12,
  color: '#374151',
  backgroundColor: '#F3F4F6',
  py: 1,
  px: 1.5,
  whiteSpace: 'nowrap' as const,
};

const dCell = { fontSize: 13, py: 0.75, px: 1.5 };

const totalCell = {
  fontWeight: 700,
  fontSize: 13,
  backgroundColor: '#1F2937',
  color: '#FFFFFF',
  py: 1,
  px: 1.5,
};

interface Props {
  floorTypes: FloorType[];
  parcelFootprintArea?: number | null;
}

export function SummaryTable({ floorTypes, parcelFootprintArea }: Props) {
  const result = calculateTakeoff(floorTypes);
  const hasParcelFootprint = parcelFootprintArea != null;
  const difference = hasParcelFootprint ? result.totals.grossFloorArea - parcelFootprintArea : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2, p: 2, backgroundColor: '#F0F9FF', borderRadius: 1, border: '1px solid #BAE6FD' }}>
        <Box sx={{ minWidth: 180 }}>
          <Typography variant="caption" sx={{ color: '#0369A1' }}>Taban Oturum Alanı</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{hasParcelFootprint ? `${n2(parcelFootprintArea)} m²` : '-'}</Typography>
        </Box>
        <Box sx={{ minWidth: 180 }}>
          <Typography variant="caption" sx={{ color: '#0369A1' }}>Metraj Brüt Alan</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{n2(result.totals.grossFloorArea)} m²</Typography>
        </Box>
        <Box sx={{ minWidth: 180 }}>
          <Typography variant="caption" sx={{ color: '#0369A1' }}>Fark</Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: difference == null ? '#6B7280' : Math.abs(difference) < 1 ? '#16A34A' : '#DC2626' }}
          >
            {difference == null ? '-' : `${difference.toFixed(2)} m²`}
          </Typography>
        </Box>
      </Box>

      {floorTypes.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
            Kat tipi ekleyerek hesaplama başlatın.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 900, tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={hCell}>Kat Tipi</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Adet</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Brüt Alan (m²)</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Tavan (m²)</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Brüt Duvar (m²)</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Net Duvar (m²)</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Süpürgelik (mt)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {result.floorTypes.map((ft, i) => (
            <TableRow key={ft.floorTypeId} sx={{ backgroundColor: i % 2 === 0 ? '#FAFAFA' : '#FFFFFF' }}>
              <TableCell sx={dCell}>{ft.label}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right', color: '#6B7280' }}>×{ft.quantity}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right' }}>{n2(ft.total.grossFloorArea)}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right' }}>{n2(ft.total.ceilingArea)}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right' }}>{n2(ft.total.grossWallArea)}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right' }}>{n2(ft.total.netWallArea)}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right' }}>{n2(ft.total.skirtingLinear)}</TableCell>
            </TableRow>
          ))}

          {/* Totals row */}
          <TableRow>
            <TableCell sx={totalCell} colSpan={2}>Toplam</TableCell>
            <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n2(result.totals.grossFloorArea)}</TableCell>
            <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n2(result.totals.ceilingArea)}</TableCell>
            <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n2(result.totals.grossWallArea)}</TableCell>
            <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n2(result.totals.netWallArea)}</TableCell>
            <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n2(result.totals.skirtingLinear)}</TableCell>
          </TableRow>
        </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
