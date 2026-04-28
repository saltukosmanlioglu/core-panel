'use client';
import { Box } from '@mui/material';
import { getTenderStatusConfig } from '@/utils/tenderStatus';

interface Props {
  status: string;
  size?: 'small' | 'medium';
}

export const TenderStatusChip = ({ status, size = 'small' }: Props) => {
  const config = getTenderStatusConfig(status);
  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      backgroundColor: config.bg,
      color: config.color,
      borderRadius: 10,
      px: size === 'small' ? 1.25 : 1.75,
      py: size === 'small' ? 0.4 : 0.6,
      fontSize: size === 'small' ? 11 : 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {config.label}
    </Box>
  );
};
