import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminUser } from '@/lib/admin-auth';
import { sendEmail as sendMail } from '@/lib/email';
import { renderEmailHtml } from '@/lib/email-template';

// Email-only for now. SMS (Twilio) can be re-added later if needed.

interface SendBody {
  candidateId: string;
  candidateName: string;
  toEmail?: string;
  message: string;
}

async function isAdminAuthorized(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return isAdminUser(user);
}

function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.HIRING_FROM_EMAIL);
}

async function sendEmail(to: string, candidateName: string, message: string) {
  if (!process.env.RESEND_API_KEY || !process.env.HIRING_FROM_EMAIL) {
    throw new Error('Email is not configured. Set RESEND_API_KEY and HIRING_FROM_EMAIL in Vercel.');
  }
  // The admin's message, wrapped in the RIVIX branded layout (the plain text is still sent as the fallback version).
  const r = await sendMail({
    to,
    from: process.env.HIRING_FROM_EMAIL,
    subject: `RIVIX — Message for ${candidateName}`,
    text: message,
    html: renderEmailHtml({ preheader: message.slice(0, 90), title: `Hello ${candidateName.split(' ')[0] || ''}`.trim(), paragraphs: message.split(/\n{2,}/).filter(Boolean) }),
  });
  if (!r.ok) throw new Error(r.error);
  return r;
}

export async function GET() {
  // Only a signed-in admin may ask (it reveals the sender address and whether email is set up).
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    email: emailConfigured(),
    fromEmail: process.env.HIRING_FROM_EMAIL || null,
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized())) {
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
