'use client';

import { useEffect, useState } from 'react';
import {
  getCandidates,
  saveCandidate,
  deleteCandidate,
  Candidate,
  TranscriptLine,
  SARAH_TRANSCRIPT,
  SCORECARD_WEIGHTS,
  computeWeightedScore
} from '@/lib/hiringStorage';
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
  Play,
  Pause,
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
  AlertCircle
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

const getCandLocation = (id: string) => {
  if (id === 'cand-test-sol') return 'Calgary, AB (Test)';
  if (id === 'cand-indeed-1') return 'Cochrane, AB';
  if (id === 'cand-indeed-2') return 'Red Deer, AB';
  if (id === 'cand-indeed-3') return 'Leduc, AB';
  if (id === 'cand-indeed-4') return 'Nisku, AB (Remote)';
  if (id === 'cand-indeed-5') return 'Calgary, AB';
  if (id === 'cand-indeed-6') return 'Windsor, ON';
  if (id === 'cand-indeed-7') return 'Windsor, ON';
  return 'Calgary, AB (HQ)';
};

// Dynamic ranking based on weighted composite score
const getCandidateRank = (cand: Candidate, allCandidates: Candidate[]) => {
  const score = computeWeightedScore(cand.scorecard);
  // Sort all candidates by weighted score descending to determine rank
  const sorted = [...allCandidates].sort((a, b) => computeWeightedScore(b.scorecard) - computeWeightedScore(a.scorecard));
  const rank = sorted.findIndex(c => c.id === cand.id) + 1;

  let tier: string;
  let style: string;
  if (score >= 7.0) {
    tier = 'Tier 1';
    if (rank === 1) style = 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-300 shadow-sm';
    else if (rank === 2) style = 'bg-indigo-100 text-indigo-700 font-bold border border-indigo-300 shadow-sm';
    else style = 'bg-blue-100 text-blue-700 font-bold border border-blue-300 shadow-sm';
  } else if (score >= 5.5) {
    tier = 'Tier 2';
    style = 'bg-slate-100 text-slate-600 font-bold border border-slate-200';
  } else {
    tier = 'Tier 3';
    style = 'bg-red-50 text-red-600 font-bold border border-red-200';
  }

  const competitorTag = cand.competitor ? ' — Competitor' : '';
  return { label: `#${rank} ${tier} (${score})${competitorTag}`, style, score, rank, tier };
};

