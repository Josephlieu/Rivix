'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getCandidates,
  saveCandidate,
  deleteCandidate,
  getHiringSettings,
  generateInterviewQuestions,
  uploadResume,
  resumeUrl,
  Candidate,
} from '@/lib/hiringStorage';
import {
  Criterion,
  DEFAULT_CRITERIA,
  DEFAULT_HIRING_FOR,
  computeScore,
  scoredCount,
  TIER_1_MIN,
  TIER_2_MIN,
} from '@/lib/hiring-criteria';
import CriteriaEditor from './CriteriaEditor';
import { DEFAULT_COMPANY_CONTEXT, DEFAULT_SCORING_GUIDE } from '@/lib/hiring-prompts';
import CandidateEditor from './CandidateEditor';
import ConfirmModal from '@/components/ConfirmModal';
import { formatDateTime } from '@/lib/format';
import Modal from '@/components/Modal';
import {
  loadCandidateChats,
  appendCandidateMessage,
  CorrespondenceMessage,
} from '@/lib/hiringCorrespondence';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Award, 
  Volume2,
  Trash2, 
  Sliders,
  ShieldCheck, 
  Briefcase, 
  Clock, 
  Check, 
  ChevronRight,
  Info,
  HelpCircle,
  Plus,
  Compass,
  Mail,
  Send,
  MapPin,
  ExternalLink,
  Calendar,
  Loader2,
  AlertCircle,
  Pencil,
  Copy,
  ArrowRight,
  ArrowLeft,
  Archive,
  Sparkles
} from 'lucide-react';

const DEFAULT_CALCOM_BOOKING_URL = 'https://cal.com/solomon-riby-williams-kdcvhj/15min';
const CALCOM_BOOKING_URL = process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL || DEFAULT_CALCOM_BOOKING_URL;

const buildCalComBookingUrl = (candidate: Candidate | null) => {
  if (!candidate) return CALCOM_BOOKING_URL;
  try {
    const url = new URL(CALCOM_BOOKING_URL);
    url.searchParams.set('name', candidate.name);
    if (candidate.email) url.searchParams.set('email', candidate.email);
    url.searchParams.set('notes', `RIVIX candidate: ${candidate.name} (${candidate.id})`);
    return url.toString();
  } catch {
    return CALCOM_BOOKING_URL;
  }
};

// Dynamic ranking based on the weighted score over the current scoring criteria
const getCandidateRank = (cand: Candidate, allCandidates: Candidate[], criteria: Criterion[]) => {
  const raw = computeScore(cand.scorecard, criteria);
  const score = raw ?? 0;
  // Sort all candidates by weighted score descending to determine rank
  const sorted = [...allCandidates].sort((a, b) => (computeScore(b.scorecard, criteria) ?? 0) - (computeScore(a.scorecard, criteria) ?? 0));
  const rank = sorted.findIndex(c => c.id === cand.id) + 1;

  let tier: string;
  let style: string;
  if (raw === null) {
    tier = 'Not scored';
    style = 'bg-slate-50 text-slate-400 font-bold border border-slate-200';
  } else if (score >= TIER_1_MIN) {
    tier = 'Tier 1';
    if (rank === 1) style = 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-300 shadow-sm';
    else if (rank === 2) style = 'bg-indigo-100 text-indigo-700 font-bold border border-indigo-300 shadow-sm';
    else style = 'bg-blue-100 text-blue-700 font-bold border border-blue-300 shadow-sm';
  } else if (score >= TIER_2_MIN) {
    tier = 'Tier 2';
    style = 'bg-slate-100 text-slate-600 font-bold border border-slate-200';
  } else {
    tier = 'Tier 3';
    style = 'bg-red-50 text-red-600 font-bold border border-red-200';
  }

  return { label: raw === null ? 'Not scored' : `#${rank} ${tier} (${score})`, style, score, rank, tier };
};

