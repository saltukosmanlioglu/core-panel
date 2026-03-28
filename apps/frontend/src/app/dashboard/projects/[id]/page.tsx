'use client';

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProjectForm } from '../project-form';

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <DashboardLayout>
      <ProjectForm id={id} />
    </DashboardLayout>
  );
}
