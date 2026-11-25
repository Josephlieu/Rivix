import { NextResponse } from 'next/server';
import { getCurrentRep } from '@/lib/current-rep';
import { createAdminClient } from '@/lib/supabase-admin';
import { listSamples } from '@/lib/sample-requests';

// Sample requests from this rep's OWN customers only (the customer's current rep), newest first (2026-11-26).
export async function GET() {
  const rep = await getCurrentRep();
  if (!rep) return NextResponse.json({ error: 'Only sales reps can see this.' }, { status: 403 });
  return NextResponse.json({ samples: await listSamples(createAdminClient(), { repId: rep.id }) });
}
