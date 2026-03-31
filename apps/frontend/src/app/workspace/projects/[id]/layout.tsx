'use client';

import { useParams } from 'next/navigation';
import { Gavel as GavelIcon, Payments as PaymentsIcon, SwapVert as SwapVertIcon, Dashboard as OverviewIcon } from '@mui/icons-material';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import type { SidebarGroup } from '@/components/layout/sidebar';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const base = `/workspace/projects/${id}`;

  const projectGroups: SidebarGroup[] = [
    {
      label: 'İnşaat',
      items: [
        { label: 'Genel Bakış',  icon: <OverviewIcon sx={{ fontSize: 20 }} />,  href: base,                    exact: true },
        { label: 'İhaleler',     icon: <GavelIcon sx={{ fontSize: 20 }} />,      href: `${base}/tenders` },
        { label: 'Ödemeler',    icon: <PaymentsIcon sx={{ fontSize: 20 }} />,   href: `${base}/payments` },
        { label: 'Gelir-Gider', icon: <SwapVertIcon sx={{ fontSize: 20 }} />,   href: `${base}/income-outcome` },
      ],
    },
  ];

  return (
    <WorkspaceLayout groups={projectGroups}>
      {children}
    </WorkspaceLayout>
  );
}
