'use client';

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { TenderForm } from '../tender-form';

export default function EditTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <DashboardLayout>
      <TenderForm id={id} />
    </DashboardLayout>
  );
}
