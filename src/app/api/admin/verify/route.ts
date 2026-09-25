import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 });
    }

    const correctPin = process.env.ADMIN_PIN;

    if (!correctPin) {
      console.error('ADMIN_PIN environment variable is not set');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (pin !== correctPin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Set secure httpOnly cookie — 7 day expiry
    const response = NextResponse.json({ success: true });
    response.cookies.set('rivix_admin_pin', correctPin, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
