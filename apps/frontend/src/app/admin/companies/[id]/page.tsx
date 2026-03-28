'use client';

import { use } from 'react';
import { CompanyForm } from '../company-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditCompanyPage({ params }: Props) {
  const { id } = use(params);
  return <CompanyForm id={id} />;
}
