import type { Criterion, Scorecard } from './hiring-criteria';

export type { Scorecard };

export interface CandidateNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  lineIndex?: number; // Links note to a specific line in transcript
}

export interface InterviewQuestion { topic: string; question: string; lookFor: string }

export interface Candidate {
  id: string;
  name: string;
  role: string;
  experience: string; // e.g. "26 years"
  currentCompany: string;
  competitor: boolean;
  background: string;
  email: string;
  phone: string;
  location?: string;
  avatar: string;
  status: 'screening' | 'interviewing' | 'offer' | 'archived';
  scorecard: Scorecard; // scores by category id; a missing id means not scored yet
  notes: CandidateNote[];
  resumeText: string;
  hasResume?: boolean; // true when a resume PDF is stored; open it with resumeUrl(id)
  interviewQuestions?: InterviewQuestion[]; // written by the AI for this candidate
  questionsGeneratedAt?: string | null;
  createdAt?: string;
}

// Candidates live in the database and are reached only through admin-only API routes.
// There is deliberately NO fallback to browser storage: if something fails the caller gets an
// Error with a readable message, so a failed save is never mistaken for a successful one.
const API = '/api/admin/hiring/candidates';

const fail = async (res: Response, fallback: string): Promise<never> => {
  const data = await res.json().catch(() => ({}));
  throw new Error(typeof data?.error === 'string' ? data.error : fallback);
};

export const getCandidates = async (): Promise<Candidate[]> => {
  const res = await fetch(API, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load candidates.');
  return (await res.json()).candidates as Candidate[];
};

// Create or update one candidate (the id is chosen by the caller for a new one).
export const saveCandidate = async (candidate: Candidate): Promise<Candidate> => {
  const res = await fetch(`${API}/${encodeURIComponent(candidate.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(candidate),
  });
  if (!res.ok) await fail(res, 'Could not save the candidate.');
  return (await res.json()).candidate as Candidate;
};

export const deleteCandidate = async (candidateId: string): Promise<void> => {
  const res = await fetch(`${API}/${encodeURIComponent(candidateId)}`, { method: 'DELETE' });
  if (!res.ok) await fail(res, 'Could not remove the candidate.');
};

// Attach (or replace) the candidate's resume PDF. The candidate must be saved first.
export const uploadResume = async (candidateId: string, file: File): Promise<void> => {
  const form = new FormData();
  form.append('resume', file);
  const res = await fetch(`${API}/${encodeURIComponent(candidateId)}/resume`, { method: 'POST', body: form });
  if (!res.ok) await fail(res, 'Could not attach the resume.');
};

// Where to open the resume (the server checks the admin login, then redirects to a private link).
export const resumeUrl = (candidateId: string) => `${API}/${encodeURIComponent(candidateId)}/resume`;

// What candidates are scored on, and who the AI is told we are hiring. Editable by any admin.
export interface HiringSettings { criteria: Criterion[]; hiringFor: string; companyContext: string; scoringGuide: string; contextNotSaved?: string }

export const getHiringSettings = async (): Promise<HiringSettings> => {
  const res = await fetch('/api/admin/hiring/settings', { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load the scoring settings.');
  return (await res.json()) as HiringSettings;
};

export const saveHiringSettings = async (settings: HiringSettings): Promise<HiringSettings> => {
  const res = await fetch('/api/admin/hiring/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) await fail(res, 'Could not save the scoring settings.');
  return (await res.json()) as HiringSettings;
};

// Ask the AI to write interview questions for this candidate (saved on the candidate).
export const generateInterviewQuestions = async (
  candidateId: string
): Promise<{ questions: InterviewQuestion[]; generatedAt: string; notSaved?: string }> => {
  const res = await fetch(`${API}/${encodeURIComponent(candidateId)}/questions`, { method: 'POST' });
  if (!res.ok) await fail(res, 'Could not write the questions.');
  return res.json();
};
