'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import { Menu as MenuIcon, MenuOpen as MenuOpenIcon, Notifications as NotificationsIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { PaymentNotification } from '@core-panel/shared';
import {
  getUnreadPaymentNotificationsApi,
  markAllNotificationsReadApi,
  markPaymentNotificationReadApi,
} from '@/services/payments/api';

export interface NavbarProps {
  onMenuToggle: () => void;
  sidebarCollapsed?: boolean;
}

export function Navbar({ onMenuToggle, sidebarCollapsed = false }: NavbarProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchNotifications() {
    try {
      const data = await getUnreadPaymentNotificationsApi();
      setNotifications(data);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    void fetchNotifications();
    intervalRef.current = setInterval(() => { void fetchNotifications(); }, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function handleNotificationClick(n: PaymentNotification) {
    try {
      await markPaymentNotificationReadApi(n.id);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    } catch {
      // ignore
    }
    setAnchorEl(null);
    if (n.relatedProjectId) {
      router.push(`/workspace/projects/${n.relatedProjectId}/payments`);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsReadApi();
      setNotifications([]);
    } catch {
      // ignore
    }
  }

  const open = Boolean(anchorEl);

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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

      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: '#6B7280', '&:hover': { color: '#111827' } }}
      >
        <Badge badgeContent={notifications.length} color="error" max={99}>
          <NotificationsIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 480, display: 'flex', flexDirection: 'column' } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Bildirimler {notifications.length > 0 && `(${notifications.length})`}
          </Typography>
          {notifications.length > 0 && (
            <Button size="small" onClick={handleMarkAllRead} sx={{ fontSize: 12, textTransform: 'none', color: '#6B7280' }}>
              Tümünü Okundu İşaretle
            </Button>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Okunmamış bildirim yok</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ overflowY: 'auto' }}>
            {notifications.map((n) => (
              <ListItem key={n.id} disablePadding divider>
                <ListItemButton onClick={() => handleNotificationClick(n)} sx={{ px: 2, py: 1 }}>
                  <ListItemText
                    primary={n.message}
                    secondary={new Date(n.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </Box>
  );
}
