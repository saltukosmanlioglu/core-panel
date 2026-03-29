'use client';

import { useState } from 'react';
import { UserRole } from '@core-panel/shared';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Logout as LogoutIcon,
  ManageAccounts as ManageAccountsIcon,
  ArrowBack as ArrowBackIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';

export interface SidebarNavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  exact?: boolean;
}

export interface SidebarGroup {
  label: string;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  title: string;
  groups: SidebarGroup[];
  user: {
    name: string | null;
    email: string;
    role: string;
  };
  onLogout: () => void;
  collapsed?: boolean;
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? 'A').slice(0, 2).toUpperCase();
}

export function Sidebar({ title, groups, user, onLogout, collapsed = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const isActive = (item: SidebarNavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const onAdmin = pathname.startsWith('/admin');
  const onDashboard = pathname.startsWith('/dashboard');
  const initials = getInitials(user.name, user.email);

  return (
    <Box
      sx={{
        width: collapsed ? 56 : 240,
        height: '100%',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box sx={{ px: collapsed ? 1 : 2, height: '56px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="#1F2937" opacity="0.9" />
            <path d="M9 12L11 14L15 10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!collapsed && (
            <Typography sx={{ color: '#111827', fontWeight: 700, fontSize: '16px' }}>
              {title}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Nav groups */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {groups.map((group) => (
          <Box key={group.label}>
            {!collapsed && (
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#9CA3AF',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  px: 2,
                  pt: 3,
                  pb: 1,
                }}
              >
                {group.label}
              </Typography>
            )}
            {collapsed && <Box sx={{ pt: 2 }} />}
            <List disablePadding sx={{ px: collapsed ? 0.5 : 1 }}>
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <ListItem key={item.href + item.label} disablePadding sx={{ mb: '2px' }}>
                    <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                      <ListItemButton
                        onClick={() => router.push(item.href)}
                        sx={{
                          borderRadius: '8px',
                          px: collapsed ? 1 : 2,
                          py: '10px',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          backgroundColor: active ? '#EEF2FF' : 'transparent',
                          '&:hover': {
                            backgroundColor: active ? '#EEF2FF' : '#F3F4F6',
                            '& .nav-icon': { color: active ? '#0A2463' : '#111827' },
                            '& .nav-text': { color: active ? '#0A2463' : '#111827' },
                          },
                        }}
                      >
                        <ListItemIcon
                          className="nav-icon"
                          sx={{
                            color: active ? '#0A2463' : '#6B7280',
                            minWidth: collapsed ? 'unset' : 36,
                            transition: 'color 0.15s',
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        {!collapsed && (
                          <ListItemText
                            primary={item.label}
                            className="nav-text"
                            primaryTypographyProps={{
                              fontSize: '14px',
                              fontWeight: active ? 600 : 500,
                              color: active ? '#0A2463' : '#374151',
                              sx: { transition: 'color 0.15s' },
                            }}
                          />
                        )}
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom user section */}
      <Box
        sx={{
          borderTop: '1px solid #E5E7EB',
          p: collapsed ? 1 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: collapsed ? 0 : 1.5,
        }}
      >
        <Tooltip title={collapsed ? `${user.name ?? user.email}\n${user.email}` : ''} placement="right" arrow>
          <Avatar
            onClick={collapsed ? (e) => setMenuAnchor(e.currentTarget) : undefined}
            sx={{
              width: 36,
              height: 36,
              backgroundColor: '#E5E7EB',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 600,
              flexShrink: 0,
              cursor: collapsed ? 'pointer' : 'default',
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>

        {!collapsed && (
          <>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {user.name && (
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </Typography>
              )}
              <Typography sx={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ color: '#9CA3AF', flexShrink: 0, '&:hover': { color: '#374151' } }}
            >
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
          PaperProps={{ sx: { minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } }}
        >
          <MenuItem onClick={() => setMenuAnchor(null)} sx={{ fontSize: '14px', gap: 1.5 }}>
            <ManageAccountsIcon sx={{ fontSize: 18, color: '#6B7280' }} />
            Hesabım
          </MenuItem>
          {onAdmin && (
            <MenuItem onClick={() => { setMenuAnchor(null); router.push('/dashboard'); }} sx={{ fontSize: '14px', gap: 1.5 }}>
              <ArrowBackIcon sx={{ fontSize: 18, color: '#6B7280' }} />
              Panele Dön
            </MenuItem>
          )}
          {onDashboard && (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.COMPANY_ADMIN) && (
            <MenuItem onClick={() => { setMenuAnchor(null); router.push('/admin'); }} sx={{ fontSize: '14px', gap: 1.5 }}>
              <AdminPanelSettingsIcon sx={{ fontSize: 18, color: '#6B7280' }} />
              Yönetime Git
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={() => { setMenuAnchor(null); onLogout(); }} sx={{ fontSize: '14px', gap: 1.5, color: '#EF4444' }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
            Çıkış Yap
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
