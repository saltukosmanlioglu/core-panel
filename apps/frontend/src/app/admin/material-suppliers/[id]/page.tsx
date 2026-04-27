'use client';

import { use } from 'react';
import { MaterialSupplierForm } from '../material-supplier-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditMaterialSupplierPage({ params }: Props) {
  const { id } = use(params);
  return <MaterialSupplierForm id={id} />;
}