export default function AdminHiringPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCand, setSelectedCand] = useState<Candidate | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'script' | 'transcript' | 'correspondence'>('profile');
  const [candidateMessageText, setCandidateMessageText] = useState('');
  const [candidateChats, setCandidateChats] = useState<Record<string, CorrespondenceMessage[]>>(() => loadCandidateChats());
  const [sendMessageLoading, setSendMessageLoading] = useState(false);
  const [sendMessageError, setSendMessageError] = useState<string | null>(null);
  const [messagingConfig, setMessagingConfig] = useState<{ email: boolean; fromEmail: string | null } | null>(null);
  const [uploadingResumes, setUploadingResumes] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'newest'>('score');
  const [statusFilter, setStatusFilter] = useState<'all' | 'screening' | 'interviewing' | 'offer' | 'archived'>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  
  // Audio Player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [transcriptTimer, setTranscriptTimer] = useState<NodeJS.Timeout | null>(null);
  const [highlightedLineIndex, setHighlightedLineIndex] = useState(-1);
  const [copiedCalLink, setCopiedCalLink] = useState(false);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  
  // Scorecard values in form (mapped to new weighted dimensions)
  const [scRolodex, setScRolodex] = useState(5);
  const [scAlberta, setScAlberta] = useState(5);
  const [scIndustry, setScIndustry] = useState(5);
  const [scCompIntel, setScCompIntel] = useState(5);
  const [scSalesMethod, setScSalesMethod] = useState(5);

  useEffect(() => {
    const loadData = async () => {
      const stored = await getCandidates();
      setCandidates(stored);
      if (stored.length > 0 && !selectedCand) {
        const testCand = stored.find((c) => c.id === 'cand-test-sol');
        setSelectedCand(testCand || stored[0]);
        syncScorecardForm(testCand || stored[0]);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    fetch('/api/hiring/send')
      .then((res) => res.json())
      .then((data) => setMessagingConfig(data))
      .catch(() => setMessagingConfig({ email: false, fromEmail: null }));
  }, []);

  const syncScorecardForm = (cand: Candidate) => {
    setScRolodex(cand.scorecard.existingRolodex);
    setScAlberta(cand.scorecard.albertaProximity);
    setScIndustry(cand.scorecard.industryKnowledge);
    setScCompIntel(cand.scorecard.competitiveIntel);
    setScSalesMethod(cand.scorecard.salesMethodology);
  };

  const handleSelectCandidate = (cand: Candidate) => {
    setSelectedCand(cand);
    syncScorecardForm(cand);
    // Reset player
    setIsPlaying(false);
    setPlayProgress(0);
    setHighlightedLineIndex(-1);
    if (transcriptTimer) clearInterval(transcriptTimer);
  };

  const handleUpdateStatus = async (candId: string, newStatus: 'screening' | 'interviewing' | 'offer' | 'archived') => {
    if (!selectedCand) return;
    
    const updated: Candidate = {
      ...selectedCand,
      status: newStatus
    };

    await saveCandidate(updated);
    setSelectedCand(updated);
    
    // Reload list
    const stored = await getCandidates();
    setCandidates(stored);
  };

  const handleSaveScorecard = async () => {
    if (!selectedCand) return;

    const updated: Candidate = {
      ...selectedCand,
      scorecard: {
        existingRolodex: scRolodex,
        albertaProximity: scAlberta,
        industryKnowledge: scIndustry,
        competitiveIntel: scCompIntel,
        salesMethodology: scSalesMethod
      }
    };

    await saveCandidate(updated);
    setSelectedCand(updated);

    // Reload list
    const stored = await getCandidates();
    setCandidates(stored);
    
    alert('Evaluation scorecard saved successfully!');
  };

  const handleRemoveCandidate = async (candId: string) => {
    if (!confirm('Are you sure you want to permanently remove this candidate profile?')) return;
    
    await deleteCandidate(candId);
    
    // Reload candidate list
    const stored = await getCandidates();
    setCandidates(stored);
    
    // Reset selection to Sol or first candidate
    if (stored.length > 0) {
      const testCand = stored.find((c) => c.id === 'cand-test-sol');
      setSelectedCand(testCand || stored[0]);
      syncScorecardForm(testCand || stored[0]);
    } else {
      setSelectedCand(null);
    }
    
    alert('Candidate profile removed successfully.');
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCand || !newNoteContent.trim()) return;

    const newNote = {
      id: `note-${Date.now()}`,
      author: 'Sol (Advisor)',
      content: newNoteContent,
      timestamp: new Date().toISOString()
    };

    const updated: Candidate = {
      ...selectedCand,
      notes: [...selectedCand.notes, newNote]
    };

    await saveCandidate(updated);
    setSelectedCand(updated);
    setNewNoteContent('');
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
        senderName: 'Sol (RIVIX CEO)',
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
        senderName: 'Sol (RIVIX CEO)',
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
    try {
      const newCands: Candidate[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('resume', file);

        try {
          let pdfDataUrl: string | undefined = undefined;
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            pdfDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (e) => reject(e);
              reader.readAsDataURL(file);
            });
          }

          const res = await fetch('/api/analyze-resume', {
            method: 'POST',
            body: formData
          });
          
          if (!res.ok) {
            console.error(`Failed to analyze ${file.name}`);
            continue;
          }

          const data = await res.json();
          
          const candidateName = data.name || file.name.replace(/\.[^/.]+$/, "");
          const candidateEmail = data.email || '';
          
          const existing = candidates.find(c => 
            c.name.toLowerCase() === candidateName.toLowerCase() || 
            (candidateEmail && c.email && c.email.toLowerCase() === candidateEmail.toLowerCase())
          );

          if (existing) {
            const updatedCandidate: Candidate = {
              ...existing,
              email: candidateEmail || existing.email,
              phone: data.phone || existing.phone,
              bio: data.bio || existing.bio,
              role: data.role || existing.role,
              experience: data.experience || existing.experience,
              currentCompany: data.currentCompany || existing.currentCompany,
              competitor: data.competitor !== undefined ? !!data.competitor : existing.competitor,
              scorecard: {
                existingRolodex: data.scorecard?.existingRolodex || existing.scorecard.existingRolodex,
                albertaProximity: data.scorecard?.albertaProximity || existing.scorecard.albertaProximity,
                industryKnowledge: data.scorecard?.industryKnowledge || existing.scorecard.industryKnowledge,
                competitiveIntel: data.scorecard?.competitiveIntel || existing.scorecard.competitiveIntel,
                salesMethodology: data.scorecard?.salesMethodology || existing.scorecard.salesMethodology
              },
              resumeText: data.rawText || data.bio || existing.resumeText,
              resumePdfUrl: pdfDataUrl || existing.resumePdfUrl,
            };
            newCands.push(updatedCandidate);
          } else {
            const newCandidate: Candidate = {
              id: `cand-uploaded-${Date.now()}-${i}`,
              name: candidateName,
              email: candidateEmail,
              phone: data.phone || '',
              bio: data.bio || 'Parsed from uploaded resume.',
              role: data.role || 'Sales Representative Applicant',
              experience: data.experience || 'Not specified',
              currentCompany: data.currentCompany || 'Not specified',
              competitor: !!data.competitor,
              status: 'screening',
              avatar: candidateName ? candidateName.substring(0, 2).toUpperCase() : 'UP',
              scorecard: {
                existingRolodex: data.scorecard?.existingRolodex || 5,
                albertaProximity: data.scorecard?.albertaProximity || 5,
                industryKnowledge: data.scorecard?.industryKnowledge || 5,
                competitiveIntel: data.scorecard?.competitiveIntel || 5,
                salesMethodology: data.scorecard?.salesMethodology || 5
              },
              notes: [],
              transcript: [],
              resumeText: data.rawText || data.bio || 'Uploaded resume details parsed.',
              resumePdfUrl: pdfDataUrl,
              createdAt: new Date().toISOString(),
            };
            newCands.push(newCandidate);
          }
        } catch (err) {
          console.error(`Error uploading ${file.name}:`, err);
        }
      }
      
      if (newCands.length > 0) {
        // Save all to persistent storage
        for (const c of newCands) {
          await saveCandidate(c);
        }
        // Reload candidates
        const stored = await getCandidates();
        setCandidates(stored);

        // If the currently selected candidate was updated, refresh the detail panel view!
        if (selectedCand) {
          const refreshedSelected = stored.find(c => c.id === selectedCand.id) || 
                                    stored.find(c => c.name.toLowerCase() === selectedCand.name.toLowerCase());
          if (refreshedSelected) {
            setSelectedCand(refreshedSelected);
            syncScorecardForm(refreshedSelected);
          }
        }
      }
    } catch (generalErr) {
      console.error('File upload general handler error:', generalErr);
    } finally {
      setUploadingResumes(false);
      e.target.value = '';
    }
  };


  const copyCalComLink = async () => {
    const link = buildCalComBookingUrl(selectedCand);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCalLink(true);
      setTimeout(() => setCopiedCalLink(false), 1800);
    } catch {
      alert(`Copy failed. Use this link:\n${link}`);
    }
  };

  // Toggle Audio Playback (Screening call simulation)
  const togglePlayTranscript = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (transcriptTimer) clearInterval(transcriptTimer);
    } else {
      setIsPlaying(true);
      
      const interval = setInterval(() => {
        setPlayProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            setHighlightedLineIndex(-1);
            return 100;
          }
          
          // Map progress to lines in Sarah's transcript
          const nextLineIndex = Math.floor((prev / 100) * SARAH_TRANSCRIPT.length);
          setHighlightedLineIndex(nextLineIndex);
          
          return prev + 2;
        });
      }, 300);
      
      setTranscriptTimer(interval);
    }
  };

  // Dynamic tailoring of AI-powered questions based on candidate profile
  const renderAiQuestions = (cand: Candidate) => {
    if (cand.id === 'cand-indeed-3') {
      // Dwight Kerr (30 years, Nisku, Journeyman Partsman)
      return [
        {
          q: `"Dwight, with 30 years in Leduc/Nisku industrial parts, you have deep relationships with safety superintendents. Name three specific accounts you could walk into on day one with RIVIX sample overalls, and who is the decision-maker at each."`,
          focus: "Verifies the depth and actionability of his rolodex. He should name actual companies (e.g., Flint, Kiewit, PCL) and specific safety contacts — not generic titles."
        },
        {
          q: `"RIVIX garments are compliance assets, not generic workwear. When a safety superintendent asks you about our FR thread specifications or CSA Z96 Class 3 high-vis layout, how do you respond? Walk us through the technical details."`,
          focus: "Evaluates whether his industrial parts experience translates to garment compliance literacy. Look for mention of NFPA 2112, arc flash ratings, Nomex threads. If gaps exist, assess his willingness to learn."
        },
        {
          q: `"This is 100% commission — RIVIX pays zero cash: no salary, draw, or expenses. Given your 30-year career, what makes you confident you can close enough contracts in your first 90 days?"`,
          focus: "Tests his hunger and conviction. Seasoned reps will reference specific warm leads, pending renewals, or safety managers who have already expressed frustration with current suppliers."
        }
      ];
    }

    if (cand.id === 'cand-indeed-7') {
      // Anthony Di Ponio (UniFirst, 20+ years — Competitor Raid)
      return [
        {
          q: `"Anthony, you have 20+ years at UniFirst. Walk us through exactly how UniFirst structures their rental contracts — the lock-in terms, hidden fees, replacement charges, and size-change surcharges that clients don't notice until year two."`,
          focus: "This is the strategic gold. He should detail minimum order quantities, damage surcharges ($8-15/garment), auto-renewal clauses, and the exact monthly per-garment rental math ($3.50-5.00/week)."
        },
        {
          q: `"RIVIX's pitch is: buy outright, save 28%, get brand-new garments. How do you dismantle UniFirst's retention pitch when a client says 'But we already have a contract with you'?"`,
          focus: "Evaluates whether he can flip the script. He should discuss contract exit windows, total cost comparison over 3 years, and the quality degradation of rental garments after 50+ industrial wash cycles."
        },
        {
          q: `"You are based in Windsor, ON. RIVIX's primary market is Alberta oil sands and Western Canada. How do you plan to cover this territory effectively on straight commission?"`,
          focus: "Geography is his biggest weakness. Look for concrete plans: relocation timeline, travel budget expectations, remote prospecting strategies, or existing Western Canada contacts from UniFirst's national accounts."
        }
      ];
    }

    if (cand.id === 'cand-indeed-2') {
      // Eduardo Dela Cruz (Red Deer, 15 years industrial B2B)
      return [
        {
          q: `"Eduardo, describe a specific contract you closed in the Red Deer/Edmonton industrial corridor. Who was the buyer, what was the deal size, and how did you win against competing suppliers?"`,
          focus: "Validates his claimed territory experience. Look for specific company names, contract values, and procurement process details."
        },
        {
          q: `"RIVIX replicates garments from photos using AI tech packs in 72 hours. How would you use this capability in a prospect meeting to differentiate against UniFirst or Mark's Commercial?"`,
          focus: "Tests whether he can leverage the RIVIX Portal as a sales weapon. Strong answer: 'I would photograph their current worn-out rentals on-site and generate a tech pack in front of them.'"
        }
      ];
    }

    if (cand.id === 'cand-indeed-1') {
      // Leanne Dumas (Startup consulting, Cochrane AB)
      return [
        {
          q: `"Leanne, your background is launching startups across multiple industries. RIVIX sells to safety superintendents at oil sands sites. Describe a time you sold a technical or compliance-driven product — not a service — to an industrial procurement department."`,
          focus: "Probes whether her startup consulting translates to garment sales. Startup launches and industrial B2B garment contracts are different. Look for any tangible product sales experience."
        },
        {
          q: `"If a prospect asks you to explain the difference between CSA Z96 Class 2 and Class 3 high-vis requirements, what do you tell them?"`,
          focus: "Tests baseline safety compliance knowledge. If she cannot answer this, she needs significant onboarding before being credible in front of oil sands safety managers. Expected answer: Class 3 requires 0.80m² background + 0.20m² retroreflective, covers torso + sleeves + legs."
        }
      ];
    }

    // Default template questions (for any candidate)
    return [
      {
        q: `"Safety garments are compliance assets, not simple apparel. How do you educate procurement managers who only look at unit cost on the return-on-investment of premium FR materials and reinforced seam construction?"`,
        focus: "Evaluate standard sales strategy. Look for details on lifespan extension (triple stitching lasting 3x longer), reduced injury rates, and compliance liability defense."
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-rivix rounded-3xl p-6 lg:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="bg-white/15 px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">Recruiting OS</span>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Sales Hiring & Credibility Board</h1>
            <p className="text-white/70 text-xs lg:text-sm leading-relaxed">
              Sol's advising dashboard designed to help the young RIVIX founders screen 120 applications, evaluate competitor sales reps from **UniFirst & Mark's Commercial**, speak with absolute technical credibility, and structure high-performance B2B commission SOPs.
            </p>
          </div>
          
          <div className="flex gap-4 shrink-0 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Total Pool</span>
              <p className="text-2xl font-black">{candidates.length}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Tier 1 (7.0+)</span>
              <p className="text-2xl font-black text-emerald-400">{candidates.filter(c => computeWeightedScore(c.scorecard) >= 7.0).length}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Tier 2 (5.5-6.9)</span>
              <p className="text-2xl font-black text-blue-400">{candidates.filter(c => { const s = computeWeightedScore(c.scorecard); return s >= 5.5 && s < 7.0; }).length}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Tier 3 (&lt;5.5)</span>
              <p className="text-2xl font-black text-rose-400">{candidates.filter(c => computeWeightedScore(c.scorecard) < 5.5).length}</p>
            </div>
          </div>
        </div>
        
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-rivix/20 rounded-full blur-3xl" />
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* SIDEBAR: shortlisted Candidates List (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Competitor & Veteran Pool</h3>
                
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
                    if (a.id === 'cand-test-sol') return -1;
                    if (b.id === 'cand-test-sol') return 1;
                    
                    if (sortBy === 'newest') {
                      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      if (timeA !== timeB) return timeB - timeA;
                    }
                    
                    return computeWeightedScore(b.scorecard) - computeWeightedScore(a.scorecard);
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
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                            isActive 
                              ? 'border-rivix bg-rivix/5 shadow-sm' 
                              : 'border-slate-100 hover:border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isActive ? 'bg-rivix text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {cand.avatar}
                            </div>
                            
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                {cand.name}
                                {cand.competitor && (
                                  <span className="text-[8px] font-black text-rivix uppercase bg-rivix/10 px-1.5 py-0.5 rounded tracking-widest">Competitor</span>
                                )}
                                <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                  getCandidateRank(cand, candidates).style
                                }`}>
                                  {getCandidateRank(cand, candidates).label}
                                </span>
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate max-w-[180px]">{cand.currentCompany}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded">{cand.experience}</span>
                            <ChevronRight size={14} className="text-slate-400 group-hover:text-rivix transition-colors ml-auto mt-1.5" />
                          </div>
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
                        No candidates found in this status.
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
        <div className="xl:col-span-8 space-y-6">
          {selectedCand ? (
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 space-y-6">
              
              {/* Header profile info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-rivix/10 border border-rivix/20 flex items-center justify-center font-bold text-lg text-rivix shadow-inner shrink-0">
                    {selectedCand.avatar}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {selectedCand.name}
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                        getCandidateRank(selectedCand, candidates).style
                      }`}>
                        {getCandidateRank(selectedCand, candidates).label}
                      </span>
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{selectedCand.role} ({selectedCand.experience} exp)</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Current: {selectedCand.currentCompany}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedCand.id !== 'cand-test-sol' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCandidate(selectedCand.id)}
                        className="inline-flex items-center justify-center p-2.5 rounded-xl border border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100 hover:text-rose-600 transition-all hover:border-rose-300"
                        title="Remove Candidate Profile"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <a
                      href={buildCalComBookingUrl(selectedCand)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-rivix text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rivix-dark transition-all active:scale-95 shadow-lg shadow-rivix/20"
                    >
                      <Calendar size={14} />
                      Schedule Call
                    </a>
                    <button
                      type="button"
                      onClick={copyCalComLink}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-rivix/35 text-slate-700 px-3.5 py-2.5 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all"
                    >
                      {copiedCalLink ? '✅ Link Copied' : '📋 Copy Booking Link'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status:</span>
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[9px] font-black uppercase tracking-widest bg-white">
                      {[
                        { label: 'Screen', val: 'screening' },
                        { label: 'Interview', val: 'interviewing' },
                        { label: 'Offer', val: 'offer' }
                      ].map(btn => (
                        <button
                          key={btn.val}
                          onClick={() => handleUpdateStatus(selectedCand.id, btn.val as any)}
                          className={`px-3 py-2 border-r border-slate-200 last:border-0 hover:bg-slate-50 transition-colors ${
                            selectedCand.status === btn.val ? 'bg-rivix/10 text-rivix font-bold' : 'text-slate-500'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick scheduling — prefills Cal.com with selected candidate */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-rivix/15 bg-rivix/5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Calendar size={14} className="text-rivix shrink-0" />
                    Schedule screening with {selectedCand.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Opens Cal.com with name, email, and candidate ID prefilled. Use <strong>Schedule Call</strong> above or send the link from Correspondence.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <a
                    href={buildCalComBookingUrl(selectedCand)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-rivix text-white px-3.5 py-2 rounded-xl text-[10px] font-bold hover:bg-rivix-dark transition-all"
                  >
                    <ExternalLink size={12} /> Open Cal.com
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('correspondence');
                      setCandidateMessageText(
                        `Hi ${selectedCand.name}, let's lock in our 15-minute introductory Zoom screening call. You can select a convenient slot directly using this link: ${buildCalComBookingUrl(selectedCand)}`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all"
                  >
                    <Mail size={12} /> Draft Email with Link
                  </button>
                </div>
              </div>

              {/* Candidate Metadata Contact Card Dashboard Widget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Indeed Partner Email</span>
                  <a 
                    href={`mailto:${selectedCand.email}`}
                    className="text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline truncate block"
                    title={selectedCand.email}
                  >
                    {selectedCand.email}
                  </a>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Direct Phone</span>
                  <a 
                    href={`tel:${selectedCand.phone}`}
                    className="text-xs font-bold text-slate-800 hover:text-rivix transition-colors block"
                  >
                    {selectedCand.phone}
                  </a>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Candidate Location</span>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <MapPin size={10} className="text-rivix" /> {getCandLocation(selectedCand.id)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Indeed ID / Sync Status</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    IND-2026-{selectedCand.id.split('-').pop()?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* TABS Selector: Profile/Notes, Script Generator, Transcript */}
              <div className="flex border-b border-slate-100">
                <button 
                  onClick={() => setActiveSubTab('profile')}
                  className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    activeSubTab === 'profile' 
                      ? 'border-rivix text-rivix' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Candidate Profile & Scorecard
                </button>
                <button 
                  onClick={() => setActiveSubTab('script')}
                  className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    activeSubTab === 'script' 
                      ? 'border-rivix text-rivix' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  AI Credibility Interview Script
                </button>
                <button 
                  onClick={() => setActiveSubTab('correspondence')}
                  className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                    activeSubTab === 'correspondence' 
                      ? 'border-rivix text-rivix' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Candidate Correspondence
                </button>
                {selectedCand.id === 'cand-1' && (
                  <button 
                    onClick={() => setActiveSubTab('transcript')}
                    className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                      activeSubTab === 'transcript' 
                        ? 'border-rivix text-rivix' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Screening Call Transcript
                  </button>
                )}
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
                        <span>Indeed Candidate Resume (Original PDF)</span>
                        {selectedCand.resumePdfUrl && (
                          <a 
                            href={selectedCand.resumePdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] font-black text-rivix hover:underline uppercase tracking-widest flex items-center gap-1"
                          >
                            Open Fullscreen <ExternalLink size={10} />
                          </a>
                        )}
                      </h3>
                      {selectedCand.resumePdfUrl ? (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 h-[500px] shadow-sm relative group">
                          <iframe 
                            src={`${selectedCand.resumePdfUrl}#toolbar=0`} 
                            className="w-full h-full border-none"
                            title={`${selectedCand.name} Resume`}
                          />
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl bg-slate-50 text-slate-500 text-xs p-8 text-center flex flex-col items-center justify-center gap-2">
                          <FileText size={24} className="text-slate-300 animate-pulse" />
                          <p className="font-semibold">No PDF Resume Seeded</p>
                          <p className="text-[10px] text-slate-400">Direct plain text extraction will be displayed.</p>
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
                              <span>{new Date(note.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed font-medium">{note.content}</p>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleAddNote} className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Type notes on client screening, candidate fit..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rivix/50 font-medium"
                        />
                        <button type="submit" className="bg-slate-900 text-white rounded-xl px-4 py-3 hover:bg-slate-800 text-xs font-bold transition-all">
                          Add
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Right Column: Scorecard Matrix (5 cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5"><Sliders size={12}/> Weighted Scorecard</h3>
                        <span className="text-[10px] font-black text-rivix uppercase bg-rivix/10 px-2.5 py-0.5 rounded-full">Adjustable</span>
                      </div>

                      {/* Composite Score Display */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Weighted Composite</span>
                          <span className="text-2xl font-black text-slate-900">
                            {computeWeightedScore({ existingRolodex: scRolodex, albertaProximity: scAlberta, industryKnowledge: scIndustry, competitiveIntel: scCompIntel, salesMethodology: scSalesMethod })}
                          </span>
                          <span className="text-xs text-slate-400 font-bold"> / 10</span>
                        </div>
                        {(() => {
                          const ws = computeWeightedScore({ existingRolodex: scRolodex, albertaProximity: scAlberta, industryKnowledge: scIndustry, competitiveIntel: scCompIntel, salesMethodology: scSalesMethod });
                          const tier = ws >= 7.0 ? 'TIER 1' : ws >= 5.5 ? 'TIER 2' : 'TIER 3';
                          const tierStyle = ws >= 7.0 ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : ws >= 5.5 ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-red-100 text-red-700 border-red-300';
                          return <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border ${tierStyle}`}>{tier}</span>;
                        })()}
                      </div>

                      <div className="space-y-4">
                        {[
                          { label: 'Existing Rolodex (Procurement Contacts)', weight: '30%', val: scRolodex, set: setScRolodex },
                          { label: 'Alberta / Western Canada Proximity', weight: '20%', val: scAlberta, set: setScAlberta },
                          { label: 'Industry Knowledge (FR / CSA / NFPA)', weight: '20%', val: scIndustry, set: setScIndustry },
                          { label: 'Competitive Intel (UniFirst / Cintas)', weight: '15%', val: scCompIntel, set: setScCompIntel },
                          { label: 'Sales Methodology (Hunting / Closing)', weight: '15%', val: scSalesMethod, set: setScSalesMethod }
                        ].map(slider => (
                          <div key={slider.label} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              <span className="flex items-center gap-1.5">
                                {slider.label}
                                <span className="text-[8px] font-black text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded">{slider.weight}</span>
                              </span>
                              <span className="font-black text-rivix">{slider.val}/10</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={slider.val}
                              onChange={(e) => slider.set(parseInt(e.target.value))}
                              className="w-full accent-rivix cursor-pointer"
                            />
                          </div>
                        ))}
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

              {/* TAB CONTENT: AI INTERVIEW QUESTIONS */}
              {activeSubTab === 'script' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 text-slate-800 space-y-2 flex items-start gap-4 shadow-sm">
                    <Volume2 size={24} className="text-rivix shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-rivix">AI interview Script Assistant</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-1 font-medium">
                        Use the script questions below to screen this candidate. These questions are tailored to their background to verify their competency network while establishing RIVIX as an elite technical compliance authority.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {renderAiQuestions(selectedCand).map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <span>Interview Prompt #{idx + 1}</span>
                          <span className="text-rivix bg-rivix/10 px-2 py-0.5 rounded-full">Credibility Tactic</span>
                        </div>
                        
                        <p className="text-xs font-bold text-slate-800 leading-relaxed italic">
                          {item.q}
                        </p>
                        
                        <div className="border-t border-slate-200/50 pt-2.5 space-y-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Info size={8}/> WHAT TO LOOK FOR IN THEIR RESPONSE
                          </span>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                            {item.focus}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: CORRESPONDENCE MESSENGER */}
              {activeSubTab === 'correspondence' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 text-slate-800 rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-black text-rivix uppercase tracking-widest bg-rivix/10 px-3 py-1 rounded-full">Live Outbound</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-200/60 px-3 py-1 rounded-full font-mono">{selectedCand.email}</span>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-200/60 px-3 py-1 rounded-full font-mono">{selectedCand.phone}</span>
                        </div>
                        <h4 className="text-sm font-bold mt-2 text-slate-900">Candidate Messaging Console</h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Sends real email via Resend to this candidate. Replies go to their inbox — not shown in this thread yet.
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[9px] font-black uppercase tracking-widest border self-start sm:self-center ${
                        messagingConfig?.email
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${messagingConfig?.email ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        Email {messagingConfig?.email ? 'Ready' : 'Not configured'}
                      </span>
                    </div>
                    {messagingConfig && !messagingConfig.email && (
                      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <p className="font-bold">Setup required in Vercel env vars:</p>
                          <p className="mt-1"><code className="text-[10px]">RESEND_API_KEY</code>, <code className="text-[10px]">HIRING_FROM_EMAIL</code> (e.g. RIVIX Hiring &lt;hello@rivix.ca&gt;)</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Messaging History */}
                  <div className="border border-slate-100 rounded-3xl bg-slate-50/50 p-6 h-[300px] overflow-y-auto space-y-4 flex flex-col justify-end">
                    <div className="space-y-4 overflow-y-auto pr-2">
                      {((selectedCand ? candidateChats[selectedCand.id] : []) || []).length > 0 ? (
                        ((selectedCand ? candidateChats[selectedCand.id] : []) || []).map((msg) => {
                          const isSol = msg.sender === 'admin';
                          return (
                            <div key={msg.id} className={`flex ${isSol ? 'justify-end' : 'justify-start'} gap-3 items-start`}>
                              {!isSol && (
                                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shrink-0 mt-0.5 border border-slate-300">
                                  {selectedCand.avatar}
                                </div>
                              )}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-500">{msg.senderName}</span>
                                  <span className="text-[8px] text-slate-400 font-semibold">
                                    {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-250 shadow-sm">
                                    📧 Email
                                  </span>
                                  {isSol && msg.deliveryStatus === 'sent' && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                      ✓ Sent
                                    </span>
                                  )}
                                  {isSol && msg.deliveryStatus === 'failed' && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200" title={msg.deliveryError}>
                                      ✗ Failed
                                    </span>
                                  )}
                                  {isSol && msg.deliveryStatus === 'simulated' && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                      Demo
                                    </span>
                                  )}
                                </div>
                                <div className={`p-4 rounded-2xl text-xs max-w-md leading-relaxed shadow-sm ${
                                  isSol 
                                    ? msg.deliveryStatus === 'failed'
                                      ? 'bg-red-600 text-white rounded-tr-none'
                                      : 'bg-rivix text-white rounded-tr-none'
                                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                                  }`}>
                                  {msg.text}
                                  {isSol && msg.deliveryStatus === 'failed' && msg.deliveryError && (
                                    <p className="mt-2 pt-2 border-t border-red-400/40 text-[10px] opacity-90">{msg.deliveryError}</p>
                                  )}
                                </div>
                              </div>
                              {isSol && (
                                <div className="w-7 h-7 rounded-full bg-rivix flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5">
                                  CEO
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          No correspondence logged for this candidate yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Input composition block */}
                  <div className="space-y-4">
                    {sendMessageError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px]">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{sendMessageError}</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder={`Email ${selectedCand?.name} at ${selectedCand?.email}...`}
                        value={candidateMessageText}
                        onChange={(e) => setCandidateMessageText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !sendMessageLoading && handleSendCandidateMessage()}
                        disabled={sendMessageLoading}
                        className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:border-rivix/50 font-medium disabled:opacity-60"
                      />
                      <button 
                        onClick={handleSendCandidateMessage}
                        disabled={sendMessageLoading || !candidateMessageText.trim() || !messagingConfig?.email}
                        className="bg-rivix text-white rounded-xl px-5 py-3 hover:bg-rivix-dark transition-all flex items-center justify-center active:scale-95 shadow-lg shadow-rivix/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-[52px]"
                      >
                        {sendMessageLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>

                    {/* Cal.com scheduler integration */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Cal.com:</span>
                      <a
                        href={buildCalComBookingUrl(selectedCand)}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-rivix text-white px-3.5 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5 hover:bg-rivix-dark transition-all active:scale-95 shadow-sm"
                      >
                        <ExternalLink size={12} /> Open Scheduler
                      </a>
                      <button
                        onClick={copyCalComLink}
                        className="bg-white border border-slate-200 hover:border-rivix/35 text-slate-700 px-3.5 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                      >
                        {copiedCalLink ? '✅ Copied' : '📋 Copy Personalized Link'}
                      </button>
                      <button
                        onClick={() => {
                          setCandidateMessageText(
                            `Hi ${selectedCand?.name}, let's lock in our 15-minute introductory Zoom screening call. You can select a convenient slot directly using this link: ${buildCalComBookingUrl(selectedCand)}`
                          );
                        }}
                        className="bg-white border border-slate-200 hover:border-rivix/35 text-slate-700 px-3.5 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                      >
                        📅 Draft Cal.com Email
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: SCREENING TRANSCRIPT (SARAH ONLY) */}
              {activeSubTab === 'transcript' && selectedCand.id === 'cand-1' && (
                <div className="space-y-6">
                  
                  {/* Waveform Player */}
                  <div className="bg-slate-900 rounded-3xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800 shadow-md">
                    <div className="flex items-center gap-3.5">
                      <button 
                        onClick={togglePlayTranscript}
                        className="w-12 h-12 rounded-full bg-rivix flex items-center justify-center text-white hover:bg-rivix-dark hover:scale-105 active:scale-95 transition-all shrink-0 shadow-lg"
                      >
                        {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-1" />}
                      </button>
                      
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Volume2 size={12} className="text-rivix" />
                          Screening Call Playback
                        </h4>
                        <p className="text-[10px] text-slate-400">Simulating recorded client interview call: Sarah Jenkins</p>
                      </div>
                    </div>

                    {/* Waveform graphic */}
                    <div className="flex-1 flex items-end gap-0.5 h-10 px-4">
                      {Array.from({ length: 45 }).map((_, idx) => {
                        const h = 10 + Math.sin(idx * 0.4) * 20 + Math.cos(idx * 0.9) * 8;
                        const isPast = (idx / 45) * 100 < playProgress;
                        
                        return (
                          <div 
                            key={idx}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              isPast ? 'bg-rivix h-full' : 'bg-slate-700'
                            }`}
                            style={{ height: `${Math.max(4, h)}px` }}
                          />
                        );
                      })}
                    </div>

                    <div className="text-right font-mono text-[10px] text-slate-400 shrink-0">
                      <span>{Math.floor(playProgress * 0.04)}:{(Math.floor(playProgress * 2.4) % 60).toString().padStart(2, '0')} / 04:30</span>
                    </div>
                  </div>

                  {/* Transcript Queue */}
                  <div className="border border-slate-100 rounded-3xl bg-slate-50/50 p-6 h-[400px] overflow-y-auto space-y-4">
                    {SARAH_TRANSCRIPT.map((line, idx) => {
                      const isHighlighted = highlightedLineIndex === idx;
                      const hasInsight = line.category && line.category !== 'general';
                      
                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 relative group ${
                            isHighlighted 
                              ? 'bg-rivix/5 border-rivix shadow-sm scale-[1.01]' 
                              : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                            <span className={line.speaker.includes('Interviewer') ? 'text-slate-500' : 'text-rivix'}>{line.speaker}</span>
                            <span className="text-slate-400 font-mono">{line.timestamp}</span>
                          </div>
                          
                          <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                            {line.text}
                          </p>

                          {hasInsight && (
                            <div className="border-t border-slate-100 pt-2 flex items-start gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:block transition-all">
                              <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded tracking-widest text-[8px]">
                                {line.category}
                              </span>
                              <span className="text-slate-500 lowercase first-letter:uppercase font-medium italic mt-0.5">
                                — {line.insight}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}

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

    </div>
  );
}
