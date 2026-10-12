// Server-only helpers for the Sales Hiring candidates API: turn a database row into what the
// page uses, and clean whatever the browser sends before it is saved.

export const CANDIDATE_STATUSES = ['screening', 'interviewing', 'offer', 'archived'] as const;
export const RESUME_BUCKET = 'hiring-resumes';
export const MAX_RESUME_BYTES = 4 * 1024 * 1024; // 4 MB: stays under the request size limit on the host

// Ids are chosen by the browser (a random uuid) or by the database; keep them to safe characters.
export const isValidCandidateId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
// A usable date, or now when the value is missing or not a date (never throws).
const validDate = (v: unknown) => { const d = new Date(v == null || v === '' ? Date.now() : (v as string | number)); return Number.isNaN(d.getTime()) ? new Date() : d; };
// Scores are 0 to 10 and keep one decimal (the resume reader gives values like 7.5).
const score = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(10, Math.max(0, Math.round(n * 10) / 10)) : 5;
};

// Scores are saved by category id. Only sensible ids and numeric values are kept; a category that was
// never scored is simply absent.
const cleanScorecard = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
      if (/^[A-Za-z0-9_]{1,40}$/.test(k) && v !== null && v !== '' && Number.isFinite(Number(v))) out[k] = score(v);
    }
  }
  return out;
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function rowToCandidate(r: Row) {
  return {
    id: r.id as string,
    name: r.name ?? '',
    role: r.role ?? '',
    experience: r.experience ?? '',
    currentCompany: r.current_company ?? '',
    competitor: !!r.competitor,
    background: r.background ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    location: r.location ?? '',
    avatar: r.avatar ?? '',
    status: r.status,
    scorecard: r.scorecard,
    notes: Array.isArray(r.notes) ? r.notes : [],
    resumeText: r.resume_text ?? '',
    hasResume: !!r.resume_path,
    interviewQuestions: Array.isArray(r.interview_questions) ? r.interview_questions : [],
    questionsGeneratedAt: r.questions_generated_at ?? null,
    createdAt: r.created_at,
  };
}

/** Validates and cleans a candidate sent by the browser. Returns an error message or the row to save. */
export function candidateToRow(body: Row): { error: string } | { row: Row } {
  const name = text(body?.name, 200);
  if (!name) return { error: 'A candidate needs a name.' };
  const status = CANDIDATE_STATUSES.includes(body?.status) ? body.status : 'screening';

  const scorecard = cleanScorecard(body?.scorecard);

  const notes = (Array.isArray(body?.notes) ? body.notes : [])
    .slice(0, 300)
    .map((n: Row) => ({
      id: text(n?.id, 80) || `note-${Date.now()}`,
      author: text(n?.author, 120) || 'Admin',
      content: text(n?.content, 4000),
      timestamp: validDate(n?.timestamp).toISOString(),
    }))
    .filter((n: Row) => n.content);

  return {
    row: {
      name,
      role: text(body?.role, 200),
      experience: text(body?.experience, 100),
      current_company: text(body?.currentCompany, 200),
      competitor: !!body?.competitor,
      background: text(body?.background, 8000),
      email: text(body?.email, 200),
      phone: text(body?.phone, 60),
      location: text(body?.location, 200),
      avatar: text(body?.avatar, 4) || name.substring(0, 2).toUpperCase(),
      status,
      scorecard,
      notes,
      resume_text: text(body?.resumeText, 60000),
      updated_at: new Date().toISOString(),
    },
  };
}
