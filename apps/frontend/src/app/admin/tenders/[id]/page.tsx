'use client';

import { use } from 'react';
import { TenderForm } from '../tender-form';

export default function EditTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TenderForm id={id} />;
}
