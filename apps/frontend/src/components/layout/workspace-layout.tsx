'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Drawer, Paper } from '@mui/material';
import {
  Assignment as AssignmentIcon,
  ArrowBack as ArrowBackIcon,
  Calculate as CalculateIcon,
  CropFree as CropFreeIcon,
  Description as DescriptionIcon,
  Gavel as GavelIcon,
  FormatListNumbered as MetrajIcon,
} from '@mui/icons-material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, type SidebarGroup } from './sidebar';
import { Navbar } from './navbar';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  groups?: SidebarGroup[];
}

export function WorkspaceLayout({ children, groups }: WorkspaceLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const projectMatch = pathname.match(/\/workspace\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];
  const isInsideProject = !!projectId && pathname !== '/workspace/projects';
  const projectBase = isInsideProject ? `/workspace/projects/${projectId}` : null;
  const dashboardGroups: SidebarGroup[] = projectBase
    ? [
      {
        items: [
          { label: 'İnşaatlara Dön', icon: <ArrowBackIcon sx={{ fontSize: 18 }} />, href: '/workspace/projects', exact: true },
          {
            label: 'Proje Araçları',
            icon: <CalculateIcon sx={{ fontSize: 18 }} />,
            href: `${projectBase}/tools`,
            defaultOpen: true,
            toggleOnly: true,
            children: [
              { label: 'Taban Oturum Alanı', icon: <CropFreeIcon fontSize="small" />, href: `${projectBase}/parcel-calculation`, color: '#0ea5e9' },
              { label: 'Teklif Oluştur', icon: <DescriptionIcon fontSize="small" />, href: `${projectBase}/offer-documents`, color: '#1B3A5C' },
              { label: 'Metraj', icon: <MetrajIcon fontSize="small" />, href: `${projectBase}/metraj`, color: '#7C3AED' },
            ],
          },
          {
            label: 'İhale',
            icon: <GavelIcon sx={{ fontSize: 18 }} />,
            href: `${projectBase}/procurement`,
            defaultOpen: true,
            toggleOnly: true,
            children: [
              { label: 'İhaleler', icon: <GavelIcon fontSize="small" />, href: `${projectBase}/tenders`, color: '#f59e0b' },
            ],
          },
        ],
      },
    ]
    : [
      {
        label: 'Hızlı Erişim',
        items: [
          { label: 'Çalışma Alanı', icon: <DashboardIcon sx={{ fontSize: 18 }} />, href: '/workspace', exact: true },
          { label: 'İnşaatlar', icon: <AssignmentIcon sx={{ fontSize: 18 }} />, href: '/workspace/projects' },
        ],
      },
    ];

  useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.push('/login');
  }, [isLoading, user, router]);

  const sidebarWidth = sidebarCollapsed ? 56 : 260;

  if (isLoading || !user) {
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
          title="Çalışma Alanı"
          groups={groups ?? dashboardGroups}
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
