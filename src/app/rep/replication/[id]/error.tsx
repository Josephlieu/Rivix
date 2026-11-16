'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

// The last safety net for one replication request: if anything on the page throws while drawing (outside the parts that have
// their own boundary), show this instead of the bare "This page couldn't load". Only the message goes to the console.
export default function ReplicationRequestError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error('Replication request page could not be shown:', error instanceof Error ? error.message : 'unknown error');
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <p className="text-sm font-bold">This request couldn&apos;t be shown.</p>
      <p className="mt-1 text-[13px]">Nothing was changed. Try again, or go back to the Replication Queue.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">Try again</button>
        <Link href="/rep/replication" className="rounded-lg border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">Back to the queue</Link>
      </div>
    </div>
  );
}
