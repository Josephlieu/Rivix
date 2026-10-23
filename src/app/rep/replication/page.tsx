'use client';

import ReplicationQueue from '@/app/admin/replication/ReplicationQueue';

// A sales rep's own replication requests (the server only returns the ones they own).
export default function RepReplicationPage() {
  return <ReplicationQueue role="rep" />;
}
