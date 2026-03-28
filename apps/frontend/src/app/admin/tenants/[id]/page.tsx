'use client';

import { use } from 'react';
import { TenantForm } from '../tenant-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditTenantPage({ params }: Props) {
  const { id } = use(params);
  return <TenantForm id={id} />;
}
