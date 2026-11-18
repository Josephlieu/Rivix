'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ReviewTab from './ReviewTab';
import SpecReviewPanel from './SpecReviewPanel';
import { useRequestTemplate } from './useRequestTemplate';
import { isProduct, scanStepLabels } from '@/lib/template-display';
import { viewsText } from '@/lib/template-catalog';
import AnalysisTabView, { AI_SCAN_STEPS, analysisResultFromSaved, type AIAnalysisResult } from './AnalysisTabView';
import SectionErrorBoundary, { RenderSection } from '@/components/SectionErrorBoundary';
import { normalizeAnalysis } from '@/lib/analysis-shape';
import type { ConfirmationRef } from '@/lib/checklist-confirm';
import { prepare as preparePhoto, MAX_PHOTOS, MAX_BYTES, OK_TYPES } from './NewRequestDialog';
import ChatPanel from './ChatPanel';
import { useReplicationChat } from './useReplicationChat';
import Toast, { type ToastMessage } from '@/components/Toast';
import { formatDate } from '@/lib/format';
import InboundParcelCard from './InboundParcelCard';
import { prefillSpecs, suggestFrenchCare } from '@/lib/techFileStandards';
import Modal from '@/components/Modal';
import { downloadTechFile } from './downloadTechFile';
import { 
  getReplication,
  saveReplication, 
  deleteReplication,
  archiveReplication,
  uploadReplicationPhoto,
  getReplicationLookups,
  getDownloadLog,
  logDownload,
  type DownloadEntry,
  ReplicationRequest,
  ReplicationSpec
} from '@/lib/replicationStorage';
import { 
  Package,
  Loader2,
  Trash2,
  Truck,
  CheckCircle,
  ExternalLink,
  FileText,
  Sparkles,
  Check
} from 'lucide-react';

// The AI analysis types and scan steps live with the tab's display (AnalysisTabView.tsx).

