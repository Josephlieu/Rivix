'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ReplicationDetail from '../ReplicationDetail';

export default function AdminReplicationRequestPage() {
  const { id } = useParams<{ id: string }>();
  return <Suspense fallback={null}><ReplicationDetail role="admin" idOrCode={String(id)} /></Suspense>;
}
