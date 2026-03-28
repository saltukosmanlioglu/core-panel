'use client';

import { Box, Card } from '@mui/material';

interface AuthLayoutProps {
  children: React.ReactNode;
  maxWidth?: number;
}

export function AuthLayout({ children, maxWidth = 480 }: AuthLayoutProps) {
  return (
    <Box
      className="min-h-screen flex items-center justify-center p-4"
      sx={{ backgroundColor: '#F8F9FA' }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth,
          p: { xs: 3, sm: 4 },
          borderRadius: '4px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        }}
      >
        {children}
      </Card>
    </Box>
  );
}
