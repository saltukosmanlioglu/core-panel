'use client';

import { Box, Typography } from '@mui/material';
import { Calculate as CalculateIcon } from '@mui/icons-material';

export default function AreaCalculationPage() {
  return (
    <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9CA3AF', gap: 1 }}>
      <CalculateIcon sx={{ fontSize: 48, opacity: 0.4 }} />
      <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>İnşaat Alanı Hesaplama yakında</Typography>
    </Box>
  );
}
