'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Drawer, Paper } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Apartment as ApartmentIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Gavel as GavelIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { Sidebar, type SidebarGroup } from './sidebar';
import { Navbar } from './navbar';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { UserRole } from '@core-panel/shared';

const superAdminGroups: SidebarGroup[] = [
  {
    label: 'Yönetim Paneli',
    items: [
      { label: 'Genel Bakış', icon: <DashboardIcon sx={{ fontSize: 20 }} />, href: '/admin', exact: true },
      { label: 'Şirketler', icon: <BusinessIcon sx={{ fontSize: 20 }} />, href: '/admin/companies' },
      { label: 'Taşeronlar', icon: <ApartmentIcon sx={{ fontSize: 20 }} />, href: '/admin/tenants' },
      { label: 'Kullanıcılar', icon: <PeopleIcon sx={{ fontSize: 20 }} />, href: '/admin/users' },
    ],
  },
  {
    label: 'Yönetim',
    items: [
      { label: 'İnşaatlar', icon: <AssignmentIcon sx={{ fontSize: 20 }} />, href: '/admin/projects' },
      { label: 'İhaleler', icon: <GavelIcon sx={{ fontSize: 20 }} />, href: '/admin/tenders' },
    ],
  },
];

const companyAdminGroups: SidebarGroup[] = [
  {
    label: 'Yönetim Paneli',
    items: [
      { label: 'Genel Bakış', icon: <DashboardIcon sx={{ fontSize: 20 }} />, href: '/admin', exact: true },
      { label: 'Şirketim', icon: <BusinessIcon sx={{ fontSize: 20 }} />, href: '/admin/companies' },
      { label: 'Taşeronlar', icon: <ApartmentIcon sx={{ fontSize: 20 }} />, href: '/admin/tenants' },
      { label: 'Kullanıcılar', icon: <PeopleIcon sx={{ fontSize: 20 }} />, href: '/admin/users' },
    ],
  },
  {
    label: 'Yönetim',
    items: [
      { label: 'İnşaatlar', icon: <AssignmentIcon sx={{ fontSize: 20 }} />, href: '/admin/projects' },
      { label: 'İhaleler', icon: <GavelIcon sx={{ fontSize: 20 }} />, href: '/admin/tenders' },
    ],
  },
];


interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { user, isLoading, logout } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const adminGroups =
    user?.role === UserRole.SUPER_ADMIN ? superAdminGroups : companyAdminGroups;

  useAuth();

  const isAllowedRole =
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN;

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isAllowedRole) router.push('/workspace');
  }, [isLoading, user, isAllowedRole, router]);

  const sidebarWidth = sidebarCollapsed ? 56 : 240;

  if (isLoading || !user || !isAllowedRole) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress sx={{ color: '#1F2937' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          transition: 'width 0.2s ease',
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            boxSizing: 'border-box',
            border: 'none',
            borderRadius: 0,
            boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          },
        }}
      >
        <Sidebar
          title="Yönetim Paneli"
          groups={adminGroups}
          user={{ name: user.name, email: user.email, role: user.role }}
          onLogout={logout}
          collapsed={sidebarCollapsed}
        />
      </Drawer>

      {/* Main */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: 0,
          transition: 'margin-left 0.2s ease',
        }}
      >
        <Navbar onMenuToggle={() => setSidebarCollapsed((v) => !v)} sidebarCollapsed={sidebarCollapsed} />

        {/* Content */}
        <Box sx={{ flex: 1, p: 4, backgroundColor: '#F8F9FA' }}>
          <Paper elevation={0} sx={{ borderRadius: '4px', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', p: 3, minHeight: '100%' }}>
            {children}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