export default function AdminHiringPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCand, setSelectedCand] = useState<Candidate | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'script' | 'correspondence'>('profile');
  const [candidateMessageText, setCandidateMessageText] = useState('');
  const [candidateChats, setCandidateChats] = useState<Record<string, CorrespondenceMessage[]>>(() => loadCandidateChats());
  const [sendMessageLoading, setSendMessageLoading] = useState(false);
  const [sendMessageError, setSendMessageError] = useState<string | null>(null);
  const [messagingConfig, setMessagingConfig] = useState<{ email: boolean; fromEmail: string | null } | null>(null);
  const [uploadingResumes, setUploadingResumes] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'newest'>('score');
  const [statusFilter, setStatusFilter] = useState<'all' | 'screening' | 'interviewing' | 'offer' | 'archived'>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [copiedCalLink, setCopiedCalLink] = useState(false);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [stageSaving, setStageSaving] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null); // candidate id the AI is writing questions for
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null); // a note being saved: shown straight away, with a spinner
  
  // What candidates are scored on (editable) and the sliders' current values, by category id
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [hiringFor, setHiringFor] = useState(DEFAULT_HIRING_FOR);
  const [companyContext, setCompanyContext] = useState(DEFAULT_COMPANY_CONTEXT);
  const [scoringGuide, setScoringGuide] = useState(DEFAULT_SCORING_GUIDE);
  const [showCriteriaEditor, setShowCriteriaEditor] = useState(false);
  const [showCandidateEditor, setShowCandidateEditor] = useState(false);
  // In-page messages and dialogs (instead of the browser's own alert / confirm popups)
  const [notice, setNotice] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copyFallbackLink, setCopyFallbackLink] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [stored, settings] = await Promise.all([getCandidates(), getHiringSettings()]);
        setCandidates(stored);
        setCriteria(settings.criteria);
        setHiringFor(settings.hiringFor);
        setCompanyContext(settings.companyContext);
        setScoringGuide(settings.scoringGuide);
        if (stored.length > 0) {
          setSelectedCand(stored[0]);
          setScores({ ...stored[0].scorecard });
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load candidates.');
      } finally {
        setLoadingCandidates(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'correspondence') threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSubTab, selectedCand?.id, candidateChats, sendMessageLoading]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    fetch('/api/hiring/send')
      .then((res) => res.json())
      .then((data) => setMessagingConfig(data))
      .catch(() => setMessagingConfig({ email: false, fromEmail: null }));
  }, []);

  const syncScorecardForm = (cand: Candidate) => {
    setScores({ ...cand.scorecard });
  };

  const handleSelectCandidate = (cand: Candidate) => {
    setSelectedCand(cand);
    syncScorecardForm(cand);
  };

  // Every change is saved to the database first; the screen only changes once that worked,
  // and a failure is shown instead of being swallowed.
  const persist = async (updated: Candidate): Promise<boolean> => {
    setActionError(null);
    try {
      const saved = await saveCandidate(updated);
      setSelectedCand(saved);
      setCandidates((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save. Nothing was changed.');
      return false;
    }
  };

  const handleSaveScorecard = async () => {
    if (!selectedCand) return;
    const ok = await persist({
      ...selectedCand,
      scorecard: Object.fromEntries(
        criteria.filter((c) => typeof scores[c.id] === 'number').map((c) => [c.id, scores[c.id] as number])
      ),
    });
    if (ok) setNotice('Evaluation scorecard saved.');
  };

  const handleRemoveCandidate = async (candId: string) => {
    setActionError(null);
    try {
      await deleteCandidate(candId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the candidate.');
      return;
    }
    const remaining = candidates.filter((c) => c.id !== candId);
    setCandidates(remaining);
    setSelectedCand(remaining[0] || null);
    if (remaining[0]) syncScorecardForm(remaining[0]);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newNoteContent.trim();
    if (!selectedCand || !content || pendingNote !== null) return;

    const newNote = {
      id: `note-${Date.now()}`,
      author: 'RIVIX Admin',
      content,
      timestamp: new Date().toISOString()
    };

    // Show the note at once as "Saving…" and clear the box; if the save fails, the text comes back.
    setNewNoteContent('');
    setPendingNote(content);
    const ok = await persist({ ...selectedCand, notes: [...selectedCand.notes, newNote] });
    setPendingNote(null);
    if (!ok) setNewNoteContent(content);
  };

  const handleSendCandidateMessage = async () => {
    if (!selectedCand || !candidateMessageText.trim() || sendMessageLoading) return;

    const cid = selectedCand.id;
    const textToSend = candidateMessageText.trim();
    setSendMessageError(null);
    setSendMessageLoading(true);

    try {
      const res = await fetch('/api/hiring/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: cid,
          candidateName: selectedCand.name,
          toEmail: selectedCand.email,
          message: textToSend,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to send message');
      }

      const newMessage: CorrespondenceMessage = {
        id: `msg-${Date.now()}`,
        sender: 'admin',
        senderName: 'RIVIX Admin',
        text: textToSend,
        timestamp: new Date().toISOString(),
        channel: 'email',
        deliveryStatus: 'sent',
      };

      setCandidateChats((prev) => appendCandidateMessage(prev, cid, newMessage));
      setCandidateMessageText('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setSendMessageError(errorMessage);

      const failedMessage: CorrespondenceMessage = {
        id: `msg-failed-${Date.now()}`,
        sender: 'admin',
        senderName: 'RIVIX Admin',
        text: textToSend,
        timestamp: new Date().toISOString(),
        channel: 'email',
        deliveryStatus: 'failed',
        deliveryError: errorMessage,
      };
      setCandidateChats((prev) => appendCandidateMessage(prev, cid, failedMessage));
    } finally {
      setSendMessageLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingResumes(true);
    setActionError(null);
    const problems: string[] = [];
    try {
      let list = [...candidates];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const formData = new FormData();
          formData.append('resume', file);
          const res = await fetch('/api/analyze-resume', { method: 'POST', body: formData });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(typeof err.error === 'string' ? err.error : 'could not be read');
          }
          const data = await res.json();

          const candidateName = data.name || file.name.replace(/\.[^/.]+$/, '');
          const candidateEmail = data.email || '';
          const existing = list.find(c =>
            c.name.toLowerCase() === candidateName.toLowerCase() ||
            (candidateEmail && c.email && c.email.toLowerCase() === candidateEmail.toLowerCase())
          );
          // The sliders run 1 to 10, so a very low AI score (even 0) is shown as 1, not replaced by the default.
          const score = (v: unknown): number | undefined =>
            typeof v === 'number' && Number.isFinite(v) ? Math.min(10, Math.max(0, Math.round(v * 10) / 10)) : undefined;
          const base: Candidate = existing ?? {
            id: crypto.randomUUID(),
            name: candidateName,
            email: '',
            phone: '',
            background: '',
            role: 'Sales Representative Applicant',
            experience: 'Not specified',
            currentCompany: 'Not specified',
            competitor: false,
            status: 'screening',
            avatar: candidateName ? candidateName.substring(0, 2).toUpperCase() : 'UP',
            scorecard: {},
            notes: [],
            resumeText: '',
          };
          const candidate: Candidate = {
            ...base,
            email: candidateEmail || base.email,
            phone: data.phone || base.phone,
            location: data.location || base.location || '',
            background: data.bio || base.background || 'Parsed from uploaded resume.',
            role: data.role || base.role,
            experience: data.experience || base.experience,
            currentCompany: data.currentCompany || base.currentCompany,
            competitor: data.competitor !== undefined ? !!data.competitor : base.competitor,
            // Keep earlier scores; fill every current category the reader gave a number for.
            scorecard: Object.fromEntries(
              criteria
                .map((c) => [c.id, score(data.scorecard?.[c.id]) ?? base.scorecard[c.id]] as const)
                .filter(([, v]) => typeof v === 'number')
            ) as Record<string, number>,
            resumeText: data.rawText || data.bio || base.resumeText,
          };

          // Details first (this creates the row), then the PDF file.
          let saved = await saveCandidate(candidate);
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            try {
              await uploadResume(saved.id, file);
              saved = { ...saved, hasResume: true };
            } catch (err) {
              problems.push(`${file.name}: candidate saved, but the PDF was not attached (${err instanceof Error ? err.message : 'error'})`);
            }
          }
          list = existing ? list.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...list];
        } catch (err) {
          problems.push(`${file.name}: ${err instanceof Error ? err.message : 'failed'}`);
        }
      }

      setCandidates(list);
      if (selectedCand) {
        const refreshed = list.find((c) => c.id === selectedCand.id);
        if (refreshed) { setSelectedCand(refreshed); syncScorecardForm(refreshed); }
      } else if (list[0]) {
        setSelectedCand(list[0]);
        syncScorecardForm(list[0]);
      }
      if (problems.length) setActionError(problems.join(' · '));
    } finally {
      setUploadingResumes(false);
      e.target.value = '';
    }
  };


  const handleGenerateQuestions = async () => {
    if (!selectedCand || generatingFor) return;
    const id = selectedCand.id;
    const first = selectedCand.name.split(' ')[0];
    setGeneratingFor(id);
    setQuestionsError(null);
    try {
      const r = await generateInterviewQuestions(id);
      const apply = (c: Candidate): Candidate => (c.id === id ? { ...c, interviewQuestions: r.questions, questionsGeneratedAt: r.generatedAt } : c);
      setCandidates((prev) => prev.map(apply));
      setSelectedCand((prev) => (prev ? apply(prev) : prev));
      if (r.notSaved) setQuestionsError(r.notSaved);
      else setNotice(`Interview questions written for ${first}.`);
    } catch (err) {
      setQuestionsError(err instanceof Error ? err.message : 'Could not write the questions.');
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyQuestions = async () => {
    const qs = selectedCand?.interviewQuestions || [];
    if (!qs.length) return;
    const text = qs.map((q, n) => `${n + 1}. ${q.question}\n   Look for: ${q.lookFor}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); setNotice('Questions copied.'); } catch { setQuestionsError('Copy failed. Select the text and copy it by hand.'); }
  };

  const copyCalComLink = async () => {
    const link = buildCalComBookingUrl(selectedCand);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCalLink(true);
      setTimeout(() => setCopiedCalLink(false), 1800);
    } catch {
      setCopyFallbackLink(link);
    }
  };

  // The same interview prompts for every candidate.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderAiQuestions = (_cand: Candidate) => {
    // Default template questions (for any candidate)
    return [
      {
        q: `"Uniform and workwear programs are about more than the price per garment. How do you show a procurement manager who only compares unit prices that quality, consistent reorders and a single point of contact are worth it?"`,
        focus: "Look for concrete value arguments: durability and fewer reorders, consistent quality from one run to the next, faster samples and delivery, one contact instead of many suppliers, and compliance where the customer needs it (for example high-visibility or flame-resistant garments)."
      },
      {
        q: `"RIVIX pays no cash at all — commission only when deals close and collect. What gives you confidence you can earn from day one? Name your first three target accounts."`,
        focus: "Commission-only reps must have warm leads ready. If they can't name specific prospects, they will starve on commission. This is a disqualifier for Tier 3 candidates."
      }
    ];
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* 1. Header Overview addressing RIVIX staff's request */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-3xl p-6 lg:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="bg-white/15 px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">Recruiting OS</span>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Sales Hiring & Credibility Board</h1>
            <p className="text-white/70 text-xs lg:text-sm leading-relaxed">
              Screen sales-rep applicants, score them against the weighted scorecard, keep interview notes, and schedule and email candidates from one place. Candidates and resumes are stored privately and are only visible to signed-in admins.
            </p>
          </div>
          
          {/* Counts: dark tiles with light text and coloured numbers, readable on any background */}
          {(() => {
            const scored = candidates.map((c) => computeScore(c.scorecard, criteria));
            const tiles = [
              { label: 'Total', hint: 'candidates', n: candidates.length, num: 'text-white', dot: 'bg-slate-300' },
              { label: 'Tier 1', hint: '7.0 and above', n: scored.filter((v) => v !== null && v >= TIER_1_MIN).length, num: 'text-emerald-400', dot: 'bg-emerald-400' },
              { label: 'Tier 2', hint: '5.5 to 6.9', n: scored.filter((v) => v !== null && v >= TIER_2_MIN && v < TIER_1_MIN).length, num: 'text-sky-300', dot: 'bg-sky-300' },
              { label: 'Tier 3', hint: 'below 5.5', n: scored.filter((v) => v !== null && v < TIER_2_MIN).length, num: 'text-rose-300', dot: 'bg-rose-300' },
            ];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                {tiles.map((t) => (
                  <div key={t.label} className="rounded-2xl bg-slate-950/50 border border-white/10 px-5 py-3.5 text-center min-w-[108px]">
                    <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} aria-hidden="true" />{t.label}
                    </span>
                    <p className={`text-3xl font-black mt-1 leading-none ${t.num}`}>{t.n}</p>
                    <span className="block text-[10px] text-slate-400 mt-1.5">{t.hint}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        
        <div className="absolute -left-24 -bottom-28 w-80 h-80 bg-rivix/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {(loadError || actionError) && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold" role="alert">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{loadError || actionError}</span>
          {actionError && !loadError && (
            <button type="button" onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 font-black" aria-label="Dismiss">×</button>
          )}
        </div>
      )}

      {/* 2. Main Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-8">
        
        {/* SIDEBAR: shortlisted Candidates List (4 cols) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Candidates</h3>
                
                <div className="relative">
                  <input 
                    type="file" 
                    id="resume-upload" 
                    multiple 
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingResumes}
                  />
                  <label 
                    htmlFor="resume-upload"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                      uploadingResumes ? 'bg-slate-100 text-slate-400' : 'bg-rivix/10 text-rivix hover:bg-rivix/20'
                    }`}
                  >
                    {uploadingResumes ? (
                      <><Loader2 size={12} className="animate-spin" /> Analyzing...</>
                    ) : (
                      <><Plus size={12} /> Upload Resumes</>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'score' | 'newest')}
                  className="bg-slate-50 hover:bg-slate-100 text-[10px] font-black text-slate-600 rounded-lg px-2.5 py-1 border border-slate-200 focus:outline-none focus:border-rivix cursor-pointer transition-all"
                >
                  <option value="score">Highest Score</option>
                  <option value="newest">Newest Uploads</option>
                </select>
              </div>

              {/* Status filtering pills */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {(['all', 'screening', 'interviewing', 'offer', 'archived'] as const).map((status) => {
                  const count = status === 'all' 
                    ? candidates.length 
                    : candidates.filter(c => c.status === status).length;
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setVisibleCount(8); // Reset pagination limit when filter changes
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                        statusFilter === status
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {status === 'interviewing' ? 'Interview' : status} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              {(() => {
                const filteredAndSorted = [...candidates]
                  .filter(cand => statusFilter === 'all' || cand.status === statusFilter)
                  .sort((a, b) => {
                    if (sortBy === 'newest') {
                      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      if (timeA !== timeB) return timeB - timeA;
                    }
                    
                    return (computeScore(b.scorecard, criteria) ?? 0) - (computeScore(a.scorecard, criteria) ?? 0);
                  });

                const displayedCandidates = filteredAndSorted.slice(0, visibleCount);

                return (
                  <>
                    {displayedCandidates.map(cand => {
                      const isActive = selectedCand?.id === cand.id;
                      
                      return (
                        <div
                          key={cand.id}
                          onClick={() => handleSelectCandidate(cand)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${
                            isActive
                              ? 'border-rivix bg-rivix/5 shadow-sm'
                              : 'border-slate-100 hover:border-slate-200 hover:shadow-sm bg-white'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isActive ? 'bg-rivix text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {cand.avatar}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-800 truncate">{cand.name}</h4>
                              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0">{cand.experience}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate">{cand.currentCompany}</p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap ${getCandidateRank(cand, candidates, criteria).style}`}>
                                {getCandidateRank(cand, candidates, criteria).label}
                              </span>
                              {cand.competitor && (
                                <span className="text-[9px] font-black text-rivix uppercase bg-rivix/10 px-2 py-0.5 rounded-md tracking-wider whitespace-nowrap">Competitor</span>
                              )}
                            </div>
                          </div>

                          <ChevronRight size={14} className="text-slate-300 group-hover:text-rivix transition-colors shrink-0" />
                        </div>
                      );
                    })}

                    {filteredAndSorted.length > visibleCount && (
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Showing {displayedCandidates.length} of {filteredAndSorted.length}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisibleCount(prev => prev + 8);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                          >
                            Show More
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisibleCount(filteredAndSorted.length);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rivix/10 hover:bg-rivix/20 text-rivix transition-colors border border-rivix/20"
                          >
                            See All
                          </button>
                        </div>
                      </div>
                    )}

                    {filteredAndSorted.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        {loadingCandidates
                          ? 'Loading candidates…'
                          : loadError
                            ? 'Candidates could not be loaded.'
                            : candidates.length === 0
                              ? 'No candidates yet. Use “Upload Resumes” to add the first one.'
                              : 'No candidates found in this status.'}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Sourcing Guidelines (Quick Credibility Terms) */}
          <div className="bg-slate-50 rounded-3xl p-6 text-slate-800 space-y-4 border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-rivix flex items-center gap-1.5"><Compass size={14}/> Credibility Terminology Guide</h3>
            <p className="text-[10px] text-slate-500">Speak like a 30-year veteran when interviewing senior candidates:</p>
            
            <div className="space-y-3 divide-y divide-slate-200 text-[11px] font-semibold">
              <div className="pt-2 first:pt-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">CSA Z96-15 Class 3</span>
                <p className="text-slate-600 mt-0.5 font-medium">Highest visibility standard. Covers full torso + bands on sleeves & legs. Essential for major drilling platforms.</p>
              </div>
              <div className="pt-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Nomex® sewing threads</span>
                <p className="text-slate-600 mt-0.5 font-medium">Aramid thread that carbonizes rather than melts. Standard polyester threads melt in fires, violating safety.</p>
              </div>
              <div className="pt-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">VMI (Vendor Managed Inventory)</span>
                <p className="text-slate-600 mt-0.5 font-medium">System where RIVIX maintains stock on-site or in regional hubs. Major contracting oil companies expect this.</p>
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS FRAME: Selected Candidate workspace (8 cols) */}
        <div className="space-y-6 min-w-0">
          {selectedCand ? (
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 space-y-6">
              
              {/* Header: who they are, quick actions, and the stage */}
              <div className="space-y-5 pb-6 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-rivix/10 border border-rivix/20 flex items-center justify-center font-bold text-lg text-rivix shadow-inner shrink-0">
                    {selectedCand.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedCand.name}</h2>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap ${getCandidateRank(selectedCand, candidates, criteria).style}`}>
                        {getCandidateRank(selectedCand, candidates, criteria).label}
                      </span>
                      {selectedCand.competitor && (
                        <span className="text-[10px] font-black text-rivix uppercase bg-rivix/10 px-2.5 py-1 rounded-full tracking-wider whitespace-nowrap">Competitor</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-500 mt-1.5">
                      {[selectedCand.role, selectedCand.experience, selectedCand.currentCompany].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCandidateEditor(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 bg-white hover:border-rivix/40 hover:text-rivix text-xs font-bold transition-all whitespace-nowrap"
                      title="Edit this candidate's details"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedCand)}
                      className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200 text-slate-400 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                      title="Remove candidate"
                      aria-label="Remove candidate"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Booking: one link (opens a new page) and two buttons (do something here), kept visibly different */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Booking</span>
                  <a
                    href={buildCalComBookingUrl(selectedCand)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-rivix hover:underline underline-offset-4 whitespace-nowrap"
                    title="Opens the booking page in a new tab"
                  >
                    <Calendar size={15} /> Open booking page <ExternalLink size={13} className="opacity-70" />
                  </a>
                  <span className="hidden sm:block h-5 w-px bg-slate-200" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={copyCalComLink}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                  >
                    {copiedCalLink ? <><Check size={14} className="text-emerald-500" /> Copied</> : <><Copy size={14} /> Copy link</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('correspondence');
                      setCandidateMessageText(
                        `Hi ${selectedCand.name}, let's lock in our 15-minute introductory Zoom screening call. You can select a convenient slot directly using this link: ${buildCalComBookingUrl(selectedCand)}`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                    title="Writes the invitation in the Correspondence tab (nothing is sent until you press send)"
                  >
                    <Mail size={14} /> Draft invite email
                  </button>
                </div>

                {/* Stage: the line only SHOWS where they are; the buttons next to it change it */}
                {(() => {
                  const order = [
                    { label: 'Screen', val: 'screening' },
                    { label: 'Interview', val: 'interviewing' },
                    { label: 'Offer', val: 'offer' },
                  ] as const;
                  const idx = order.findIndex((st) => st.val === selectedCand.status);
                  const archived = selectedCand.status === 'archived';
                  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
                  const prev = idx > 0 ? order[idx - 1] : null;
                  const first = selectedCand.name.split(' ')[0];
                  const move = async (to: 'screening' | 'interviewing' | 'offer' | 'archived', message: string) => {
                    setStageSaving(true);
                    const ok = await persist({ ...selectedCand, status: to });
                    setStageSaving(false);
                    if (ok) setNotice(message);
                  };
                  return (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Stage</span>

                      {/* Where they are (display only) */}
                      <ol className="flex items-center gap-1.5" aria-label="Current stage">
                        {order.map((st, n) => {
                          const done = idx > n;
                          const active = idx === n;
                          return (
                            <li key={st.val} className="flex items-center gap-1.5" aria-current={active ? 'step' : undefined}>
                              {n > 0 && <span className={`h-px w-6 ${idx >= n ? 'bg-rivix/40' : 'bg-slate-200'}`} aria-hidden="true" />}
                              <span className="inline-flex items-center gap-2 py-0.5 pr-2 cursor-default select-none">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                                  active ? 'bg-rivix border-rivix text-white'
                                  : done ? 'bg-rivix/10 border-rivix/30 text-rivix'
                                  : 'bg-white border-slate-200 text-slate-400'
                                }`}>
                                  {done ? <Check size={12} /> : n + 1}
                                </span>
                                <span className={`text-xs font-bold ${active ? 'text-rivix' : done ? 'text-slate-600' : 'text-slate-400'}`}>{st.label}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ol>

                      <span className="hidden sm:block h-5 w-px bg-slate-200" aria-hidden="true" />

                      {/* What you can do about it (buttons) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {archived ? (
                          <>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full">Archived</span>
                            <button type="button" disabled={stageSaving} onClick={() => move('screening', `${first} restored to Screen.`)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                              Restore to Screen
                            </button>
                          </>
                        ) : (
                          <>
                            {next ? (
                              <button type="button" disabled={stageSaving} onClick={() => move(next.val, `${first} moved to ${next.label}.`)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg border border-rivix/40 bg-rivix/5 text-rivix hover:bg-rivix/10 disabled:opacity-60 transition-colors whitespace-nowrap"
                                title={`Move ${first} on to the ${next.label} stage`}>
                                {stageSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                                Move to {next.label} <ArrowRight size={14} />
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400">Final stage</span>
                            )}
                            {prev && (
                              <button type="button" disabled={stageSaving} onClick={() => move(prev.val, `${first} moved back to ${prev.label}.`)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 transition-colors whitespace-nowrap">
                                <ArrowLeft size={14} /> Back to {prev.label}
                              </button>
                            )}
                            <button type="button" disabled={stageSaving} onClick={() => move('archived', `${first} archived.`)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                              title="Remove from the active list (you can restore later)">
                              <Archive size={14} /> Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Contact details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <div className="min-w-0 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Email</span>
                  {selectedCand.email ? (
                    <a href={`mailto:${selectedCand.email}`} className="text-sm font-bold text-sky-600 hover:text-sky-800 hover:underline truncate block" title={selectedCand.email}>
                      {selectedCand.email}
                    </a>
                  ) : (<span className="text-sm font-bold text-slate-300">—</span>)}
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Phone</span>
                  {selectedCand.phone ? (
                    <a href={`tel:${selectedCand.phone}`} className="text-sm font-bold text-slate-800 hover:text-rivix transition-colors block">{selectedCand.phone}</a>
                  ) : (<span className="text-sm font-bold text-slate-300">—</span>)}
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Location</span>
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                    <MapPin size={13} className="text-rivix shrink-0" />
                    <span className={`truncate ${selectedCand.location ? '' : 'text-slate-300'}`}>{selectedCand.location || '—'}</span>
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-100 overflow-x-auto">
                {([
                  ['profile', 'Profile & Scorecard'],
                  ['script', 'Interview Script'],
                  ['correspondence', 'Correspondence'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveSubTab(key)}
                    className={`pb-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                      activeSubTab === key
                        ? 'border-rivix text-rivix'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT: PROFILE & SCORECARD */}
              {activeSubTab === 'profile' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Left Column: background & Notes (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Background block */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Professional Background</h3>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {selectedCand.background}
                      </p>
                    </div>

                    {/* Resume viewer block */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center justify-between">
                        <span>Resume (PDF)</span>
                        {selectedCand.hasResume && (
                          <a 
                            href={resumeUrl(selectedCand.id)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] font-black text-rivix hover:underline uppercase tracking-widest flex items-center gap-1"
                          >
                            Open Fullscreen <ExternalLink size={10} />
                          </a>
                        )}
                      </h3>
                      {selectedCand.hasResume ? (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 h-[500px] shadow-sm relative group">
                          <iframe 
                            src={resumeUrl(selectedCand.id)} 
                            className="w-full h-full border-none"
                            title={`${selectedCand.name} Resume`}
                          />
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl bg-slate-50 text-slate-500 text-xs p-8 text-center flex flex-col items-center justify-center gap-2">
                          <FileText size={24} className="text-slate-300 animate-pulse" />
                          <p className="font-semibold">No PDF on file</p>
                          <p className="text-[10px] text-slate-400">The text read from the resume is shown instead.</p>
                          <div className="border border-slate-200 rounded-2xl bg-slate-900 text-slate-300 font-mono text-[10px] p-5 w-full h-44 overflow-y-auto whitespace-pre-line text-left leading-normal">
                            {selectedCand.resumeText}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* notes Feed block */}
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Interviewer Notes ({selectedCand.notes.length})</h3>
                      
                      <div className="space-y-3">
                        {selectedCand.notes.map(note => (
                          <div key={note.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wide">
                              <span className="text-slate-600 flex items-center gap-1"><Check size={10} className="text-rivix" /> {note.author}</span>
                              <span>{formatDateTime(note.timestamp)}</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed font-medium">{note.content}</p>
                          </div>
                        ))}
                        {pendingNote !== null && (
                          <div className="bg-slate-50/60 border border-dashed border-slate-200 p-4 rounded-2xl space-y-1 text-xs opacity-80" aria-live="polite">
                            <div className="flex items-center justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wide">
                              <span className="text-slate-500 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin text-rivix" /> RIVIX Admin</span>
                              <span>Saving…</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed font-medium">{pendingNote}</p>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleAddNote} className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Type notes on client screening, candidate fit..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          maxLength={4000}
                          className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rivix/50 font-medium"
                        />
                        <button
                          type="submit"
                          disabled={pendingNote !== null || !newNoteContent.trim()}
                          className="bg-slate-900 text-white rounded-xl px-4 py-3 hover:bg-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-w-[64px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pendingNote !== null ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Right Column: Scorecard Matrix (5 cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5"><Sliders size={12}/> Weighted Scorecard</h3>
                        <button type="button" onClick={() => setShowCriteriaEditor(true)} className="text-[10px] font-black text-rivix uppercase bg-rivix/10 hover:bg-rivix/20 px-2.5 py-1 rounded-full transition-colors">Edit criteria</button>
                      </div>

                      {/* Composite Score Display */}
                      {(() => {
                        const ws = computeScore(scores as Record<string, number>, criteria);
                        const tier = ws === null ? 'NOT SCORED' : ws >= TIER_1_MIN ? 'TIER 1' : ws >= TIER_2_MIN ? 'TIER 2' : 'TIER 3';
                        const tierStyle = ws === null ? 'bg-slate-50 text-slate-400 border-slate-200' : ws >= TIER_1_MIN ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : ws >= TIER_2_MIN ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-red-100 text-red-700 border-red-300';
                        return (
                          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Weighted Composite</span>
                              <span className="text-2xl font-black text-slate-900">{ws ?? '—'}</span>
                              <span className="text-xs text-slate-400 font-bold"> / 10</span>
                            </div>
                            <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border ${tierStyle}`}>{tier}</span>
                          </div>
                        );
                      })()}

                      {scoredCount(scores as Record<string, number>, criteria) < criteria.length && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          Scored on {scoredCount(scores as Record<string, number>, criteria)} of {criteria.length} categories. Unscored ones are left out of the total until you set them.
                        </p>
                      )}

                      <div className="space-y-4">
                        {criteria.map((c) => {
                          const val = scores[c.id];
                          return (
                            <div key={c.id} className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide gap-2">
                                <span className="flex items-center gap-1.5" title={c.description}>
                                  {c.label}
                                  <span className="text-[8px] font-black text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded">{c.weight}%</span>
                                </span>
                                {typeof val === 'number' ? (
                                  <span className="font-black text-rivix whitespace-nowrap">{val}/10</span>
                                ) : (
                                  <span className="font-semibold text-slate-400 whitespace-nowrap normal-case tracking-normal">Not scored yet · drag to score</span>
                                )}
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.5"
                                value={typeof val === 'number' ? Math.max(1, val) : 5}
                                onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: parseFloat(e.target.value) }))}
                                // Touching an unscored slider scores it (starting at 5), even if you click exactly on 5.
                                onPointerDown={() => { if (typeof val !== 'number') setScores((prev) => ({ ...prev, [c.id]: 5 })); }}
                                className={`w-full accent-rivix cursor-pointer ${typeof val === 'number' ? '' : 'opacity-40 hover:opacity-70'}`}
                                aria-label={`${c.label} score`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleSaveScorecard}
                        className="w-full bg-rivix text-white py-3.5 rounded-xl text-xs font-bold hover:bg-rivix-dark hover:shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        Save Evaluation Scorecard
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB CONTENT: INTERVIEW QUESTIONS (written by the AI for this candidate) */}
              {activeSubTab === 'script' && (() => {
                const first = selectedCand.name.split(' ')[0];
                const qs = selectedCand.interviewQuestions || [];
                const busy = generatingFor === selectedCand.id;
                return (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-5">
                      <div className="min-w-0 space-y-1 max-w-xl">
                        <h4 className="text-base font-bold text-slate-900">Interview questions for {first}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Written by AI from this candidate&apos;s resume and scores: it probes their strongest claim and their weakest area.
                          Read them before the call. They are a starting point, not a script.
                        </p>
                        {selectedCand.questionsGeneratedAt && qs.length > 0 && (
                          <p className="text-[11px] text-slate-400">Written {formatDateTime(selectedCand.questionsGeneratedAt)}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {qs.length > 0 && (
                          <button type="button" onClick={copyQuestions} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap">
                            <Copy size={14} /> Copy all
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleGenerateQuestions}
                          disabled={busy || !!generatingFor}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg border border-rivix/40 bg-rivix/5 text-rivix hover:bg-rivix/10 disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          {busy ? <><Loader2 size={14} className="animate-spin" /> Writing…</> : <><Sparkles size={14} /> {qs.length ? 'Write new questions' : 'Write questions with AI'}</>}
                        </button>
                      </div>
                    </div>

                    {questionsError && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-2xl px-4 py-3" role="alert">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{questionsError}</span>
                      </div>
                    )}

                    {busy && (
                      <div className="space-y-3" aria-live="polite">
                        {[0, 1, 2].map((n) => (
                          <div key={n} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3 animate-pulse">
                            <div className="h-3 w-24 bg-slate-200 rounded" />
                            <div className="h-4 w-11/12 bg-slate-200 rounded" />
                            <div className="h-4 w-8/12 bg-slate-200 rounded" />
                          </div>
                        ))}
                        <p className="text-xs text-slate-400 text-center">Reading {first}&apos;s resume and writing questions. This takes a few seconds.</p>
                      </div>
                    )}

                    {!busy && qs.length === 0 && (
                      <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                        <Sparkles size={22} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-semibold text-slate-600">No questions written for {first} yet</p>
                        <p className="text-xs text-slate-400 mt-1">Click <strong>Write questions with AI</strong> to get questions based on this resume.</p>
                      </div>
                    )}

                    {!busy && qs.length > 0 && (
                      <ol className="space-y-4">
                        {qs.map((item, idx) => (
                          <li key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest">
                              <span className="text-slate-400">Question {idx + 1}</span>
                              {item.topic && <span className="text-rivix bg-rivix/10 px-2.5 py-0.5 rounded-full">{item.topic}</span>}
                            </div>
                            <p className="text-sm font-bold text-slate-900 leading-relaxed">{item.question}</p>
                            <div className="border-t border-slate-100 pt-3 space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Info size={10} /> What to look for</span>
                              <p className="text-xs text-slate-500 leading-relaxed">{item.lookFor}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}

                    <details className="group border border-slate-100 rounded-2xl bg-slate-50/50">
                      <summary className="cursor-pointer select-none px-5 py-3.5 text-xs font-bold text-slate-500 hover:text-slate-700">
                        Standard questions (the same for every candidate)
                      </summary>
                      <div className="px-5 pb-5 space-y-3">
                        {renderAiQuestions(selectedCand).map((item, idx) => (
                          <div key={idx} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-bold text-slate-800 leading-relaxed">{item.q}</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed"><span className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Look for </span>{item.focus}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })()}

              {/* TAB CONTENT: CORRESPONDENCE (email to the candidate) */}
              {activeSubTab === 'correspondence' && (() => {
                const first = selectedCand.name.split(' ')[0];
                const thread = candidateChats[selectedCand.id] || [];
                const canSend = !!messagingConfig?.email && !!selectedCand.email;
                const templates = [
                  { label: 'Invite to a call', text: `Hi ${first}, let's lock in our 15-minute introductory Zoom screening call. You can select a convenient slot directly using this link: ${buildCalComBookingUrl(selectedCand)}` },
                  { label: 'Ask for more info', text: `Hi ${first}, thanks for your interest in the sales role at RIVIX. Could you tell us a bit more about the accounts you currently manage and the territory you cover? Looking forward to hearing from you.` },
                  { label: 'Not moving forward', text: `Hi ${first}, thank you for your time and for applying to RIVIX. After careful review we won't be moving forward at this time, but we appreciate your interest and wish you all the best.` },
                ];
                return (
                  <div className="space-y-5">
                    {/* Who this goes to, and whether sending is set up */}
                    <div className="flex flex-wrap items-start justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-5">
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-base font-bold text-slate-900">Email {first}</h4>
                        <p className="text-sm text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-slate-400 font-semibold">To</span>
                          {selectedCand.email ? <span className="font-bold text-slate-800 break-all">{selectedCand.email}</span> : <span className="font-bold text-amber-600">no email address yet</span>}
                        </p>
                        <p className="text-xs text-slate-400">Sent by email from RIVIX. Replies arrive in the RIVIX inbox, not on this page.</p>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap border ${
                        messagingConfig?.email ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${messagingConfig?.email ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {messagingConfig?.email ? 'Email is set up' : 'Email is not set up'}
                      </span>
                    </div>

                    {messagingConfig && !messagingConfig.email && (
                      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed">Sending is switched off until the email service is configured (<code className="text-[11px]">RESEND_API_KEY</code> and <code className="text-[11px]">HIRING_FROM_EMAIL</code> in the hosting settings).</p>
                      </div>
                    )}
                    {!selectedCand.email && (
                      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed">This candidate has no email address. Use <strong>Edit</strong> at the top to add one.</p>
                      </div>
                    )}

                    {/* What has been sent */}
                    <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-5 max-h-[340px] overflow-y-auto">
                      {thread.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <Mail size={22} className="mx-auto mb-2 text-slate-300" />
                          <p className="text-sm font-semibold">No emails sent to {first} yet</p>
                          <p className="text-xs mt-1">Write a message below, or pick a ready-made one.</p>
                        </div>
                      ) : (
                        <ul className="space-y-4">
                          {thread.map((msg) => {
                            const failed = msg.deliveryStatus === 'failed';
                            return (
                              <li key={msg.id} className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold">
                                  <span>{formatDateTime(msg.timestamp)}</span>
                                  {failed ? (
                                    <span className="text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-black">Not sent</span>
                                  ) : (
                                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-black inline-flex items-center gap-1"><Check size={10} /> Sent</span>
                                  )}
                                </div>
                                <div className={`max-w-[85%] p-4 rounded-2xl rounded-tr-md text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${failed ? 'bg-red-50 text-red-900 border border-red-100' : 'bg-rivix text-white'}`}>
                                  {msg.text}
                                  {failed && msg.deliveryError && (
                                    <p className="mt-2 pt-2 border-t border-red-200 text-xs text-red-700">{msg.deliveryError}</p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <div ref={threadEndRef} />
                    </div>

                    {/* Write */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Ready-made</span>
                        {templates.map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => setCandidateMessageText(t.text)}
                            disabled={sendMessageLoading}
                            className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-rivix/40 hover:text-rivix px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {sendMessageError && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs" role="alert">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{sendMessageError}</span>
                        </div>
                      )}

                      <textarea
                        rows={5}
                        placeholder={`Write your email to ${first}…`}
                        value={candidateMessageText}
                        onChange={(e) => setCandidateMessageText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend && !sendMessageLoading) handleSendCandidateMessage(); }}
                        disabled={sendMessageLoading}
                        maxLength={5000}
                        className="w-full text-sm border border-slate-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-rivix/50 focus:ring-2 focus:ring-rivix/10 font-medium disabled:opacity-60 resize-y leading-relaxed"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">Cmd/Ctrl + Enter to send</span>
                        <button
                          type="button"
                          onClick={handleSendCandidateMessage}
                          disabled={sendMessageLoading || !candidateMessageText.trim() || !canSend}
                          className="bg-rivix text-white rounded-xl px-5 py-2.5 hover:bg-rivix-dark transition-all flex items-center gap-2 text-sm font-bold shadow-lg shadow-rivix/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                          {sendMessageLoading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={16} /> Send email</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          ) : (
            <div className="bg-white rounded-3xl p-20 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Users size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mt-4">Select a Candidate Profile</h2>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Choose a candidate from the left list to review detailed profiles, customized questions, and notes.
              </p>
            </div>
          )}
        </div>

      </div>


      {notice && (
        <div className="fixed bottom-6 right-6 z-[80] flex items-center gap-2.5 bg-slate-900 text-white text-sm font-semibold rounded-2xl px-5 py-3.5 shadow-2xl" role="status">
          <Check size={16} className="text-emerald-400" />
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-2 text-white/50 hover:text-white" aria-label="Dismiss">×</button>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        danger
        loading={deleting}
        title={`Remove ${deleteTarget?.name ?? 'this candidate'}?`}
        message="This permanently removes the candidate, their notes, scores and resume file. It can't be undone."
        confirmLabel="Remove candidate"
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          await handleRemoveCandidate(deleteTarget.id);
          setDeleting(false);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {copyFallbackLink && (
        <Modal onClose={() => setCopyFallbackLink(null)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Copy the booking link</h3>
            <p className="text-xs text-slate-500">Your browser blocked automatic copying. Select the link below and copy it.</p>
            <input readOnly autoFocus value={copyFallbackLink} onFocus={(e) => e.currentTarget.select()} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" />
            <button type="button" onClick={() => setCopyFallbackLink(null)} className="bg-slate-950 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rivix transition-all">Done</button>
          </div>
        </Modal>
      )}

      {showCandidateEditor && selectedCand && (
        <CandidateEditor
          candidate={selectedCand}
          onClose={() => setShowCandidateEditor(false)}
          onSaved={(saved) => {
            setSelectedCand(saved);
            setCandidates((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
            setShowCandidateEditor(false);
          }}
        />
      )}

      {showCriteriaEditor && (
        <CriteriaEditor
          criteria={criteria}
          hiringFor={hiringFor}
          companyContext={companyContext}
          scoringGuide={scoringGuide}
          onClose={() => setShowCriteriaEditor(false)}
          onSaved={(saved) => {
            setCriteria(saved.criteria);
            setHiringFor(saved.hiringFor);
            setCompanyContext(saved.companyContext);
            setScoringGuide(saved.scoringGuide);
            setShowCriteriaEditor(false);
            if (saved.contextNotSaved) setActionError(saved.contextNotSaved);
            else setNotice('Scoring settings saved.');
          }}
        />
      )}
    </div>
  );
}
