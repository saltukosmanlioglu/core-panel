'use client';

import { Box, IconButton } from '@mui/material';
import { Menu as MenuIcon, MenuOpen as MenuOpenIcon } from '@mui/icons-material';

export interface NavbarProps {
  onMenuToggle: () => void;
  sidebarCollapsed?: boolean;
}

export function Navbar({ onMenuToggle, sidebarCollapsed = false }: NavbarProps) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        height: '56px',
        px: 2,
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        borderRadius: 0,
      }}
    >
      <IconButton size="small" onClick={onMenuToggle} sx={{ color: '#6B7280', '&:hover': { color: '#111827' } }}>
        {sidebarCollapsed ? <MenuIcon sx={{ fontSize: 20 }} /> : <MenuOpenIcon sx={{ fontSize: 20 }} />}
      </IconButton>
    </Box>
  );
}
