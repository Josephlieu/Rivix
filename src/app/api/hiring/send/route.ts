import { NextRequest, NextResponse } from 'next/server';

// Email-only for now. SMS (Twilio) can be re-added later if needed.

interface SendBody {
  candidateId: string;
  candidateName: string;
  toEmail?: string;
  message: string;
}

function isAdminAuthorized(req: NextRequest): boolean {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) return false;
  const pinCookie = req.cookies.get('rivix_admin_pin');
  return Boolean(pinCookie && pinCookie.value === adminPin);
}

function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.HIRING_FROM_EMAIL);
}

async function sendEmail(to: string, candidateName: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.HIRING_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error('Email is not configured. Set RESEND_API_KEY and HIRING_FROM_EMAIL in Vercel.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `RIVIX — Message for ${candidateName}`,
      text: message,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.message === 'string' ? data.message : `Resend error (${res.status})`;
    throw new Error(detail);
  }

  return data;
}

export async function GET() {
  return NextResponse.json({
    email: emailConfigured(),
    fromEmail: process.env.HIRING_FROM_EMAIL || null,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SendBody;
    const { candidateName, toEmail, message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!toEmail?.trim()) {
      return NextResponse.json({ error: 'Candidate email is required' }, { status: 400 });
    }

    if (!emailConfigured()) {
      return NextResponse.json(
        { error: 'Email not configured. Add RESEND_API_KEY and HIRING_FROM_EMAIL to Vercel environment variables.' },
        { status: 503 }
      );
    }

    await sendEmail(toEmail.trim(), candidateName, message.trim());
    return NextResponse.json({ success: true, channel: 'email', to: toEmail.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
