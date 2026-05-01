'use client';

import { Box, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';

interface Props {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
}

export const StatCard = ({ value, label, icon, color, href }: Props) => {
  const router = useRouter();

  return (
    <Box
      onClick={href ? () => router.push(href) : undefined}
      sx={{
        flex: 1,
        borderLeft: `4px solid ${color}`,
        borderRadius: 2,
        p: 2.5,
        backgroundColor: `${color}0d`,
        cursor: href ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'opacity 0.2s',
        '&:hover': href ? { opacity: 0.85 } : {},
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ color, opacity: 0.7, display: 'flex' }}>{icon}</Box>
    </Box>
  );
};
