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
import type { FloorType } from '@core-panel/shared';
import { calculateSubcontractorMetraj, formatSubcontractorValue } from '@/utils/metrajSubcontractor';

const hCell = {
  fontWeight: 700,
  fontSize: 12,
  color: '#374151',
  backgroundColor: '#F3F4F6',
  py: 1,
  px: 1.5,
  whiteSpace: 'nowrap' as const,
};

const dCell = { fontSize: 13, py: 0.9, px: 1.5 };

interface Props {
  floorTypes: FloorType[];
}

export function SubcontractorMetrajTable({ floorTypes }: Props) {
  const rows = calculateSubcontractorMetraj(floorTypes);

  if (floorTypes.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
          Kat tipi ekleyerek taşeron metrajı oluşturun.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 640, tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={hCell}>Taşeron</TableCell>
            <TableCell sx={hCell}>İş Kalemi</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Birim</TableCell>
            <TableCell sx={{ ...hCell, textAlign: 'right' }}>Miktar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.subcontractor}-${row.item}`} sx={{ backgroundColor: index % 2 === 0 ? '#FAFAFA' : '#FFFFFF' }}>
              <TableCell sx={{ ...dCell, fontWeight: 600 }}>{row.subcontractor}</TableCell>
              <TableCell sx={dCell}>{row.item}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right', color: '#6B7280' }}>{row.unit}</TableCell>
              <TableCell sx={{ ...dCell, textAlign: 'right', fontWeight: 700 }}>{formatSubcontractorValue(row.value, row.unit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
