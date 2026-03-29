'use client';

import { use } from 'react';
import { ProjectForm } from '../project-form';

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectForm id={id} />;
}
