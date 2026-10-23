'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ReplicationDetail from '@/app/admin/replication/ReplicationDetail';

// A sales rep's view of one of their own replication requests (the server only returns requests they own).
export default function RepReplicationRequestPage() {
  const { id } = useParams<{ id: string }>();
  return <Suspense fallback={null}><ReplicationDetail role="rep" idOrCode={String(id)} /></Suspense>;
}
