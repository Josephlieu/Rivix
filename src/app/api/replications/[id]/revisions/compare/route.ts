import { NextRequest, NextResponse } from 'next/server';
import { adminTechFile, seqParam } from '@/lib/tech-file-access';
import { describeChanges, type TechFileSnapshot } from '@/lib/revisions';

// Task 30: what changed between two revisions (admin only): ?from=<seq>&to=<seq>.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminTechFile((await params).id);
  if (ctx instanceof NextResponse) return ctx;
  const from = seqParam(req.nextUrl.searchParams.get('from') ?? ''), to = seqParam(req.nextUrl.searchParams.get('to') ?? '');
  if (!from || !to) return NextResponse.json({ error: 'Choose two revisions.' }, { status: 400 });
  const { data } = await ctx.admin.from('replication_revisions').select('seq, snapshot').eq('replication_id', ctx.row.id).in('seq', [from, to]);
  const a = data?.find((r) => r.seq === from), b = data?.find((r) => r.seq === to);
  if (!a || !b) return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
  const changes = from === to ? [] : describeChanges(a.snapshot as TechFileSnapshot, b.snapshot as TechFileSnapshot);
  return NextResponse.json({ from, to, changes: changes.length ? changes : ['No differences.'] });
}
