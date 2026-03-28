'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProjectForm } from '../project-form';

export default function CreateProjectPage() {
  return (
    <DashboardLayout>
      <ProjectForm />
    </DashboardLayout>
  );
}
