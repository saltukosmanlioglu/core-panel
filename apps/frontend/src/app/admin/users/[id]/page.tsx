'use client';

import { use } from 'react';
import { UserForm } from '../user-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: Props) {
  const { id } = use(params);
  return <UserForm id={id} />;
}