// One request. The same screen for both roles of the internal tool (customers are never connected to it):
//  - admin: everything (approve, tech file PDF, dispatch, delete, give the request to a rep);
//  - rep: their own request only (photos, scan, the AI draft, inbound parcel and the chat with the admin).
export default function ReplicationDetail({ role, idOrCode }: { role: 'admin' | 'rep'; idOrCode: string }) {
  const router = useRouter();
  const isAdmin = role === 'admin';
  const basePath = isAdmin ? '/admin/replication' : '/rep/replication';
  const [reps, setReps] = useState<Array<{ id: string; name: string }>>([]);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pendingRepId, setPendingRepId] = useState<string | null>(null); // the rep being saved (shows a loader)
  const [replications, setReplications] = useState<ReplicationRequest[]>([]);
  const [selectedRep, setSelectedRep] = useState<ReplicationRequest | null>(null);
  // The open tab lives in the address (?tab=review) so a refresh or a shared link keeps the place.
  type TabId = 'specs' | 'ai_analysis' | 'review' | 'tracking' | 'chat';
  const TAB_QUERY: Record<TabId, string> = { specs: 'specs', ai_analysis: 'ai', review: 'review', tracking: 'shipping', chat: 'chat' };
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'specs';
    const q = new URLSearchParams(window.location.search).get('tab');
    const found = (Object.keys(TAB_QUERY) as TabId[]).find(k => TAB_QUERY[k] === q) ?? 'specs';
    return !isAdmin && (found === 'review' || found === 'ai_analysis') ? 'specs' : found; // tech files are admin only
  });
  // The address can change WITHOUT the page reloading (for example when a notification is clicked while this request is
  // open, or when moving here from another screen): follow it, so ?tab=chat always opens the chat.
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    const found = (Object.keys(TAB_QUERY) as TabId[]).find(k => TAB_QUERY[k] === tabParam);
    if (found && (isAdmin || (found !== 'review' && found !== 'ai_analysis'))) setActiveTabState(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const setActiveTab = (t: TabId) => {
    setActiveTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', TAB_QUERY[t]);
    window.history.replaceState(window.history.state, '', url); // replace, so the Back button is not filled with tab clicks
  };
  // The Team chat lives here (not inside the tab) so the tab can show how many messages are unread.
  const chat = useReplicationChat(selectedRep?.id, role, activeTab === 'chat');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<ReplicationRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  // Shipping Dispatch Form States
  const [adminCarrier, setAdminCarrier] = useState('DHL Express');
  const [adminTrackingCode, setAdminTrackingCode] = useState('');

  // Chat Form States
  const [chatMessage, setChatMessage] = useState('');

  // Hotspot State
  const [activeHotspot, setActiveHotspot] = useState<{ id: string; title: string; description: string } | null>(null);
  // The request's template: the shared lookup (also used by the Review tab, the PDF and the download). Gloves, footwear and PPE
  // show their own fields and words on the specs panel and the AI analysis tab (template-display.ts).
  const requestTpl = useRequestTemplate(selectedRep?.garmentType ?? '', selectedRep?.aiAnalysis?.template?.versions);
  const productTpl = !requestTpl.templateProblem && isProduct(requestTpl.template) ? requestTpl.template : null;

  // Production Factory Dispatch State
  const [dispatchedTix, setDispatchedTix] = useState<{ [key: string]: boolean }>({});
  const [dispatching, setDispatching] = useState(false);

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<{ [repId: string]: AIAnalysisResult }>({});

  const getAIAnalysis = (repId: string): AIAnalysisResult => {
    // Saved scans come in many shapes (RQ-0635: a boot scan with a partial BOM): read through the shape clean-up, never as is.
    const saved = normalizeAnalysis<Record<string, any>>(replications.find(r => r.id === repId)?.aiAnalysis); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!aiAnalysis[repId] && saved) return analysisResultFromSaved(saved);
    return aiAnalysis[repId] || {
      status: 'idle',
      currentStep: 0,
      totalSteps: AI_SCAN_STEPS.length,
      stepLabel: '',
      progress: 0,
      components: [],
      detectedSoFar: [],
      fabricAnalysis: null,
      wireframeGenerated: false,
      garmentClass: null,
      overallConfidence: null,
      season: null,
      measurements: [],
      bom: null,
      construction: [],
      stitchReference: [],
      labelPlacements: [],
      colorway: null,
      washCare: null,
    };
  };



  const handleStartAIAnalysis = useCallback(async (repId: string, garmentType: string) => {
    // 1. Get all images to analyze — more photos = better factory specs
    const rep = replications.find(r => r.id === repId);
    // A second scan replaces the AI draft, including any corrections made on the Review tab, and needs approving again.
    // Task 30: an approved tech file is locked; a new scan starts a new draft and the approved revision stays as it was.
    const lockedRev = rep?.aiAnalysis?.review?.status === 'approved' ? Number(rep.aiAnalysis.review.revision) || 0 : null;
    if (lockedRev !== null && !window.confirm(`This tech file is approved (Rev ${lockedRev}) and locked.\n\nA new scan starts a new draft. Rev ${lockedRev}, its PDF and any customer approval stay exactly as they are (see History).`)) return;
    if (lockedRev === null && rep?.aiAnalysis && !window.confirm('Run the AI scan again?\n\nThis replaces the current AI draft, including any corrections you made on the Review & Approve tab, and the specification will need approving again.')) return;
    const imagesToAnalyze = rep?.images || [];

    // Initialize analysis state
    setAiAnalysis(prev => ({
      ...prev,
      [repId]: {
        status: 'scanning',
        currentStep: 0,
        totalSteps: AI_SCAN_STEPS.length,
        stepLabel: 'Initializing Gemini Vision API...',
        progress: 10,
        components: [],
        detectedSoFar: [],
        fabricAnalysis: null,
        wireframeGenerated: false,
        garmentClass: null,
        overallConfidence: null,
        season: null,
        measurements: [],
        bom: null,
        construction: [],
        stitchReference: [],
        labelPlacements: [],
        colorway: null,
        washCare: null,
      }
    }));

    try {
      if (imagesToAnalyze.length === 0) {
        throw new Error("No reference images found for analysis.");
      }

      // Quick visual feedback sequence to show scanning has started
      let tempStep = 1;
      const progressInterval = setInterval(() => {
        setAiAnalysis(prev => {
          const current = prev[repId];
          if (!current || current.status !== 'scanning') return prev;
          const nextStep = Math.min(tempStep, AI_SCAN_STEPS.length - 2);
          tempStep++;
          return {
            ...prev,
            [repId]: {
              ...current,
              currentStep: nextStep,
              stepLabel: scanStepLabels(productTpl, AI_SCAN_STEPS.map(x => x.label))[nextStep] || 'Analyzing...', // gloves, footwear, PPE: no zipper or hi-vis steps
              progress: Math.min(current.progress + 15, 85),
            }
          };
        });
      }, 1500);

      // Call our Next.js API route
      const response = await fetch('/api/analyze-garment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replicationId: repId }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze garment');
      }

      const data = await response.json();
      const aiData = normalizeAnalysis<any>(data.analysis); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!aiData) throw new Error('The AI scan returned no result. Try again.');
      if (data.note) setError(data.note);

      // Update state with the real data from Gemini
      setAiAnalysis(prev => {
        const current = prev[repId];
        return {
          ...prev,
          [repId]: {
            ...current,
            status: 'complete',
            currentStep: AI_SCAN_STEPS.length,
            stepLabel: 'Analysis Complete — Components Mapped to Blueprint',
            progress: 100,
            components: aiData.components || [],
            detectedSoFar: aiData.components || [], // Reveal all
            fabricAnalysis: aiData.fabricAnalysis || null,
            wireframeGenerated: true,
            garmentClass: aiData.garmentClass || null,
            overallConfidence: aiData.overallConfidence || null,
            season: aiData.season || null,
            measurements: aiData.measurements || [],
            bom: aiData.bom || null,
            construction: aiData.construction || [],
            stitchReference: aiData.stitchReference || [],
            labelPlacements: aiData.labelPlacements || [],
            colorway: aiData.colorway || null,
            washCare: aiData.washCare || null,
          }
        };
      });

      // Keep the draft with the request so it survives a refresh (a failed save is shown, not hidden).
      // The blank basic-specification fields are drafted from what the AI found (typed values are never overwritten).
      // French care lines are drafted from the standard care phrases (a phrase with no standard translation stays blank).
      const washCare = aiData.washCare
        ? { ...aiData.washCare, instructionsFr: aiData.washCare.instructionsFr?.length ? aiData.washCare.instructionsFr : suggestFrenchCare(aiData.washCare.instructions || []).fr }
        : aiData.washCare;
      // `scan: true`: a scan result confirms nothing, and its revision is labelled "AI scan, started by <you>" (2026-11-18).
      if (rep) await persist({ ...rep, specs: prefillSpecs(rep.specs, aiData).specs, aiAnalysis: { ...aiData, washCare, analyzedAt: new Date().toISOString() } }, false, { newDraft: lockedRev !== null, scan: true });

    } catch (err: any) {
      console.warn("AI Analysis Error:", err);
      const message = err?.message || 'Failed to analyze garment';
      setError(message);
      // Revert state; the reason stays on the AI tab next to the scan button (2026-11-18), not only in the console.
      setAiAnalysis(prev => ({
        ...prev,
        [repId]: {
          ...prev[repId],
          status: 'idle',
          stepLabel: 'Failed',
          error: message,
        }
      }));
    }
  }, [replications]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDispatchToFactory = () => {
    if (!selectedRep) return;
    setDispatching(true);
    setTimeout(() => {
      setDispatching(false);
      setDispatchedTix(prev => ({
        ...prev,
        [selectedRep.id]: true
      }));
    }, 1200);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const found = await getReplication(idOrCode);
        setReplications(found ? [found] : []);
        setSelectedRep(found);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the replication requests.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [idOrCode]);

  // Photos on a saved request: add more (shrunk first, like on the new-request form), make one the main photo, or remove one.
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoMsg, setPhotoMsg] = useState('');
  const addPhotos = async (list: FileList | null) => {
    if (!selectedRep || !list?.length || photoMsg) return;
    const room = MAX_PHOTOS - (selectedRep.images?.length || 0);
    const all = Array.from(list).filter(f => OK_TYPES.includes(f.type));
    const picked = all.slice(0, Math.max(0, room));
    if (picked.length === 0) { setError(room <= 0 ? `A request can hold up to ${MAX_PHOTOS} photos.` : 'Choose JPEG, PNG or WebP photos.'); return; }
    let latest: ReplicationRequest = selectedRep;
    let added = 0;
    try {
      for (let i = 0; i < picked.length; i++) {
        setPhotoMsg(`Uploading photo ${i + 1} of ${picked.length}…`);
        const f = await preparePhoto(picked[i]);
        if (f.size > MAX_BYTES) throw new Error(`"${picked[i].name}" is still over 4 MB after shrinking.`);
        latest = await uploadReplicationPhoto(selectedRep.id, f);
        added++;
      }
      setError(all.length > picked.length ? `Only ${added} photo${added === 1 ? '' : 's'} added: a request can hold up to ${MAX_PHOTOS}.` : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the photo.');
    } finally {
      if (added > 0) {
        const saved = latest;
        setReplications(prev => prev.map(r => (r.id === saved.id ? saved : r)));
        setSelectedRep(cur => (cur && cur.id === saved.id ? saved : cur));
        setToast({ type: 'success', text: `${added} photo${added === 1 ? '' : 's'} added. Click "Run again" on the AI tab to include ${added === 1 ? 'it' : 'them'} in the analysis.` });
      }
      setPhotoMsg('');
      if (photoInput.current) photoInput.current.value = '';
    }
  };
  const removePhoto = async (idx: number) => {
    if (!selectedRep || photoMsg) return;
    if (!window.confirm('Remove this photo from the request?\n\nThe AI result is not changed. Click "Run again" on the AI tab to scan without it.')) return;
    const drop = <T,>(l: T[]) => l.filter((_, i) => i !== idx);
    await persist({ ...selectedRep, images: drop(selectedRep.images || []), imagePaths: drop(selectedRep.imagePaths || []), imageLabels: drop(selectedRep.imageLabels || []) });
  };

  // Save a changed request. On success the saved copy (with fresh photo links) replaces the old one
  // everywhere; on failure nothing changes on screen and the reason is shown.
  const persist = async (updated: ReplicationRequest, approve = false, opts: { newDraft?: boolean; scan?: boolean; confirmations?: ConfirmationRef[] } = {}): Promise<boolean> => {
    try {
      const { pdfWarning, ...saved } = await saveReplication(updated, { approve, newDraft: opts.newDraft, scan: opts.scan, confirmations: opts.confirmations });
      setReplications(prev => prev.map(r => (r.id === saved.id ? saved : r)));
      setSelectedRep(cur => (cur && cur.id === saved.id ? saved : cur));
      setError(pdfWarning ?? '');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the request.');
      return false;
    }
  };

  // Admin only: the sales reps a request can be given to, and who downloaded the tech file.
  useEffect(() => {
    if (!isAdmin) return;
    getReplicationLookups().then(l => setReps(l.reps)).catch(() => {});
  }, [isAdmin]);
  const requestId = selectedRep?.id;
  useEffect(() => {
    if (!isAdmin || !requestId) return;
    getDownloadLog(requestId).then(setDownloads).catch(() => {});
  }, [isAdmin, requestId]);

  const changeRep = async (repId: string) => {
    if (!selectedRep || pendingRepId !== null) return;
    setPendingRepId(repId);
    const ok = await persist({ ...selectedRep, repId: repId || null });
    setPendingRepId(null);
    if (ok) {
      const name = repId ? reps.find(r => r.id === repId)?.name || 'the sales rep' : null;
      setToast({ type: 'success', text: name ? `Sales rep changed to ${name}. They have been notified.` : 'Sales rep removed: Admin now handles this request directly.' });
    } else {
      setToast({ type: 'error', text: 'The sales rep was not changed. See the message at the top of the page.' });
    }
  };

  const handleDownload = async () => {
    if (!selectedRep || building) return;
    setBuilding(true);
    try {
      await downloadTechFile(selectedRep);
      const review = selectedRep.aiAnalysis?.review;
      await logDownload(selectedRep.id, review?.revision || 0, review?.status === 'approved');
      getDownloadLog(selectedRep.id).then(setDownloads).catch(() => {});
      setToast({ type: 'success', text: 'Tech file downloaded (it was saved to your Downloads folder).' });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? `Could not build the tech file: ${e.message}` : 'Could not build the tech file.');
    } finally {
      setBuilding(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteReplication(confirmDelete.id);
      router.push(basePath);
      return;
    } catch (e) {
      // Task 30: a request with an approved tech file or a customer approval is archived instead.
      if ((e as { code?: string })?.code === 'archive-instead') { setArchiveOffer(confirmDelete); setConfirmDelete(null); return; }
      setConfirmDelete(null);
      setError(e instanceof Error ? e.message : 'Could not delete the request.');
    } finally {
      setDeleting(false);
    }
  };
  const [archiveOffer, setArchiveOffer] = useState<ReplicationRequest | null>(null);
  const handleArchive = async (target: ReplicationRequest, archived: boolean) => {
    setDeleting(true);
    try {
      const saved = await archiveReplication(target.id, archived);
      setArchiveOffer(null);
      if (archived) { router.push(basePath); return; }
      setReplications(prev => prev.map(r => (r.id === saved.id ? saved : r)));
      setSelectedRep(cur => (cur && cur.id === saved.id ? saved : cur));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not archive the request.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'received' | 'spec_mapped' | 'sample_production' | 'sample_shipped') => {
    if (!selectedRep) return;
    
    const updated: ReplicationRequest = {
      ...selectedRep,
      status: newStatus,
      messages: [
        ...selectedRep.messages,
        {
          id: `msg-${Date.now()}`,
          sender: 'admin',
          senderName: 'RIVIX Production',
          message: `Ticket status updated to: ${newStatus.toUpperCase().replace('_', ' ')}`,
          timestamp: new Date().toISOString()
        }
      ]
    };
    
    if (await persist(updated)) setToast({ type: 'success', text: newStatus === 'sample_production' ? 'Sample production started. The sales rep has been notified.' : 'Status updated.' });
  };

  const handleDispatchSample = async () => {
    if (!selectedRep || !adminTrackingCode.trim()) return;

    const updated: ReplicationRequest = {
      ...selectedRep,
      rivixTrackingCarrier: adminCarrier,
      rivixTrackingNumber: adminTrackingCode,
      status: 'sample_shipped',
      messages: [
        ...selectedRep.messages,
        {
          id: `msg-${Date.now()}`,
          sender: 'admin',
          senderName: 'RIVIX Production',
          message: `Finished prototype sample dispatched via ${adminCarrier}. Tracking code: ${adminTrackingCode}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (await persist(updated)) { setAdminTrackingCode(''); setToast({ type: 'success', text: 'Sample dispatched. The request is now Shipped and the sales rep has been notified.' }); }
  };

  const handleSendMessage = async () => {
    if (!selectedRep || !chatMessage.trim()) return;

    const updated: ReplicationRequest = {
      ...selectedRep,
      messages: [
        ...selectedRep.messages,
        {
          id: `msg-${Date.now()}`,
          sender: 'admin',
          senderName: 'Sarah R. (RIVIX Production)',
          message: chatMessage,
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (await persist(updated)) setChatMessage('');
  };

  const handleUsePresetMessage = (preset: string) => {
    setChatMessage(preset);
  };

  const getTrackingUrl = (carrier?: string, trackingNum?: string) => {
    if (!carrier || !trackingNum) return '#';
    const num = encodeURIComponent(trackingNum.trim());
    if (carrier.toLowerCase().includes('canada post')) {
      return `https://www.canadapost-postescanada.ca/track-reperage/en#/resultList?searchFor=${num}`;
    }
    if (carrier.toLowerCase().includes('purolator')) {
      return `https://www.purolator.com/en/shipping/tracker?pin=${num}`;
    }
    if (carrier.toLowerCase().includes('ups')) {
      return `https://www.ups.com/track?loc=en_CA&tracknum=${num}`;
    }
    if (carrier.toLowerCase().includes('fedex')) {
      return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${num}`;
    }
    if (carrier.toLowerCase().includes('dhl')) {
      return `https://www.dhl.com/ca-en/home/tracking.html?tracking-id=${num}`;
    }
    return '#';
  };

  // Render clickable vector blueprints (Stunning Neon Technical Schematic - Admin View)
  const RenderBlueprint = ({ garmentType, annotations }: { garmentType: string; annotations: any[] }) => {
    const isOveralls = garmentType === 'overalls';
    
    return (
      <svg viewBox="0 0 400 600" className="w-full h-full max-h-[480px] select-none filter drop-shadow-[0_0_15px_rgba(198,18,19,0.15)]">
        {/* Glowing Blueprint Grid */}
        <defs>
          <pattern id="neon-grid-admin" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(56, 189, 248, 0.07)" strokeWidth="1"/>
            <circle cx="0" cy="0" r="1.5" fill="rgba(56, 189, 248, 0.2)" />
          </pattern>
          <linearGradient id="glowGradAdmin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#c61213" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid Background */}
        <rect width="100%" height="100%" fill="url(#neon-grid-admin)" rx="24" />
        <rect width="100%" height="100%" fill="url(#glowGradAdmin)" opacity="0.4" rx="24" />
        
        {isOveralls ? (
          <>
            {/* Technical CAD Measurement Lines */}
            <line x1="60" y1="50" x2="60" y2="550" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="3,6" />
            <line x1="340" y1="50" x2="340" y2="550" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="3,6" />
            
            {/* 1. OVERALLS SHAPE OUTLINE */}
            {/* Shoulder straps */}
            <rect x="135" y="65" width="20" height="75" rx="3" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="2" />
            <rect x="245" y="65" width="20" height="75" rx="3" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="2" />
            
            {/* Metallic Buckles */}
            <rect x="132" y="115" width="26" height="15" rx="4" fill="rgba(30, 41, 59, 0.9)" stroke="rgba(56, 189, 248, 0.9)" strokeWidth="1.5" />
            <line x1="132" y1="122" x2="158" y2="122" stroke="rgba(56, 189, 248, 0.8)" strokeWidth="1" />
            <rect x="242" y="115" width="26" height="15" rx="4" fill="rgba(30, 41, 59, 0.9)" stroke="rgba(56, 189, 248, 0.9)" strokeWidth="1.5" />
            <line x1="242" y1="122" x2="268" y2="122" stroke="rgba(56, 189, 248, 0.8)" strokeWidth="1" />
            
            {/* Main Outer Shell of the Bib and Pants combined */}
            <path 
              d="M 120 135 L 280 135 L 295 240 L 305 240 L 295 560 L 230 560 L 215 330 L 185 330 L 170 560 L 105 560 L 95 240 L 105 240 Z" 
              fill="rgba(15, 23, 42, 0.7)" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="2.5" strokeLinejoin="round"
            />

            {/* Inner seam line patterns */}
            <path 
              d="M 120 240 L 280 240 M 130 135 L 130 240 M 270 135 L 270 240" 
              fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" strokeDasharray="3,3"
            />
            
            {/* Center Front Zipper of Bib */}
            <rect x="193" y="135" width="14" height="185" rx="2" fill="rgba(30, 41, 59, 0.95)" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1.5" />
            <line x1="200" y1="135" x2="200" y2="320" stroke="rgba(198, 18, 19, 0.75)" strokeWidth="2" strokeDasharray="2,2" />
            <rect x="196" y="140" width="8" height="12" rx="1" fill="#f59e0b" stroke="rgba(245, 158, 11, 0.8)" strokeWidth="1" />
            
            {/* Double stitch seam lines on legs */}
            <path 
              d="M 130 240 L 130 555 M 270 240 L 270 555 M 190 335 L 175 555 M 210 335 L 225 555" 
              fill="none" stroke="rgba(198, 18, 19, 0.6)" strokeWidth="1" strokeDasharray="2,4"
            />
            
            {/* Chest Utility Pockets */}
            <rect x="115" y="150" width="45" height="50" rx="4" fill="rgba(30, 41, 59, 0.8)" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="1.5" />
            <path d="M 115 150 L 160 150 L 155 160 L 120 160 Z" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="1.5" />
            <circle cx="137.5" cy="155" r="2.5" fill="#e2e8f0" />
            
            <rect x="240" y="150" width="45" height="50" rx="4" fill="rgba(30, 41, 59, 0.8)" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="1.5" />
            <path d="M 240 150 L 285 150 L 280 160 L 245 160 Z" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="1.5" />
            <circle cx="262.5" cy="155" r="2.5" fill="#e2e8f0" />
            
            {/* High-Vis Reflective Band Layout */}
            <rect x="100" y="210" width="200" height="14" fill="#fbbf24" opacity="0.9" />
            <rect x="100" y="214" width="200" height="6" fill="#e2e8f0" opacity="0.95" />
            
            {/* Thigh cargo pockets */}
            <rect x="100" y="270" width="45" height="60" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.65)" strokeWidth="1.5" />
            <path d="M 100 270 L 145 270 L 140 280 L 105 280 Z" fill="rgba(30, 41, 59, 0.95)" stroke="rgba(56, 189, 248, 0.65)" strokeWidth="1.5" />
            
            <rect x="255" y="270" width="45" height="60" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.65)" strokeWidth="1.5" />
            <path d="M 255 270 L 300 270 L 295 280 L 260 280 Z" fill="rgba(30, 41, 59, 0.95)" stroke="rgba(56, 189, 248, 0.65)" strokeWidth="1.5" />
            
            {/* Heavy-Duty Cordura Knee Pads */}
            <rect x="110" y="380" width="55" height="85" rx="10" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="2" />
            <line x1="110" y1="380" x2="165" y2="465" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            <line x1="110" y1="465" x2="165" y2="380" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            <line x1="110" y1="422" x2="165" y2="422" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            <line x1="137.5" y1="380" x2="137.5" y2="465" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            
            <rect x="235" y="380" width="55" height="85" rx="10" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="2" />
            <line x1="235" y1="380" x2="290" y2="465" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            <line x1="235" y1="465" x2="290" y2="380" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            <line x1="235" y1="422" x2="290" y2="422" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
            <line x1="262.5" y1="380" x2="262.5" y2="465" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />

            {/* Bottom Leg High-Vis Stripes */}
            <rect x="107" y="490" width="58" height="15" fill="#fbbf24" opacity="0.9" />
            <rect x="107" y="494" width="58" height="7" fill="#e2e8f0" opacity="0.95" />
            
            <rect x="235" y="490" width="58" height="15" fill="#fbbf24" opacity="0.9" />
            <rect x="235" y="494" width="58" height="7" fill="#e2e8f0" opacity="0.95" />
            
            {/* Bottom Hem stitch patterns */}
            <line x1="105" y1="550" x2="170" y2="550" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="1.5" strokeDasharray="2,2" />
            <line x1="230" y1="550" x2="295" y2="550" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="1.5" strokeDasharray="2,2" />
          </>
        ) : (
          <>
            {/* JACKET SCHEMATIC OUTLINE */}
            <line x1="60" y1="50" x2="60" y2="550" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="3,6" />
            <line x1="340" y1="50" x2="340" y2="550" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" strokeDasharray="3,6" />
            
            <path d="M 145 130 C 145 60, 255 60, 255 130 Z" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2.5" />
            <rect x="120" y="130" width="160" height="290" rx="12" fill="rgba(15, 23, 42, 0.65)" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2.5" />
            <path d="M 120 135 L 55 290 L 85 300 L 120 190 Z" fill="rgba(15, 23, 42, 0.65)" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 280 135 L 345 290 L 315 300 L 280 190 Z" fill="rgba(15, 23, 42, 0.65)" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2" strokeLinejoin="round" />
            
            <path d="M 68 250 L 92 260 M 332 250 L 308 260" stroke="#fbbf24" strokeWidth="4.5" opacity="0.9" />
            <path d="M 120 220 L 280 220 M 120 232 L 280 232" stroke="#fbbf24" strokeWidth="4.5" opacity="0.9" />
            <path d="M 120 340 L 280 340 M 120 352 L 280 352" stroke="#fbbf24" strokeWidth="4.5" opacity="0.9" />
            
            <line x1="200" y1="130" x2="200" y2="420" stroke="rgba(198, 18, 19, 0.7)" strokeWidth="2.5" />
          </>
        )}

        {/* Pulsing Hotspots */}
        {annotations.map((node) => {
          const cx = (node.x / 100) * 400;
          const cy = (node.y / 100) * 600;
          
          return (
            <g key={node.id} className="cursor-pointer group" onClick={() => setActiveHotspot(node)}>
              <circle cx={cx} cy={cy} r="20" className="fill-none stroke-rivix/45 animate-ping opacity-60" strokeWidth="1.5" />
              <circle cx={cx} cy={cy} r="14" className="fill-rivix/10 stroke-rivix/60 group-hover:scale-125 transition-transform duration-350" strokeWidth="2" />
              <circle cx={cx} cy={cy} r="6" className="fill-white stroke-rivix shadow-[0_0_12px_#c61213]" strokeWidth="3" />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-4">
    <Toast toast={toast} onClose={() => setToast(null)} />
    {error && (
      <div role="alert" className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span>{error}</span>
        <button onClick={() => setError('')} className="font-bold text-red-700 hover:text-red-900" aria-label="Dismiss">✕</button>
      </div>
    )}
    {confirmDelete && (
      <Modal onClose={() => setConfirmDelete(null)} busy={deleting} maxWidth="max-w-md">
        <h2 className="text-lg font-black text-slate-900">Delete this request?</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-bold">{confirmDelete.requestCode || confirmDelete.id}</span> · {confirmDelete.productName} ({confirmDelete.clientName}) will be removed together with its photos, AI analysis, approval and messages. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete request'}</button>
        </div>
      </Modal>
    )}
    {archiveOffer && (
      <Modal onClose={() => setArchiveOffer(null)} busy={deleting} maxWidth="max-w-md">
        <h2 className="text-lg font-black text-slate-900">Archive instead?</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-bold">{archiveOffer.requestCode || archiveOffer.id}</span> has an approved tech file or a customer approval, so it cannot be deleted. Archiving keeps everything (photos, revisions, PDFs, approvals) and takes it out of the queue. It can be restored later.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setArchiveOffer(null)} disabled={deleting} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40">Cancel</button>
          <button onClick={() => handleArchive(archiveOffer, true)} disabled={deleting} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60">{deleting ? 'Archiving…' : 'Archive request'}</button>
        </div>
      </Modal>
    )}
    {selectedRep?.archivedAt && (
      <p className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
        <span><span className="font-bold">Archived</span> on {new Date(selectedRep.archivedAt).toLocaleDateString()}. It is not in the queue; everything is kept.</span>
        {isAdmin && <button onClick={() => handleArchive(selectedRep, false)} disabled={deleting} className="font-bold text-rivix hover:underline disabled:opacity-50">Restore to the queue</button>}
      </p>
    )}
    <Link href={basePath} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rivix">← Back to the queue</Link>
    <div className="font-sans">
      
      {/* RIGHT COLUMN: Active Review Panel */}
      <div className="space-y-6">
        {selectedRep ? (
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 space-y-6">
            
            {/* Header: who and what (with the actions), the details, then where it is and what to do next */}
            <div className="space-y-5 border-b border-slate-100 pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-black uppercase tracking-widest text-slate-500">{selectedRep.requestCode || selectedRep.id}</span>
                  <h1 className="mt-2 text-2xl font-bold text-slate-900 lg:text-3xl">{selectedRep.productName}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Client <span className="font-bold text-slate-700">{selectedRep.clientName}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    Submitted {formatDate(selectedRep.submissionDate)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button onClick={handleDownload} disabled={building} className="inline-flex items-center gap-2 rounded-xl bg-rivix px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rivix/30 transition-colors hover:bg-rivix-dark disabled:opacity-60">
                      {building ? <><Loader2 size={15} className="animate-spin" /> Building…</> : <><FileText size={15} /> Download tech file (PDF)</>}
                    </button>
                    <button onClick={() => setConfirmDelete(selectedRep)} title="Delete this request" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Details bar: the three facts people ask about first. Same layout in every column: label, value, note. */}
              <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Sales rep</p>
                  <div className="mt-2 flex h-10 items-center gap-2">
                    {isAdmin ? (
                      <>
                        <select value={pendingRepId ?? (selectedRep.repId || '')} disabled={pendingRepId !== null} onChange={e => changeRep(e.target.value)} aria-label="Sales rep" className="h-10 w-full max-w-[240px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60">
                          <option value="">Admin (handled directly)</option>
                          {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          {selectedRep.repId && !reps.some(r => r.id === selectedRep.repId) && <option value={selectedRep.repId}>{selectedRep.repName || 'Unknown rep'}</option>}
                        </select>
                        {pendingRepId !== null && <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-rivix"><Loader2 size={14} className="animate-spin" /> Saving…</span>}
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-slate-800">{selectedRep.repName || 'You'}</p>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] text-slate-400">{selectedRep.repId ? 'Owns this request and chats with the admin.' : 'The admin handles this request directly.'}</p>
                </div>
                {(() => {
                  const received = !!selectedRep.specs.inboundReceivedAt;
                  const onTheWay = !!selectedRep.clientTrackingNumber;
                  const label = received ? 'Garment received' : onTheWay ? 'Garment on its way' : selectedRep.specs.garmentPosted ? 'Garment expected' : 'Photos only';
                  const cls = received ? 'bg-emerald-100 text-emerald-700' : onTheWay || selectedRep.specs.garmentPosted ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600';
                  const note = received ? 'The garment has arrived at RIVIX.' : onTheWay ? 'The customer has posted it.' : selectedRep.specs.garmentPosted ? 'Log the parcel on the Shipping tab.' : 'No parcel expected.';
                  return (
                    <div className="px-5 py-4 sm:pl-6">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Garment</p>
                      <div className="mt-2 flex h-10 items-center">
                        <span className={`rounded-full px-3 py-1.5 text-[12px] font-black uppercase tracking-wider ${cls}`}>{label}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] text-slate-400">{note}</p>
                    </div>
                  );
                })()}
                <div className="px-5 py-4 sm:pl-6">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tech file</p>
                  <div className="mt-2 flex h-10 items-center">
                    <p className="text-sm font-semibold text-slate-800">
                      {!isAdmin ? (selectedRep.techFile?.status === 'approved' ? `Approved${selectedRep.techFile.revision ? ` (revision ${selectedRep.techFile.revision})` : ''}` : selectedRep.techFile?.status === 'draft' ? 'Draft in progress' : 'Not started') : downloads.length > 0 ? `Downloaded ${downloads.length} time${downloads.length === 1 ? '' : 's'}` : 'Not downloaded yet'}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[12px] text-slate-400">
                    {!isAdmin ? 'The tech file is prepared by RIVIX admin.' : downloads.length > 0 ? `Last by ${downloads[0].by || 'an admin'} on ${new Date(downloads[0].at).toLocaleDateString()}.` : 'Download it once the spec is approved.'}
                  </p>
                </div>
              </div>

              {/* Where this request is, and the one thing to do next */}
              {(() => {
                const steps = [
                  { key: 'received', label: 'Received' },
                  { key: 'spec_mapped', label: 'Mapped' },
                  { key: 'sample_production', label: 'In production' },
                  { key: 'sample_shipped', label: 'Shipped' },
                ];
                const at = Math.max(0, steps.findIndex(x => x.key === selectedRep.status));
                const approvedReview = selectedRep.aiAnalysis?.review?.status === 'approved';
                const repHint = at === 0 && selectedRep.techFile?.status !== 'draft' ? 'Next: add clear photos of the garment. RIVIX admin runs the scan and prepares the tech file.'
                  : at === 0 ? 'RIVIX admin is preparing the tech file. Use the Team chat to talk to the admin.'
                  : at === 1 ? 'Approved by the admin. The admin starts sample production.'
                  : at === 2 ? 'The sample is being made. You are notified when it ships.'
                  : 'The sample has shipped.';
                const next = !isAdmin ? null :
                  at === 0 ? { text: 'Review & approve the spec', hint: 'Check the AI draft against the real garment. Approving moves it to Mapped.', go: () => setActiveTab('review') }
                  : at === 1 && !approvedReview ? { text: 'Re-approve the spec', hint: 'The spec was changed (or never approved). Approve it before production.', go: () => setActiveTab('review') }
                  : at === 1 ? { text: 'Start sample production', hint: 'Marks the sample as being made at the factory.', go: () => { if (window.confirm('Mark this sample as in production?')) handleUpdateStatus('sample_production'); } }
                  : at === 2 ? { text: 'Log the tracking code', hint: 'Shipping the sample sets the request to Shipped.', go: () => setActiveTab('tracking') }
                  : null;
                return (
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Progress">
                      {steps.map((st, n) => {
                        const done = n < at, current = n === at;
                        return (
                          <li key={st.key} className="flex items-center">
                            <span className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
                              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${done ? 'bg-emerald-500 text-white' : current ? 'bg-rivix text-white' : 'bg-slate-200 text-slate-500'}`}>{done ? '\u2713' : n + 1}</span>
                              <span className={`text-[13px] font-bold ${done ? 'text-emerald-700' : current ? 'text-slate-900' : 'text-slate-400'}`}>{st.label}</span>
                            </span>
                            {n < steps.length - 1 && <span className={`mx-3 h-0.5 w-6 rounded sm:w-10 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                          </li>
                        );
                      })}
                    </ol>
                    {!isAdmin ? (
                      <p className="text-[13px] leading-relaxed text-slate-500 xl:max-w-sm xl:text-right">{repHint}</p>
                    ) : next ? (
                      <div className="flex flex-col gap-1.5 xl:items-end">
                        <button onClick={next.go} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800">{next.text} <span aria-hidden="true">{'\u2192'}</span></button>
                        <p className="text-[12px] text-slate-400 xl:max-w-xs xl:text-right">{next.hint}</p>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-emerald-700">Sample shipped {'\u2713'}</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* TAB SELECTORS */}
            <div className="flex border-b border-slate-100 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('specs')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'specs' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Client Spec Review
              </button>
              {isAdmin && (
              <button 
                onClick={() => setActiveTab('ai_analysis')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'ai_analysis' 
                    ? 'border-violet-500 text-violet-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Sparkles size={12} /> AI Garment Analysis
              </button>
              )}
              {isAdmin && (
              <button 
                onClick={() => setActiveTab('review')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'review' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Review &amp; Approve {selectedRep.aiAnalysis?.review?.status === 'approved' ? <span className="text-emerald-600">✓</span> : null}
              </button>
              )}
              <button 
                onClick={() => setActiveTab('tracking')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'tracking' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Shipping
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'chat' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Team chat
                {activeTab !== 'chat' && chat.unread > 0 && (
                  <span aria-label={`${chat.unread} unread message${chat.unread === 1 ? '' : 's'}`} className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-rivix px-1.5 py-0.5 text-[11px] font-black leading-none text-white">{chat.unread > 9 ? '9+' : chat.unread}</span>
                )}
              </button>
            </div>

            {/* REVIEW & APPROVE (kept mounted so unsaved edits survive switching tabs) */}
            {isAdmin && <div className={activeTab === 'review' ? '' : 'hidden'}>
              <SectionErrorBoundary section="Review & approve" requestCode={selectedRep.requestCode} resetKey={selectedRep.id}><ReviewTab key={selectedRep.id} rep={selectedRep} requestTemplate={requestTpl} onSave={async (updated, approve, opts) => { const ok = await persist(updated, approve, opts); if (ok) setToast({ type: 'success', text: approve ? 'Specification approved. The sales rep has been notified.' : 'Changes saved.' }); return ok; }} /></SectionErrorBoundary>
            </div>}

            {/* TAB 1: SPEC REVIEW */}
            {activeTab === 'specs' && (
              <SectionErrorBoundary section="Specification" requestCode={selectedRep.requestCode} resetKey={selectedRep.id}>
                <RenderSection render={() => (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Visual View (7 cols) — client photo or fallback schematic */}
                <div className="lg:col-span-7 bg-slate-950 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden border border-slate-900 shadow-inner min-h-[400px]">
                  {selectedRep.images && selectedRep.images.length > 0 ? (
                    <>
                      <img
                        src={selectedRep.images[0]}
                        alt={`${selectedRep.productName} — client reference photo`}
                        className="w-full h-full max-h-[480px] object-contain rounded-2xl"
                      />
                      {selectedRep.imageLabels?.[0] && <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-amber-300">{selectedRep.imageLabels[0]}</p>}
                      <div className="mt-4 flex w-full gap-2 overflow-x-auto pb-1">
                        {selectedRep.images.map((img, idx) => (
                          <div key={idx} className="group relative shrink-0">
                            <img
                              src={img}
                              alt={idx === 0 ? 'Main reference photo' : `Reference ${idx + 1}`}
                              title={idx === 0 ? 'Main photo' : 'Click to make this the main photo'}
                              className={`h-16 w-16 rounded-lg border-2 object-cover transition-all ${idx === 0 ? 'border-rivix' : 'cursor-pointer border-white/10 hover:border-rivix'}`}
                              onClick={() => {
                                if (idx === 0) return;
                                const move = <T,>(list: T[]) => { const c = [...list]; const [x] = c.splice(idx, 1); c.unshift(x); return c; };
                                persist({ ...selectedRep, images: move(selectedRep.images), imagePaths: move(selectedRep.imagePaths || []), imageLabels: move(selectedRep.imageLabels || []) });
                              }}
                            />
                            {idx === 0 && <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-rivix/90 text-center text-[9px] font-bold uppercase text-white">Main</span>}
                            {selectedRep.imageLabels?.[idx] && <span title={selectedRep.imageLabels[idx]} className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-amber-400 px-1 text-[9px] font-black uppercase text-slate-900">Web</span>}
                            <button
                              type="button"
                              onClick={() => removePhoto(idx)}
                              aria-label={`Remove photo ${idx + 1}`}
                              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white ring-1 ring-white/30 hover:bg-red-600 group-hover:flex"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : productTpl ? (
                    // Gloves, footwear and PPE: no jacket or overall outline; their drawing is on the Review tab.
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <p className="text-sm font-semibold text-white/80">No photo uploaded yet.</p>
                      {isAdmin
                        ? <button type="button" onClick={() => setActiveTab('review')} className="text-xs font-bold text-white underline hover:text-rivix">The {productTpl.family.label.toLowerCase()} drawing is on the Review &amp; Approve tab →</button>
                        : <p className="text-xs text-white/60">Add photos of the {productTpl.family.views.length ? viewsText(productTpl.family.views) : 'product'}.</p>}
                    </div>
                  ) : (
                    <RenderBlueprint garmentType={selectedRep.garmentType} annotations={selectedRep.specs?.annotations ?? []} />
                  )}
                  <div className="mt-4 flex w-full flex-wrap items-center gap-3 text-xs text-white/70">
                    <button
                      type="button"
                      onClick={() => photoInput.current?.click()}
                      disabled={!!photoMsg || (selectedRep.images?.length || 0) >= MAX_PHOTOS}
                      className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                    >+ Add photos</button>
                    <span>{selectedRep.images?.length || 0} of {MAX_PHOTOS} photos{(selectedRep.images?.length || 0) > 1 ? ' · hover a photo to remove it, click to make it the main one' : ''}</span>
                    {photoMsg && <span className="flex items-center gap-1.5 text-white"><Loader2 size={12} className="animate-spin" />{photoMsg}</span>}
                    <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => addPhotos(e.target.files)} />
                  </div>
                  <div className="absolute top-4 left-4 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[8px] font-black uppercase text-white/50 tracking-widest">
                    {selectedRep.images?.length ? 'Client Reference Photo' : productTpl ? 'No Photo Uploaded' : 'Generic Schematic — No Photo Uploaded'}
                  </div>
                </div>

                {/* Annotation inspector (5 cols) */}
                <SpecReviewPanel selectedRep={selectedRep} isAdmin={isAdmin} template={requestTpl.templateProblem ? null : requestTpl.template} activeHotspot={activeHotspot} setActiveHotspot={setActiveHotspot} setActiveTab={setActiveTab} />

              </div>
                )} />
              </SectionErrorBoundary>
            )}

            {/* TAB: AI GARMENT ANALYSIS */}
            {isAdmin && activeTab === 'ai_analysis' && selectedRep && (
              <SectionErrorBoundary section="AI analysis" requestCode={selectedRep.requestCode} resetKey={selectedRep.id}>
                <AnalysisTabView template={requestTpl.templateProblem ? null : requestTpl.template} garmentLibrary={requestTpl.library} selectedRep={selectedRep} getAIAnalysis={getAIAnalysis} isAdmin={isAdmin} building={building} handleDownload={handleDownload} handleStartAIAnalysis={handleStartAIAnalysis} setActiveTab={setActiveTab} setError={setError} setReplications={setReplications} setSelectedRep={setSelectedRep} />
              </SectionErrorBoundary>
            )}

            {/* TAB 2: SHIPPING DISPATCH */}
            {activeTab === 'tracking' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Card: Customer inbound physical tracking */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Client Inbound Tracking</h3>
                      <p className="text-[13px] text-slate-400">The parcel the customer posts to RIVIX with the real garment.</p>
                    </div>
                  </div>

                  {selectedRep.specs.garmentPosted || selectedRep.clientTrackingNumber ? (
                    <InboundParcelCard rep={selectedRep} trackingUrl={getTrackingUrl} onSave={updated => persist(updated)} />
                  ) : (
                    <div className="space-y-3">
                      <p className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-[14px] leading-relaxed text-slate-600"><span className="font-bold text-slate-700">Photos only: no parcel expected.</span> Nothing to do here.</p>
                      <button type="button" onClick={() => persist({ ...selectedRep, specs: { ...selectedRep.specs, garmentPosted: true } })} className="text-[14px] font-bold text-rivix hover:underline">The customer is posting the garment instead</button>
                    </div>
                  )}
                </div>

                {isAdmin && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rivix/10 flex items-center justify-center text-rivix">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Dispatch Reproduced Sample</h3>
                      <p className="text-[13px] text-slate-400">Log return carrier tracking once sample is stitched.</p>
                    </div>
                  </div>

                  {selectedRep.rivixTrackingNumber ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs text-emerald-800">
                        <span className="font-bold uppercase tracking-widest text-[12px]">Status</span>
                        <span className="font-black flex items-center gap-1"><CheckCircle size={12}/> Dispatched</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[12px]">Carrier / Partner</span>
                        <span className="font-black text-slate-700">{selectedRep.rivixTrackingCarrier}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[12px]">Transit Code</span>
                        <a 
                          href={getTrackingUrl(selectedRep.rivixTrackingCarrier, selectedRep.rivixTrackingNumber)}
                          target="_blank" 
                          rel="noreferrer"
                          className="font-mono font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 px-2.5 py-1 rounded-lg text-[14px] flex items-center gap-1 transition-all"
                        >
                          {selectedRep.rivixTrackingNumber} <ExternalLink size={10} />
                        </a>
                      </div>
                      
                      <a 
                        href={getTrackingUrl(selectedRep.rivixTrackingCarrier, selectedRep.rivixTrackingNumber)}
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full bg-rivix text-white font-bold text-xs text-center py-3 rounded-xl hover:bg-rivix-dark transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        Track Outbound Sample <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Carrier</label>
                            <select 
                              value={adminCarrier}
                              onChange={(e) => setAdminCarrier(e.target.value)}
                              className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-2.5 bg-white focus:outline-none focus:border-rivix/50"
                            >
                              <option>DHL Express</option>
                              <option>Canada Post</option>
                              <option>Purolator</option>
                              <option>UPS</option>
                              <option>FedEx</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tracking Code</label>
                            <input 
                              type="text"
                              placeholder="e.g. DHL987123"
                              value={adminTrackingCode}
                              onChange={(e) => setAdminTrackingCode(e.target.value)}
                              className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-2.5 focus:outline-none focus:border-rivix/50"
                            />
                          </div>
                        </div>

                        <button 
                          onClick={handleDispatchSample}
                          disabled={!(selectedRep.status === 'sample_production' && !!adminTrackingCode.trim())}
                          className="w-full bg-rivix text-white py-3 rounded-xl text-xs font-bold hover:bg-rivix-dark hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                        >
                          Dispatch Replicated Sample
                        </button>
                        {selectedRep.status !== 'sample_production' && (
                          <p className="text-[13px] leading-relaxed text-slate-500">
                            {selectedRep.status === 'sample_shipped'
                              ? 'This sample has already been dispatched.'
                              : 'Available once the sample is in production. Approve the spec first, then click “Start sample production” at the top of the page.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                )}
              </div>
            )}

            {/* TAB 3: TEAM CHAT (sales rep and admin only) */}
            {activeTab === 'chat' && <ChatPanel chat={chat} role={role} repName={selectedRep.repName ?? null} />}

          </div>
        ) : loading ? (
          <div className="bg-white rounded-3xl p-20 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center space-y-3" role="status">
            <Loader2 size={32} className="animate-spin text-rivix" />
            <h2 className="text-xl font-bold text-slate-800 mt-4">Loading request…</h2>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-20 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Package size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-4">{error ? 'Could not load this request' : 'Request not found'}</h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              {error ? 'See the message above, then refresh the page.' : 'It may have been deleted. Go back to the queue to pick another one.'}
            </p>
            <Link href={basePath} className="mt-2 bg-rivix text-white px-5 py-2 rounded-xl font-bold text-xs shadow-lg shadow-rivix/30 hover:bg-rivix-dark transition-all">← Back to the queue</Link>
          </div>
        )}
      </div>

    </div>
    </div>
  );
}
