'use client';

import { Box, Typography } from '@mui/material';
import { SwapVert as SwapVertIcon } from '@mui/icons-material';

export default function ProjectIncomeOutcomePage() {
  return (
    <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9CA3AF', gap: 1 }}>
      <SwapVertIcon sx={{ fontSize: 48, opacity: 0.4 }} />
      <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>Gelir-Gider yakında</Typography>
    </Box>
  );
}
