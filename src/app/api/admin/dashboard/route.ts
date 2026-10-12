import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { getDashboardData } from '@/lib/dashboard-data';

// Real numbers for the admin dashboard. The admin login is checked first, every time; only the
// database numbers behind it are saved (see dashboard-data.ts for how they stay fresh).
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await getDashboardData());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the dashboard.' }, { status: 500 });
  }
}
