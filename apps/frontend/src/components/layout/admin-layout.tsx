'use client';

import { useEffect, useState } from 'react';
import { Avatar, Box, CircularProgress, Drawer, Paper } from '@mui/material';
import {
  Apartment as ApartmentIcon,
  Badge as BadgeIcon,
  Business as BusinessIcon,
  Construction as ConstructionIcon,
  People as PeopleIcon,
  Inventory2 as Inventory2Icon,
  Label as LabelIcon,
  Gavel as GavelIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { Sidebar, type SidebarGroup } from './sidebar';
import { Navbar } from './navbar';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { getCompaniesApi } from '@/services/admin/api';
import { UserRole } from '@core-panel/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { user, isLoading, logout } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [companyName, setCompanyName] = useState('Şirket Profili');
  const [companyLogoPath, setCompanyLogoPath] = useState<string | null>(null);

  useAuth();

  const isAllowedRole = user?.role === UserRole.COMPANY_ADMIN;

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isAllowedRole) router.push('/workspace');
  }, [isLoading, user, isAllowedRole, router]);

  const sidebarWidth = sidebarCollapsed ? 56 : 240;
  const companyLogoUrl = companyLogoPath ? `${API_URL}${companyLogoPath}` : null;
  const companyProfileIcon = companyLogoUrl ? (
    <Avatar src={companyLogoUrl} sx={{ width: 24, height: 24 }} />
  ) : (
    <BadgeIcon fontSize="small" />
  );

  const adminGroups: SidebarGroup[] = [
    {
      label: 'Yönetim Paneli',
      items: [
        {
          label: 'Şirketim',
          icon: <BusinessIcon sx={{ fontSize: 20 }} />,
          href: '/admin/my-company',
          defaultOpen: true,
          toggleOnly: true,
          children: [
            { label: companyName, href: '/admin/my-company', color: '#64748b', icon: companyProfileIcon },
            { label: 'Kategoriler', href: '/admin/categories', color: '#0ea5e9', icon: <LabelIcon fontSize="small" /> },
            { label: 'Taşeronlar', href: '/admin/tenants', color: '#f59e0b', icon: <ConstructionIcon fontSize="small" /> },
            { label: 'Malzemeciler', href: '/admin/material-suppliers', color: '#7c3aed', icon: <Inventory2Icon fontSize="small" /> },
            { label: 'Kullanıcılar', href: '/admin/users', color: '#f43f5e', icon: <PeopleIcon fontSize="small" /> },
          ],
        },
      ],
    },
    {
      label: 'Yönetim',
      items: [
        { label: 'İnşaatlar', icon: <ApartmentIcon sx={{ fontSize: 20 }} />, href: '/admin/projects' },
        { label: 'İhaleler', icon: <GavelIcon sx={{ fontSize: 20 }} />, href: '/admin/tenders' },
      ],
    },
  ];

  useEffect(() => {
    getCompaniesApi()
      .then((companies) => {
        const company = companies[0];
        if (company?.name) setCompanyName(company.name);
        setCompanyLogoPath(company?.logoPath ?? null);
      })
      .catch(() => {});
  }, []);

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
