'use client';

import { Box, Typography } from '@mui/material';
import { GridOn as GridOnIcon } from '@mui/icons-material';

export default function FloorPlanPage() {
  return (
    <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9CA3AF', gap: 1 }}>
      <GridOnIcon sx={{ fontSize: 48, opacity: 0.4 }} />
      <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>Kat Planı yakında</Typography>
    </Box>
  );
}
