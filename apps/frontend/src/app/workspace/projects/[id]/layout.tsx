'use client';

import { WorkspaceLayout } from '@/components/layout/workspace-layout';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceLayout>
      {children}
    </WorkspaceLayout>
  );
}
