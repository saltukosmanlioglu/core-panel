'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { TenderForm } from '../tender-form';

export default function CreateTenderPage() {
  return (
    <DashboardLayout>
      <TenderForm />
    </DashboardLayout>
  );
}
