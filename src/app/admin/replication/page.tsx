'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  getReplications, 
  saveReplication, 
  ReplicationRequest,
  ReplicationSpec
} from '@/lib/replicationStorage';
import { 
  ShieldCheck, 
  Package, 
  Truck, 
  Send, 
  CheckCircle,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  FileText,
  AlertCircle,
  TrendingUp,
  Cpu,
  ScanLine,
  Zap,
  Eye,
  Layers,
  Target,
  Activity,
  Sparkles,
  Camera,
  Check,
  Sliders,
  BookOpen
} from 'lucide-react';

// AI Analysis Types
interface AIDetectedComponent {
  id: string;
  type: 'zipper' | 'snap' | 'button' | 'seam' | 'pocket' | 'reflective' | 'fabric' | 'collar' | 'cuff' | 'knee_pad' | 'hood' | 'vent' | 'drawcord' | 'closure' | 'reinforcement';
  label: string;
  confidence: number;
  location: string;
  details?: string;
  x: number;
  y: number;
}

interface AIMeasurement {
  pom: string;
  description: string;
  xs: string;
  s: string;
  m: string;
  l: string;
  xl: string;
  tolerance: string;
}

interface AIConstruction {
  location: string;
  seamType: string;
  stitchType: string;
  spiTop: number;
  spiBottom: number;
  seamAllowance: string;
  notes: string;
}

interface AIStitchRef {
  code: string;
  name: string;
  machineType: string;
  defaultSpi: number;
  usage: string;
}

interface AILabelPlacement {
  type: string;
  location: string;
  attachment: string;
  dimensions: string;
  material: string;
}

interface AIColorway {
  bodyColor: string;
  contrastColors: string[];
  threadColor: string;
  hardwareFinish: string;
  reflectiveTape: string;
}

interface AIWashCare {
  instructions: string[];
  specialNotes: string;
}

interface AIBOM {
  hardware: string[];
  thread: string[];
  labels: string[];
  packaging: {
    foldDescription: string;
    polybagSize: string;
    cartonSize: string;
    hangtagSpec?: string;
  };
}

interface AIAnalysisResult {
  status: 'idle' | 'scanning' | 'complete';
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  progress: number;
  components: AIDetectedComponent[];
  detectedSoFar: AIDetectedComponent[]; // progressively revealed during scan
  fabricAnalysis: {
    material: string;
    weight: string;
    weaveType: string;
    frRating: string;
    finish?: string;
    shrinkage?: string;
    confidence: number;
  } | null;
  wireframeGenerated: boolean;
  garmentClass: string | null;
  overallConfidence: number | null;
  season: string | null;
  measurements: AIMeasurement[];
  bom: AIBOM | null;
  construction: AIConstruction[];
  stitchReference: AIStitchRef[];
  labelPlacements: AILabelPlacement[];
  colorway: AIColorway | null;
  washCare: AIWashCare | null;
}

const AI_SCAN_STEPS = [
  { label: 'Initializing Computer Vision Model...', duration: 800 },
  { label: 'Analyzing Fabric Texture & Weave Pattern...', duration: 1400 },
  { label: 'Detecting Hardware Components (Snaps, Zippers, Buttons)...', duration: 1800 },
  { label: 'Mapping Seam Construction & Stitch Patterns...', duration: 1500 },
  { label: 'Identifying Safety Compliance Markers...', duration: 1200 },
  { label: 'Extracting Reflective Striping Geometry...', duration: 1000 },
  { label: 'Generating Technical CAD Wireframe...', duration: 2000 },
  { label: 'Cross-referencing NFPA 2112 / CSA Z96 Standards...', duration: 900 },
];

export default function AdminReplicationPage() {
  const [replications, setReplications] = useState<ReplicationRequest[]>([]);
  const [selectedRep, setSelectedRep] = useState<ReplicationRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'specs' | 'ai_analysis' | 'tracking' | 'chat'>('specs');

  // Shipping Dispatch Form States
  const [adminCarrier, setAdminCarrier] = useState('DHL Express');
  const [adminTrackingCode, setAdminTrackingCode] = useState('');

  // Chat Form States
  const [chatMessage, setChatMessage] = useState('');

  // Hotspot State
  const [activeHotspot, setActiveHotspot] = useState<{ id: string; title: string; description: string } | null>(null);

  // Production Factory Dispatch State
  const [dispatchedTix, setDispatchedTix] = useState<{ [key: string]: boolean }>({});
  const [dispatching, setDispatching] = useState(false);

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<{ [repId: string]: AIAnalysisResult }>({});

  const getAIAnalysis = (repId: string): AIAnalysisResult => {
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
              stepLabel: AI_SCAN_STEPS[nextStep]?.label || 'Analyzing...',
              progress: Math.min(current.progress + 15, 85),
            }
          };
        });
      }, 1500);

      // Call our Next.js API route
      const response = await fetch('/api/analyze-garment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesToAnalyze }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze garment');
      }

      const data = await response.json();
      const aiData = data.analysis;

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

    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      alert("Failed to analyze garment: " + err.message);
      // Revert state
      setAiAnalysis(prev => ({
        ...prev,
        [repId]: {
          ...prev[repId],
          status: 'idle',
          stepLabel: 'Failed',
        }
      }));
    }
  }, [replications]);

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
      const stored = await getReplications();
      setReplications(stored);
      if (stored.length > 0 && !selectedRep) {
        setSelectedRep(stored[0]);
      }
    };
    loadData();
  }, [selectedRep]);

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
    
    await saveReplication(updated);
    setSelectedRep(updated);
    
    // Reload queue
    const stored = await getReplications();
    setReplications(stored);
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

    await saveReplication(updated);
    setSelectedRep(updated);
    setAdminTrackingCode('');

    // Reload queue
    const stored = await getReplications();
    setReplications(stored);
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

    await saveReplication(updated);
    setSelectedRep(updated);
    setChatMessage('');
  };

  const handleUsePresetMessage = (preset: string) => {
    setChatMessage(preset);
  };

  const getTrackingUrl = (carrier?: string, trackingNum?: string) => {
    if (!carrier || !trackingNum) return '#';
    const num = trackingNum.trim();
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 font-sans">
      
      {/* LEFT COLUMN: Queue of Client Replications */}
      <div className="xl:col-span-4 space-y-6">
        
        {/* Status Metrics widget */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Replications</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900">{replications.length}</span>
              <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5"><TrendingUp size={10}/> +12%</span>
            </div>
          </div>
          <div className="space-y-1 border-l border-slate-100 pl-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Awaiting Dispatch</span>
            <span className="text-2xl font-black text-rivix">
              {replications.filter(r => r.status === 'sample_production' || r.status === 'spec_mapped').length}
            </span>
          </div>
        </div>

        {/* Active Client Replications Queue */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Replication Inbox</h2>
          <p className="text-[11px] text-slate-400">Review incoming client garments, compile spec blueprints, and log dispatch codes.</p>
          
          <div className="space-y-3">
            {replications.map(rep => {
              const isActive = selectedRep?.id === rep.id;
              
              return (
                <div 
                  key={rep.id}
                  onClick={() => { setSelectedRep(rep); setActiveHotspot(null); }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 group ${
                    isActive 
                      ? 'border-rivix bg-rivix/5 shadow-sm' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{rep.productName}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{rep.clientName}</p>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      rep.status === 'sample_shipped' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : rep.status === 'sample_production'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {rep.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-slate-100/50 pt-2.5 text-[9px] text-slate-400 font-bold">
                    <span>SUBMITTED: {rep.submissionDate}</span>
                    <span className="text-rivix flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Inspect Specs <ChevronRight size={10} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Active Review Panel */}
      <div className="xl:col-span-8 space-y-6">
        {selectedRep ? (
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 space-y-6">
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{selectedRep.id}</span>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 mt-2">{selectedRep.productName}</h1>
                <p className="text-xs text-slate-500 mt-1">Client: <span className="font-bold text-slate-700">{selectedRep.clientName}</span></p>
              </div>

              {/* Status Update Quick Trigger */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update State:</span>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[10px] font-black uppercase tracking-widest bg-white">
                  {[
                    { label: 'Mapped', val: 'spec_mapped' },
                    { label: 'Factory', val: 'sample_production' }
                  ].map(btn => (
                    <button
                      key={btn.val}
                      onClick={() => handleUpdateStatus(btn.val as any)}
                      className={`px-3 py-2.5 border-r border-slate-200 last:border-0 hover:bg-slate-50 transition-colors ${
                        selectedRep.status === btn.val ? 'bg-rivix/10 text-rivix' : 'text-slate-500'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
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
              <button 
                onClick={() => setActiveTab('tracking')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'tracking' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Sample Shipping Dispatch
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'chat' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Client Correspondence Chat
              </button>
            </div>

            {/* TAB 1: SPEC REVIEW */}
            {activeTab === 'specs' && (
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
                      {selectedRep.images.length > 1 && (
                        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                          {selectedRep.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Reference ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border-2 border-white/10 hover:border-rivix cursor-pointer transition-all shrink-0"
                              onClick={() => {
                                const updated = [...selectedRep.images];
                                const [clicked] = updated.splice(idx, 1);
                                updated.unshift(clicked);
                                const updatedRep = { ...selectedRep, images: updated };
                                saveReplication(updatedRep);
                                setReplications(prev => prev.map(r => r.id === updatedRep.id ? updatedRep : r));
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <RenderBlueprint garmentType={selectedRep.garmentType} annotations={selectedRep.specs.annotations} />
                  )}
                  <div className="absolute top-4 left-4 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[8px] font-black uppercase text-white/50 tracking-widest">
                    {selectedRep.images?.length ? 'Client Reference Photo' : 'Generic Schematic — No Photo Uploaded'}
                  </div>
                </div>

                {/* Annotation inspector (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {activeHotspot ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative text-white">
                      <button 
                        onClick={() => setActiveHotspot(null)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-white font-bold text-xs"
                      >
                        ✕
                      </button>
                      <span className="text-[8px] font-black uppercase tracking-widest text-rivix bg-rivix/20 px-2.5 py-1 rounded-full inline-block">Hotspot Coordinates</span>
                      <h4 className="text-sm font-bold mt-1 text-white">{activeHotspot.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{activeHotspot.description}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-start gap-3">
                      <Cpu size={18} className="text-rivix shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Physical Spec Review</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Verify details such as safety ratings and structural seams against the physical garment that the client has sent.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Material checklist Table */}
                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest text-slate-500">Apparel Specs</h3>
                    </div>
                    
                    <div className="divide-y divide-slate-100 text-xs p-5 space-y-4">
                      {[
                        { label: 'Safety Compliance', value: selectedRep.specs.safetyRating },
                        { label: 'Base Weave', value: selectedRep.specs.coreMaterial },
                        { label: 'Fabric Weight', value: selectedRep.specs.fabricWeight },
                        { label: 'Hardware Snap', value: selectedRep.specs.buttonsSnaps },
                        { label: 'Reflective layout', value: selectedRep.specs.reflectiveStriping },
                        { label: 'Zippers', value: selectedRep.specs.zippers }
                      ].map(row => (
                        <div key={row.label} className="grid grid-cols-2 gap-1 pt-3 first:pt-0">
                          <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">{row.label}</span>
                          <span className="font-semibold text-slate-700">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RIVIX Production Factory Dispatch Button */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-4 shadow-inner">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Package size={12} className="text-rivix" /> Production Factory Integration
                    </h4>
                    
                    {dispatchedTix[selectedRep.id] ? (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl space-y-2">
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                          ✓ Transmitted to Factory
                        </p>
                        <p className="text-[10px] text-emerald-600 leading-relaxed font-semibold">
                          CAD Vector Blueprint Pack, seam reinforcement specifications, and NFPA 2112 certification logs have been securely packaged and transmitted to the RIVIX apparel manufacturing team.
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={handleDispatchToFactory}
                        disabled={dispatching}
                        className="w-full bg-slate-900 text-white font-bold text-xs py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {dispatching ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Packaging CAD Specifications...
                          </>
                        ) : (
                          <>
                            Forward CAD Wireframe to Production Factory <ChevronRight size={12} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB: AI GARMENT ANALYSIS */}
            {activeTab === 'ai_analysis' && selectedRep && (() => {
              const analysis = getAIAnalysis(selectedRep.id);
              const componentTypeIcon = (type: string) => {
                switch(type) {
                  case 'zipper': return '⚡';
                  case 'snap': return '🔘';
                  case 'button': return '⏺';
                  case 'seam': return '🧵';
                  case 'pocket': return '👝';
                  case 'reflective': return '✨';
                  case 'fabric': return '🧶';
                  case 'collar': return '👔';
                  case 'cuff': return '🔗';
                  case 'knee_pad': return '🦿';
                  default: return '📍';
                }
              };
              const componentTypeColor = (type: string) => {
                switch(type) {
                  case 'zipper': return 'bg-amber-100 text-amber-700 border-amber-200';
                  case 'snap': return 'bg-sky-100 text-sky-700 border-sky-200';
                  case 'button': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
                  case 'seam': return 'bg-rose-100 text-rose-700 border-rose-200';
                  case 'pocket': return 'bg-teal-100 text-teal-700 border-teal-200';
                  case 'reflective': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                  case 'fabric': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  case 'collar': return 'bg-purple-100 text-purple-700 border-purple-200';
                  case 'cuff': return 'bg-orange-100 text-orange-700 border-orange-200';
                  case 'knee_pad': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
                  default: return 'bg-slate-100 text-slate-700 border-slate-200';
                }
              };

              return (
                <div className="space-y-6">
                  {/* AI Analysis Header */}
                  <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-purple-50 border border-violet-100 rounded-3xl p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl shrink-0">
                          <ScanLine size={24} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">AI-Powered Garment Analysis Engine</h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-lg">
                            Computer vision analyzes client-uploaded reference photos to automatically detect hardware components (snaps, zippers, buttons), map seam construction patterns, identify fabric composition, and generate a production-ready CAD wireframe.
                          </p>
                        </div>
                      </div>
                      {analysis.status === 'idle' && (
                        <button
                          onClick={() => handleStartAIAnalysis(selectedRep.id, selectedRep.garmentType)}
                          className="bg-violet-600 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-2 shrink-0 active:scale-95 shadow-lg shadow-violet-200"
                        >
                          <Zap size={14} /> Run AI Scan
                        </button>
                      )}
                      {analysis.status === 'complete' && (
                        <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0">
                          <CheckCircle size={14} /> Analysis Complete
                        </div>
                      )}
                    </div>

                    {/* Scanning Progress — Visual Garment Scan */}
                    {analysis.status === 'scanning' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Live Scan Visual (7 cols) — garment silhouette with sweep line + bounding boxes */}
                        <div className="lg:col-span-7 bg-slate-950 rounded-3xl p-6 relative overflow-hidden border border-slate-800 shadow-inner min-h-[420px] flex flex-col items-center justify-center">
                          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                            <div className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black text-violet-300 uppercase tracking-widest">Live Scan</span>
                          </div>
                          <div className="absolute top-4 right-4 text-[9px] font-black text-emerald-300 uppercase tracking-widest bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 z-10">
                            {analysis.detectedSoFar.length} components found
                          </div>

                          {/* Garment silhouette with scan overlay */}
                          <svg viewBox="0 0 400 600" className="w-full h-full max-h-[380px] select-none">
                            <defs>
                              <pattern id="scan-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="1"/>
                              </pattern>
                              <linearGradient id="scanLineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(139,92,246,0)" />
                                <stop offset="40%" stopColor="rgba(139,92,246,0.6)" />
                                <stop offset="50%" stopColor="rgba(167,139,250,1)" />
                                <stop offset="60%" stopColor="rgba(139,92,246,0.6)" />
                                <stop offset="100%" stopColor="rgba(139,92,246,0)" />
                              </linearGradient>
                            </defs>

                            <rect width="100%" height="100%" fill="url(#scan-grid)" rx="24" />

                            {/* Dim garment outline (pre-scan state) */}
                            {selectedRep.garmentType === 'overalls' ? (
                              <>
                                <rect x="135" y="65" width="20" height="75" rx="3" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5" />
                                <rect x="245" y="65" width="20" height="75" rx="3" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5" />
                                <path d="M 120 135 L 280 135 L 295 240 L 305 240 L 295 560 L 230 560 L 215 330 L 185 330 L 170 560 L 105 560 L 95 240 L 105 240 Z"
                                  fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4,4" />
                              </>
                            ) : (
                              <>
                                <path d="M 145 130 C 145 60, 255 60, 255 130 Z" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5" />
                                <rect x="120" y="130" width="160" height="290" rx="12" fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeDasharray="4,4" />
                                <path d="M 120 135 L 55 290 L 85 300 L 120 190 Z" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeDasharray="4,4" />
                                <path d="M 280 135 L 345 290 L 315 300 L 280 190 Z" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" strokeDasharray="4,4" />
                              </>
                            )}

                            {/* Scanning sweep line — moves top to bottom */}
                            <rect x="70" y="0" width="260" height="40" fill="url(#scanLineGrad)" opacity="0.8">
                              <animate attributeName="y" values="0;580;0" dur="3s" repeatCount="indefinite" />
                            </rect>

                            {/* Horizontal scan lines left/right of sweep */}
                            <line x1="60" y1="0" x2="60" y2="600" stroke="rgba(139,92,246,0.15)" strokeWidth="1">
                              <animate attributeName="y1" values="0;580;0" dur="3s" repeatCount="indefinite" />
                              <animate attributeName="y2" values="40;600;40" dur="3s" repeatCount="indefinite" />
                            </line>
                            <line x1="340" y1="0" x2="340" y2="600" stroke="rgba(139,92,246,0.15)" strokeWidth="1">
                              <animate attributeName="y1" values="0;580;0" dur="3s" repeatCount="indefinite" />
                              <animate attributeName="y2" values="40;600;40" dur="3s" repeatCount="indefinite" />
                            </line>

                            {/* Progressively revealed detection bounding boxes */}
                            {analysis.detectedSoFar.map((comp, i) => {
                              const cx = (comp.x / 100) * 400;
                              const cy = (comp.y / 100) * 600;
                              const boxW = comp.type === 'seam' ? 80 : comp.type === 'reflective' ? 120 : comp.type === 'fabric' ? 70 : 50;
                              const boxH = comp.type === 'seam' ? 60 : comp.type === 'knee_pad' ? 70 : comp.type === 'reflective' ? 25 : 40;
                              const boxColor = comp.type === 'zipper' ? 'rgba(245,158,11,0.7)' 
                                : comp.type === 'snap' || comp.type === 'button' ? 'rgba(99,102,241,0.7)'
                                : comp.type === 'seam' ? 'rgba(244,63,94,0.6)'
                                : comp.type === 'pocket' ? 'rgba(20,184,166,0.7)'
                                : comp.type === 'reflective' ? 'rgba(250,204,21,0.7)'
                                : comp.type === 'knee_pad' ? 'rgba(6,182,212,0.7)'
                                : 'rgba(139,92,246,0.7)';
                              const fillColor = boxColor.replace(/[\d.]+\)$/, '0.08)');

                              return (
                                <g key={comp.id} className="animate-[fadeIn_0.5s_ease-out]">
                                  {/* Bounding box */}
                                  <rect 
                                    x={cx - boxW/2} y={cy - boxH/2} 
                                    width={boxW} height={boxH} 
                                    rx="4" 
                                    fill={fillColor}
                                    stroke={boxColor}
                                    strokeWidth="1.5"
                                    strokeDasharray="3,2"
                                  />
                                  {/* Corner brackets */}
                                  <path d={`M ${cx-boxW/2} ${cy-boxH/2+8} L ${cx-boxW/2} ${cy-boxH/2} L ${cx-boxW/2+8} ${cy-boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  <path d={`M ${cx+boxW/2} ${cy-boxH/2+8} L ${cx+boxW/2} ${cy-boxH/2} L ${cx+boxW/2-8} ${cy-boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  <path d={`M ${cx-boxW/2} ${cy+boxH/2-8} L ${cx-boxW/2} ${cy+boxH/2} L ${cx-boxW/2+8} ${cy+boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  <path d={`M ${cx+boxW/2} ${cy+boxH/2-8} L ${cx+boxW/2} ${cy+boxH/2} L ${cx+boxW/2-8} ${cy+boxH/2}`} fill="none" stroke={boxColor} strokeWidth="2" />
                                  {/* Label */}
                                  <rect x={cx - boxW/2} y={cy - boxH/2 - 16} width={Math.min(comp.label.length * 5.5 + 20, 140)} height="14" rx="3" fill="rgba(15,23,42,0.85)" />
                                  <text x={cx - boxW/2 + 4} y={cy - boxH/2 - 6} fill={boxColor} fontSize="7" fontFamily="monospace" fontWeight="bold">
                                    {comp.label.substring(0, 22)}
                                  </text>
                                  {/* Confidence badge */}
                                  <rect x={cx + boxW/2 - 28} y={cy - boxH/2 - 16} width="28" height="14" rx="3" fill="rgba(16,185,129,0.9)" />
                                  <text x={cx + boxW/2 - 24} y={cy - boxH/2 - 6} fill="white" fontSize="7" fontFamily="monospace" fontWeight="bold">
                                    {comp.confidence}%
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Right panel — live detection feed (5 cols) */}
                        <div className="lg:col-span-5 space-y-4">
                          {/* Progress */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-violet-100 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-violet-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-violet-700">Processing...</span>
                              </div>
                              <span className="text-xs font-black text-violet-600">{analysis.progress}%</span>
                            </div>
                            <div className="w-full bg-violet-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${analysis.progress}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity size={12} className="text-violet-500 animate-pulse" />
                              <span className="text-[11px] text-violet-600 font-semibold">{analysis.stepLabel}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              {AI_SCAN_STEPS.map((_, idx) => (
                                <div key={idx} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                  idx < analysis.currentStep ? 'bg-violet-500' : idx === analysis.currentStep ? 'bg-violet-300 animate-pulse' : 'bg-violet-100'
                                }`} />
                              ))}
                            </div>
                          </div>

                          {/* Live detection feed — components appearing as found */}
                          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-violet-50 px-5 py-3 border-b border-violet-100 flex items-center justify-between">
                              <h3 className="text-[10px] font-black text-violet-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Target size={12} /> Live Detection Feed
                              </h3>
                              <span className="text-[9px] font-bold text-violet-500 animate-pulse">Scanning...</span>
                            </div>
                            <div className="max-h-[280px] overflow-y-auto">
                              {analysis.detectedSoFar.length === 0 ? (
                                <div className="p-8 text-center">
                                  <ScanLine size={24} className="text-violet-300 mx-auto animate-pulse" />
                                  <p className="text-[10px] text-slate-400 mt-2 font-semibold">Waiting for detections...</p>
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-50">
                                  {analysis.detectedSoFar.map((comp) => (
                                    <div key={comp.id} className="px-4 py-3 flex items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
                                      <span className="text-sm">{componentTypeIcon(comp.type)}</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-800 block truncate">{comp.label}</span>
                                        <span className="text-[9px] text-slate-400 truncate block">{comp.location}</span>
                                      </div>
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${componentTypeColor(comp.type)}`}>
                                        {comp.type.replace('_', ' ')}
                                      </span>
                                      <span className="text-[9px] font-black text-emerald-600">{comp.confidence}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Results Grid — only show when analysis is complete */}
                  {analysis.status === 'complete' && (
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
                      {/* Tech Pack Header */}
                      <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-xl font-black tracking-tight text-white">TECH PACK: AI-EXTRAPOLATED</h2>
                            <span className="bg-violet-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-widest text-violet-300 border border-violet-500/30 flex items-center gap-1.5">
                              <Sparkles size={10} /> AI Inferred Spec
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-3 mt-5 text-xs">
                            <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Brand</span> <span className="font-semibold text-slate-200">{selectedRep.clientName}</span></div>
                            <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Style</span> <span className="font-semibold text-slate-200">{selectedRep.garmentType.toUpperCase()}</span></div>
                            <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Date</span> <span className="font-semibold text-slate-200">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                            <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Size Range</span> <span className="font-semibold text-slate-200">XS - XL [SAMPLE: M]</span></div>
                            {analysis.season && <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Season</span> <span className="font-semibold text-slate-200">{analysis.season}</span></div>}
                          </div>
                        </div>
                        <button
                          onClick={handleDispatchToFactory}
                          disabled={dispatching || dispatchedTix[selectedRep.id]}
                          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs px-6 py-3 rounded-lg flex items-center gap-2.5 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
                        >
                          {dispatching ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> PACKAGING...</>
                          ) : dispatchedTix[selectedRep.id] ? (
                            <><Check size={14} /> ✓ TRANSMITTED</>
                          ) : (
                            <><Package size={14} /> EXPORT TECH PACK PDF</>
                          )}
                        </button>
                      </div>

                      {/* Tech Pack Body - Two Columns */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-50">
                        {/* Left: Technical Flat Sketch & POM Callouts */}
                        <div className="lg:col-span-5 bg-white p-6 lg:p-8 border-r border-slate-200 flex flex-col">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-6 flex items-center justify-between">
                            1. TECHNICAL FLAT SKETCH — FRONT / BACK
                            <span className="text-[9px] text-slate-400">RIVIX TECH PACK</span>
                          </h3>

                          <div className="relative w-full bg-white border border-slate-300 rounded-sm overflow-hidden flex flex-col shadow-sm">
                            {/* Title Block */}
                            <div className="bg-slate-50 border-b border-slate-300 px-4 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">STYLE: {analysis.garmentClass?.toUpperCase() || selectedRep.garmentType.toUpperCase()}</span>
                                <span className="text-[8px] text-slate-400">|</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">SAMPLE SIZE: M</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {analysis.overallConfidence || 95}% CONFIDENCE
                                </span>
                              </div>
                            </div>

                            {/* SVG Flat Sketch */}
                            <svg viewBox="0 0 700 520" className="w-full select-none" style={{ background: '#fff' }}>
                              {/* Grid */}
                              <defs>
                                <pattern id="tp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                                </pattern>
                              </defs>
                              <rect width="700" height="520" fill="url(#tp-grid)" />

                              {/* Labels */}
                              <text x="175" y="22" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="2">FRONT VIEW</text>
                              <text x="525" y="22" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="2">BACK VIEW</text>

                              {(() => {
                                // AI classification takes priority over client-submitted garmentType
                                const aiClass = (analysis.garmentClass || '').toLowerCase();
                                const isOveralls = aiClass.includes('overall') || aiClass.includes('coverall') ||
                                  (!aiClass && selectedRep.garmentType === 'overalls');
                                const isPants = aiClass.includes('pant') || aiClass.includes('trouser') ||
                                  (!aiClass && selectedRep.garmentType === 'pants');
                                const isVest = aiClass.includes('vest') || aiClass.includes('gilet') ||
                                  (!aiClass && selectedRep.garmentType === 'vest');

                                if (isOveralls) {
                                  return (
                                    <>
                                      {/* ========== FRONT OVERALLS ========== */}
                                      <g transform="translate(175, 270)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        {/* Shoulder straps */}
                                        <path d="M -30,-210 L -25,-145" />
                                        <path d="M -20,-210 L -15,-145" />
                                        <path d="M 30,-210 L 25,-145" />
                                        <path d="M 20,-210 L 15,-145" />
                                        {/* Buckles */}
                                        <rect x="-34" y="-215" width="18" height="10" rx="2" strokeWidth="1.2" />
                                        <rect x="16" y="-215" width="18" height="10" rx="2" strokeWidth="1.2" />
                                        <line x1="-34" y1="-210" x2="-16" y2="-210" strokeWidth="0.8" />
                                        <line x1="16" y1="-210" x2="34" y2="-210" strokeWidth="0.8" />
                                        {/* Bib */}
                                        <path d="M -50,-145 L 50,-145 L 55,-70 L -55,-70 Z" />
                                        {/* Bib pocket */}
                                        <rect x="-30" y="-130" width="25" height="25" rx="2" strokeWidth="1" />
                                        <rect x="5" y="-130" width="25" height="25" rx="2" strokeWidth="1" />
                                        {/* Center front zip */}
                                        <line x1="0" y1="-145" x2="0" y2="80" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2" />
                                        {/* Waist */}
                                        <path d="M -75,-70 L 75,-70" strokeWidth="1.5" />
                                        {/* Main body */}
                                        <path d="M -75,-70 L -80,80 L -65,220 L -15,220 L -8,80 L 8,80 L 15,220 L 65,220 L 80,80 L 75,-70" />
                                        {/* Cargo pockets */}
                                        <rect x="-72" y="-20" width="35" height="40" rx="3" strokeWidth="1" />
                                        <path d="M -72,-20 L -37,-20 L -40,-12 L -69,-12 Z" strokeWidth="0.8" />
                                        <rect x="37" y="-20" width="35" height="40" rx="3" strokeWidth="1" />
                                        <path d="M 37,-20 L 72,-20 L 69,-12 L 40,-12 Z" strokeWidth="0.8" />
                                        {/* Knee pad areas */}
                                        <rect x="-62" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                        <rect x="20" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                        <text x="-41" y="142" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="Arial">KNEE PAD</text>
                                        <text x="41" y="142" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="Arial">KNEE PAD</text>
                                        {/* Hi-vis bands */}
                                        <rect x="-78" y="-55" width="156" height="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="-63" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="18" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        {/* Inner leg seam */}
                                        <line x1="-8" y1="80" x2="-15" y2="220" strokeWidth="0.6" strokeDasharray="2,3" stroke="#94a3b8" />
                                        <line x1="8" y1="80" x2="15" y2="220" strokeWidth="0.6" strokeDasharray="2,3" stroke="#94a3b8" />
                                      </g>

                                      {/* ========== BACK OVERALLS ========== */}
                                      <g transform="translate(525, 270)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        {/* Shoulder straps */}
                                        <path d="M -30,-210 L -25,-145" />
                                        <path d="M -20,-210 L -15,-145" />
                                        <path d="M 30,-210 L 25,-145" />
                                        <path d="M 20,-210 L 15,-145" />
                                        {/* Cross straps */}
                                        <path d="M -25,-185 L 25,-165" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2" />
                                        <path d="M 25,-185 L -25,-165" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2" />
                                        {/* Back panel */}
                                        <path d="M -50,-145 L 50,-145 L 55,-70 L -55,-70 Z" />
                                        {/* CB seam */}
                                        <line x1="0" y1="-145" x2="0" y2="-70" strokeWidth="0.6" strokeDasharray="2,3" stroke="#94a3b8" />
                                        {/* Waist */}
                                        <path d="M -75,-70 L 75,-70" strokeWidth="1.5" />
                                        {/* Main body */}
                                        <path d="M -75,-70 L -80,80 L -65,220 L -15,220 L -8,80 L 8,80 L 15,220 L 65,220 L 80,80 L 75,-70" />
                                        {/* Back pockets */}
                                        <rect x="-55" y="-55" width="30" height="28" rx="2" strokeWidth="1" />
                                        <rect x="25" y="-55" width="30" height="28" rx="2" strokeWidth="1" />
                                        {/* Hi-vis bands */}
                                        <rect x="-78" y="-55" width="156" height="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="-63" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        <rect x="18" y="185" width="45" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" opacity="0.7" />
                                        {/* Knee pads */}
                                        <rect x="-62" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                        <rect x="20" y="110" width="42" height="55" rx="6" strokeWidth="1" strokeDasharray="4,2" />
                                      </g>
                                    </>
                                  );
                                }

                                if (isPants) {
                                  return (
                                    <>
                                      {/* ========== FRONT PANTS ========== */}
                                      <g transform="translate(175, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        {/* Waistband */}
                                        <path d="M -65,-200 L 65,-200 L 68,-185 L -68,-185 Z" />
                                        <line x1="0" y1="-200" x2="0" y2="-185" strokeWidth="0.8" />
                                        {/* Belt loops */}
                                        {[-50, -25, 25, 50].map(x => <rect key={x} x={x-3} y={-205} width="6" height="22" rx="1" strokeWidth="0.8" />)}
                                        {/* Fly */}
                                        <path d="M 0,-185 C 5,-140 5,-130 0,-120" strokeWidth="1.2" />
                                        {/* Main body */}
                                        <path d="M -68,-185 L -72,30 L -55,220 L -10,220 L -5,30 L 5,30 L 10,220 L 55,220 L 72,30 L 68,-185" />
                                        {/* Front pockets */}
                                        <path d="M -68,-175 C -55,-165 -40,-185 -30,-185" strokeWidth="1" />
                                        <path d="M 68,-175 C 55,-165 40,-185 30,-185" strokeWidth="1" />
                                        {/* Crease lines */}
                                        <line x1="-32" y1="-100" x2="-32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                        <line x1="32" y1="-100" x2="32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                      </g>

                                      {/* ========== BACK PANTS ========== */}
                                      <g transform="translate(525, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        <path d="M -65,-200 L 65,-200 L 68,-185 L -68,-185 Z" />
                                        <line x1="0" y1="-200" x2="0" y2="-185" strokeWidth="0.8" />
                                        {[-50, -25, 25, 50].map(x => <rect key={x} x={x-3} y={-205} width="6" height="22" rx="1" strokeWidth="0.8" />)}
                                        {/* CB seam */}
                                        <path d="M 0,-185 L 0,-120" strokeWidth="0.8" strokeDasharray="2,3" stroke="#94a3b8" />
                                        <path d="M -68,-185 L -72,30 L -55,220 L -10,220 L -5,30 L 5,30 L 10,220 L 55,220 L 72,30 L 68,-185" />
                                        {/* Back yoke */}
                                        <path d="M -68,-170 C -20,-155 20,-155 68,-170" strokeWidth="1" strokeDasharray="3,2" />
                                        {/* Back pockets */}
                                        <rect x="-48" y="-130" width="28" height="30" rx="2" strokeWidth="1" />
                                        <rect x="20" y="-130" width="28" height="30" rx="2" strokeWidth="1" />
                                        <line x1="-32" y1="-100" x2="-32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                        <line x1="32" y1="-100" x2="32" y2="210" strokeWidth="0.5" strokeDasharray="6,4" stroke="#cbd5e1" />
                                      </g>
                                    </>
                                  );
                                }

                                if (isVest) {
                                  return (
                                    <>
                                      {/* ========== FRONT VEST ========== */}
                                      <g transform="translate(175, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                        <path d="M -25,-205 C -30,-195 -35,-195 -40,-200 L -30,-210 Z" strokeWidth="1.2" />
                                        <path d="M 25,-205 C 30,-195 35,-195 40,-200 L 30,-210 Z" strokeWidth="1.2" />
                                        <line x1="-40" y1="-200" x2="-70" y2="-185" strokeWidth="1.8" />
                                        <line x1="40" y1="-200" x2="70" y2="-185" strokeWidth="1.8" />
                                        <path d="M -55,-185 L -55,105 L 55,105 L 55,-185" />
                                        <path d="M -70,-185 L -55,-185" strokeWidth="1.2" />
                                        <path d="M 70,-185 L 55,-185" strokeWidth="1.2" />
                                        {/* Armholes */}
                                        <path d="M -70,-185 C -70,-120 -55,-105 -55,-105" strokeWidth="1.2" />
                                        <path d="M 70,-185 C 70,-120 55,-105 55,-105" strokeWidth="1.2" />
                                        <line x1="0" y1="-205" x2="0" y2="105" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2" />
                                        <rect x="-3" y="-195" width="6" height="8" rx="1" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
                                        <rect x="-45" y="-155" width="30" height="30" rx="2" strokeWidth="1" />
                                        <rect x="15" y="-155" width="30" height="30" rx="2" strokeWidth="1" />
                                        <line x1="-55" y1="100" x2="55" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                        {analysis.components?.some(c => c.type === 'reflective') && (
                                          <>
                                            <rect x="-55" y="-60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                            <rect x="-55" y="60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          </>
                                        )}
                                      </g>
                                      {/* ========== BACK VEST ========== */}
                                      <g transform="translate(525, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                        <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                        <line x1="-25" y1="-205" x2="-70" y2="-185" strokeWidth="1.8" />
                                        <line x1="25" y1="-205" x2="70" y2="-185" strokeWidth="1.8" />
                                        <path d="M -55,-185 L -55,105 L 55,105 L 55,-185" />
                                        <path d="M -70,-185 L -55,-185" strokeWidth="1.2" />
                                        <path d="M 70,-185 L 55,-185" strokeWidth="1.2" />
                                        <path d="M -70,-185 C -70,-120 -55,-105 -55,-105" strokeWidth="1.2" />
                                        <path d="M 70,-185 C 70,-120 55,-105 55,-105" strokeWidth="1.2" />
                                        <line x1="0" y1="-205" x2="0" y2="105" strokeWidth="0.6" strokeDasharray="3,4" stroke="#94a3b8" />
                                        <line x1="-55" y1="-165" x2="55" y2="-165" strokeWidth="1" strokeDasharray="3,2" />
                                        <text x="0" y="-170" textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontFamily="Arial">YOKE</text>
                                        <line x1="-55" y1="100" x2="55" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                        {analysis.components?.some(c => c.type === 'reflective') && (
                                          <>
                                            <rect x="-55" y="-60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                            <rect x="-55" y="60" width="110" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          </>
                                        )}
                                      </g>
                                    </>
                                  );
                                }

                                // DEFAULT: Jacket/Outerwear flat
                                return (
                                  <>
                                    {/* ========== FRONT JACKET ========== */}
                                    <g transform="translate(175, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                      {/* Collar */}
                                      <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                      <path d="M -25,-205 C -30,-195 -35,-195 -40,-200 L -30,-210 Z" strokeWidth="1.2" />
                                      <path d="M 25,-205 C 30,-195 35,-195 40,-200 L 30,-210 Z" strokeWidth="1.2" />
                                      {/* Shoulder */}
                                      <line x1="-40" y1="-200" x2="-85" y2="-185" strokeWidth="1.8" />
                                      <line x1="40" y1="-200" x2="85" y2="-185" strokeWidth="1.8" />
                                      {/* Body */}
                                      <path d="M -70,-185 L -70,105 L 70,105 L 70,-185" />
                                      {/* Armhole */}
                                      <path d="M -85,-185 L -85,-140 C -85,-110 -70,-105 -70,-105" strokeWidth="1.2" />
                                      <path d="M 85,-185 L 85,-140 C 85,-110 70,-105 70,-105" strokeWidth="1.2" />
                                      {/* Sleeves */}
                                      <path d="M -85,-185 L -120,-40 L -95,-35 L -70,-105" />
                                      <path d="M 85,-185 L 120,-40 L 95,-35 L 70,-105" />
                                      {/* Sleeve hem */}
                                      <line x1="-118" y1="-45" x2="-95" y2="-40" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      <line x1="118" y1="-45" x2="95" y2="-40" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      {/* Center front zip */}
                                      <line x1="0" y1="-205" x2="0" y2="105" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2" />
                                      {/* Zipper pull */}
                                      <rect x="-3" y="-195" width="6" height="8" rx="1" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
                                      {/* Chest pockets */}
                                      <rect x="-60" y="-155" width="38" height="35" rx="2" strokeWidth="1" />
                                      <path d="M -60,-155 L -22,-155 L -25,-147 L -57,-147 Z" strokeWidth="0.8" />
                                      <rect x="22" y="-155" width="38" height="35" rx="2" strokeWidth="1" />
                                      <path d="M 22,-155 L 60,-155 L 57,-147 L 25,-147 Z" strokeWidth="0.8" />
                                      {/* Hand pockets */}
                                      <path d="M -65,-30 L -65,25 L -25,25 L -25,-30 Z" strokeWidth="1" />
                                      <path d="M 65,-30 L 65,25 L 25,25 L 25,-30 Z" strokeWidth="1" />
                                      {/* Hem */}
                                      <line x1="-70" y1="100" x2="70" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      {/* Hi-vis bands if detected */}
                                      {analysis.components?.some(c => c.type === 'reflective') && (
                                        <>
                                          <rect x="-70" y="-80" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="-66" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="60" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="74" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                        </>
                                      )}
                                    </g>

                                    {/* ========== BACK JACKET ========== */}
                                    <g transform="translate(525, 260)" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round">
                                      {/* Collar */}
                                      <path d="M -25,-205 C -20,-220 20,-220 25,-205" strokeWidth="2" />
                                      {/* Shoulder */}
                                      <line x1="-25" y1="-205" x2="-85" y2="-185" strokeWidth="1.8" />
                                      <line x1="25" y1="-205" x2="85" y2="-185" strokeWidth="1.8" />
                                      {/* Body */}
                                      <path d="M -70,-185 L -70,105 L 70,105 L 70,-185" />
                                      {/* Armhole */}
                                      <path d="M -85,-185 L -85,-140 C -85,-110 -70,-105 -70,-105" strokeWidth="1.2" />
                                      <path d="M 85,-185 L 85,-140 C 85,-110 70,-105 70,-105" strokeWidth="1.2" />
                                      {/* Sleeves */}
                                      <path d="M -85,-185 L -120,-40 L -95,-35 L -70,-105" />
                                      <path d="M 85,-185 L 120,-40 L 95,-35 L 70,-105" />
                                      {/* CB seam */}
                                      <line x1="0" y1="-205" x2="0" y2="105" strokeWidth="0.6" strokeDasharray="3,4" stroke="#94a3b8" />
                                      {/* Back yoke seam */}
                                      <line x1="-70" y1="-165" x2="70" y2="-165" strokeWidth="1" strokeDasharray="3,2" />
                                      <text x="0" y="-170" textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontFamily="Arial">YOKE</text>
                                      {/* Hem */}
                                      <line x1="-70" y1="100" x2="70" y2="100" strokeWidth="0.8" strokeDasharray="2,2" stroke="#94a3b8" />
                                      {/* Hi-vis bands if detected */}
                                      {analysis.components?.some(c => c.type === 'reflective') && (
                                        <>
                                          <rect x="-70" y="-80" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="-66" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="60" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                          <rect x="-70" y="74" width="140" height="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.7" />
                                        </>
                                      )}
                                    </g>
                                  </>
                                );
                              })()}

                              {/* ========== POM CALLOUT LINES ========== */}
                              {analysis.measurements.length > 0 && (() => {
                                // Distribute POM callouts along the left and right margins of the FRONT view
                                const pomCount = Math.min(analysis.measurements.length, 10);
                                const startY = 55;
                                const spacing = 42;
                                return analysis.measurements.slice(0, pomCount).map((m, i) => {
                                  const yPos = startY + i * spacing;
                                  const isLeft = i % 2 === 0;
                                  // Leader line goes from garment body edge to margin
                                  const garmentX = isLeft ? 105 : 245;
                                  const marginX = isLeft ? 15 : 335;
                                  const labelX = isLeft ? 12 : 338;
                                  const anchor = isLeft ? 'end' : 'start';
                                  return (
                                    <g key={m.pom}>
                                      {/* Leader line */}
                                      <line x1={garmentX} y1={yPos} x2={marginX + (isLeft ? 18 : -18)} y2={yPos} stroke="#334155" strokeWidth="0.6" strokeDasharray="2,2" />
                                      {/* Dot on garment */}
                                      <circle cx={garmentX} cy={yPos} r="2.5" fill="#1e293b" />
                                      {/* POM label circle */}
                                      <circle cx={labelX + (isLeft ? 0 : 0)} cy={yPos} r="9" fill="#1e293b" />
                                      <text x={labelX} y={yPos + 3.5} textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="bold" fontFamily="Arial, sans-serif">{m.pom}</text>
                                      {/* Measurement value */}
                                      <text x={isLeft ? labelX - 14 : labelX + 14} y={yPos + 3} textAnchor={anchor} fill="#64748b" fontSize="5.5" fontFamily="Arial, sans-serif">{m.m}&quot;</text>
                                    </g>
                                  );
                                });
                              })()}

                              {/* Border frame */}
                              <rect x="2" y="2" width="696" height="516" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                              <rect x="5" y="5" width="690" height="510" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />

                              {/* Center divider */}
                              <line x1="350" y1="30" x2="350" y2="510" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4,4" />

                              {/* Bottom info bar */}
                              <rect x="5" y="490" width="690" height="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
                              <text x="15" y="506" fill="#94a3b8" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">
                                AI-EXTRAPOLATED TECHNICAL FLAT — {analysis.garmentClass?.toUpperCase() || 'GARMENT'} — ALL MEASUREMENTS IN INCHES, TAKEN FLAT — RIVIX COMPLIANCE PORTAL
                              </text>
                              <text x="685" y="506" textAnchor="end" fill="#94a3b8" fontSize="6" fontFamily="Arial, sans-serif">
                                {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                              </text>
                            </svg>
                          </div>

                          {/* Reference photo thumbnail */}
                          {selectedRep.images?.[0] && (
                            <div className="mt-4 flex items-start gap-3">
                              <img src={selectedRep.images[0]} alt="Reference" className="w-20 h-20 object-cover rounded border border-slate-200" />
                              <div className="text-[9px] text-slate-400 space-y-1 pt-1">
                                <p className="font-bold text-slate-600 uppercase tracking-widest">Reference Photo</p>
                                <p>Client-uploaded garment image used as basis for AI flat sketch generation and component detection.</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right: Measurements & BOM */}
                        <div className="lg:col-span-7 p-6 lg:p-8 space-y-8 bg-slate-50/50">
                          
                          {/* Measurement Spec Table */}
                          <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                              <Sliders size={14} className="text-violet-500" />
                              2. MEASUREMENT SPECIFICATION (INCHES)
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3 w-10 text-center">POM</th>
                                    <th className="px-4 py-3">DESCRIPTION</th>
                                    <th className="px-3 py-3 text-center border-l border-slate-200">XS</th>
                                    <th className="px-3 py-3 text-center border-l border-slate-200">S</th>
                                    <th className="px-3 py-3 text-center border-l-2 border-r-2 border-violet-200 bg-violet-50 text-violet-900">[M]</th>
                                    <th className="px-3 py-3 text-center border-r border-slate-200">L</th>
                                    <th className="px-3 py-3 text-center border-r border-slate-200">XL</th>
                                    <th className="px-3 py-3 text-center text-slate-400">TOL +/-</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.measurements.length > 0 ? analysis.measurements.map((m) => (
                                    <tr key={m.pom} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-50">{m.pom}</td>
                                      <td className="px-4 py-3">{m.description}</td>
                                      <td className="px-3 py-3 text-center border-l border-slate-100">{m.xs}</td>
                                      <td className="px-3 py-3 text-center border-l border-slate-100">{m.s}</td>
                                      <td className="px-3 py-3 text-center border-l-2 border-r-2 border-violet-200 bg-violet-50/50 font-bold text-violet-900">{m.m}</td>
                                      <td className="px-3 py-3 text-center border-r border-slate-100">{m.l}</td>
                                      <td className="px-3 py-3 text-center border-r border-slate-100">{m.xl}</td>
                                      <td className="px-3 py-3 text-center text-slate-400">{m.tolerance}</td>
                                    </tr>
                                  )) : (
                                    <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400 italic">Run AI analysis to generate measurements</td></tr>
                                  )}
                                </tbody>
                              </table>
                              <div className="bg-slate-100/50 px-4 py-2.5 text-[8.5px] text-slate-500 uppercase tracking-widest border-t border-slate-200 font-bold">
                                * ALL ABOVE MEASUREMENTS ARE AI-ESTIMATED IN INCHES AND TAKEN FLAT. IT IS RECOMMENDED THAT ALL SIZES ARE SAMPLED BEFORE PRODUCTION.
                              </div>
                            </div>
                          </div>

                          {/* BOM & Trims */}
                          <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                              <BookOpen size={14} className="text-violet-500" />
                              3. BILL OF MATERIALS & TRIMS
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[9.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Main Fabric</h4>
                                <p className="text-sm font-bold text-slate-800 mb-1">{analysis.fabricAnalysis?.material || 'Pending AI Analysis'}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                  <p className="text-[11px] text-slate-500 font-medium">Weight: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis?.weight || '—'}</span></p>
                                  <p className="text-[11px] text-slate-500 font-medium">Weave: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis?.weaveType || '—'}</span></p>
                                  {analysis.fabricAnalysis?.finish && <p className="text-[11px] text-slate-500 font-medium">Finish: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis.finish}</span></p>}
                                  {analysis.fabricAnalysis?.shrinkage && <p className="text-[11px] text-slate-500 font-medium">Shrinkage: <span className="text-slate-700 font-semibold">{analysis.fabricAnalysis.shrinkage}</span></p>}
                                </div>
                                {analysis.fabricAnalysis?.frRating && analysis.fabricAnalysis.frRating !== 'None' && (
                                  <div className="mt-3 bg-orange-50 border border-orange-200 px-3 py-2 rounded-md">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-700">FR RATED: {analysis.fabricAnalysis.frRating}</span>
                                  </div>
                                )}
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[9.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Zippers & Hardware</h4>
                                <ul className="text-xs font-semibold text-slate-700 space-y-2">
                                  {analysis.bom?.hardware?.length ? analysis.bom.hardware.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2"><span className="w-1.5 h-1.5 mt-1 bg-slate-300 rounded-full shrink-0" /> {item}</li>
                                  )) : (
                                    <li className="text-slate-400 italic">Pending AI analysis</li>
                                  )}
                                </ul>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[9.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Thread & Labels</h4>
                                <ul className="text-xs font-semibold text-slate-700 space-y-2">
                                  {analysis.bom?.thread?.map((item, i) => (
                                    <li key={`t-${i}`} className="flex items-start gap-2"><span className="w-1.5 h-1.5 mt-1 bg-violet-300 rounded-full shrink-0" /> {item}</li>
                                  ))}
                                  {analysis.bom?.labels?.map((item, i) => (
                                    <li key={`l-${i}`} className="flex items-start gap-2"><span className="w-1.5 h-1.5 mt-1 bg-slate-300 rounded-full shrink-0" /> {item}</li>
                                  ))}
                                  {(!analysis.bom?.thread?.length && !analysis.bom?.labels?.length) && (
                                    <li className="text-slate-400 italic">Pending AI analysis</li>
                                  )}
                                </ul>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h4 className="text-[9.5px] font-black text-slate-400 uppercase mb-3 tracking-widest">Folding & Packaging</h4>
                                {analysis.bom?.packaging ? (
                                  <>
                                    <p className="text-xs font-semibold text-slate-700 mb-2">{analysis.bom.packaging.foldDescription}</p>
                                    <ul className="text-[11px] text-slate-500 font-medium space-y-1">
                                      <li>Polybag Size: {analysis.bom.packaging.polybagSize}</li>
                                      <li>Carton: {analysis.bom.packaging.cartonSize}</li>
                                    </ul>
                                  </>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Pending AI analysis</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 4. CONSTRUCTION DETAILS */}
                          {analysis.construction.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                              <Layers size={14} className="text-violet-500" />
                              4. CONSTRUCTION & SEAM DETAILS
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-2.5">SEAM LOCATION</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">SEAM TYPE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">STITCH</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center">SPI (T/B)</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center">S/A</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">NOTES</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.construction.map((c, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2.5 font-bold text-slate-900">{c.location}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100">{c.seamType}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 font-mono text-violet-700">{c.stitchType}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center">{c.spiTop}/{c.spiBottom}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center font-bold">{c.seamAllowance}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-slate-500 text-[9px]">{c.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {/* 5. STITCH TYPE REFERENCE */}
                          {analysis.stitchReference.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                              <Activity size={14} className="text-violet-500" />
                              5. STITCH TYPE REFERENCE
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-2.5 w-16 text-center">ISO CODE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">STITCH NAME</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">MACHINE TYPE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center w-16">SPI</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">USAGE ON GARMENT</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.stitchReference.map((s, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2.5 text-center font-mono font-bold text-violet-700 bg-violet-50/50">{s.code}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 font-bold text-slate-900">{s.name}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[9px] text-slate-600">{s.machineType}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center font-bold">{s.defaultSpi}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[9px] text-slate-500">{s.usage}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {/* 6. LABEL PLACEMENTS */}
                          {analysis.labelPlacements.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                              <Target size={14} className="text-violet-500" />
                              6. LABEL PLACEMENT SCHEDULE
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-3 py-2.5">LABEL TYPE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">PLACEMENT</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">ATTACHMENT</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200 text-center">SIZE</th>
                                    <th className="px-3 py-2.5 border-l border-slate-200">MATERIAL</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                  {analysis.labelPlacements.map((lp, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2.5 font-bold text-slate-900">{lp.type}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[9px]">{lp.location}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[9px]">{lp.attachment}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-center font-mono">{lp.dimensions}</td>
                                      <td className="px-3 py-2.5 border-l border-slate-100 text-[9px] text-slate-500">{lp.material}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )}

                          {/* 7. COLORWAY & WASH CARE — side by side */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analysis.colorway && (
                            <div>
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                                <Eye size={14} className="text-violet-500" />
                                7. COLORWAY
                              </h3>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                                <div className="grid grid-cols-1 gap-2 text-[11px]">
                                  <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[9px]">Body</span><span className="font-semibold text-slate-800">{analysis.colorway.bodyColor}</span></div>
                                  {analysis.colorway.contrastColors?.length > 0 && (
                                    <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[9px]">Contrast</span><span className="font-semibold text-slate-800">{analysis.colorway.contrastColors.join(', ')}</span></div>
                                  )}
                                  <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[9px]">Thread</span><span className="font-semibold text-slate-800">{analysis.colorway.threadColor}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[9px]">Hardware</span><span className="font-semibold text-slate-800">{analysis.colorway.hardwareFinish}</span></div>
                                  {analysis.colorway.reflectiveTape && analysis.colorway.reflectiveTape !== 'N/A' && (
                                    <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[9px]">Reflective</span><span className="font-semibold text-slate-800">{analysis.colorway.reflectiveTape}</span></div>
                                  )}
                                </div>
                              </div>
                            </div>
                            )}

                            {analysis.washCare && (
                            <div>
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 mb-4 flex items-center gap-2">
                                <ShieldCheck size={14} className="text-violet-500" />
                                8. WASH & CARE
                              </h3>
                              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                                <ul className="text-[11px] font-medium text-slate-700 space-y-1.5">
                                  {analysis.washCare.instructions?.map((inst, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 mt-1.5 bg-slate-300 rounded-full shrink-0" />
                                      {inst}
                                    </li>
                                  ))}
                                </ul>
                                {analysis.washCare.specialNotes && (
                                  <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-md mt-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">NOTE: </span>
                                    <span className="text-[10px] text-amber-800 font-medium">{analysis.washCare.specialNotes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* Idle state — no analysis run yet */}
                  {analysis.status === 'idle' && (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center text-violet-400">
                        <Camera size={36} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Ready for AI Analysis</h3>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        Click &ldquo;Run AI Scan&rdquo; above to process the client&apos;s uploaded garment photos. The AI engine will detect every component — snaps, zippers, seams, reflective striping — and auto-generate a production-ready CAD wireframe.
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {['Fabric Detection', 'Hardware ID', 'Seam Mapping', 'Wireframe Gen'].map(step => (
                          <div key={step} className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-300" />
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                      <p className="text-[10px] text-slate-400">Carrier details of the uniform sent to RIVIX.</p>
                    </div>
                  </div>

                  {selectedRep.clientTrackingNumber ? (
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Carrier</span>
                        <span className="font-black text-slate-700">{selectedRep.clientTrackingCarrier}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Transit Code</span>
                        <a 
                          href={getTrackingUrl(selectedRep.clientTrackingCarrier, selectedRep.clientTrackingNumber)}
                          target="_blank" 
                          rel="noreferrer"
                          className="font-mono font-bold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-150 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition-all"
                        >
                          {selectedRep.clientTrackingNumber} <ExternalLink size={10} />
                        </a>
                      </div>
                      <a 
                        href={getTrackingUrl(selectedRep.clientTrackingCarrier, selectedRep.clientTrackingNumber)}
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full bg-slate-900 text-white font-bold text-xs text-center py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        Track Inbound Piece <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-3">
                      <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-widest">No Inbound Info</h4>
                        <p className="text-[10px] text-amber-700 leading-relaxed">
                          The client has not yet logged transit details for their physical uniform piece.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Card: Dispatch replicated prototype return sample */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rivix/10 flex items-center justify-center text-rivix">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Dispatch Reproduced Sample</h3>
                      <p className="text-[10px] text-slate-400">Log return carrier tracking once sample is stitched.</p>
                    </div>
                  </div>

                  {selectedRep.rivixTrackingNumber ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs text-emerald-800">
                        <span className="font-bold uppercase tracking-widest text-[9px]">Status</span>
                        <span className="font-black flex items-center gap-1"><CheckCircle size={12}/> Dispatched</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Carrier / Partner</span>
                        <span className="font-black text-slate-700">{selectedRep.rivixTrackingCarrier}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Transit Code</span>
                        <a 
                          href={getTrackingUrl(selectedRep.rivixTrackingCarrier, selectedRep.rivixTrackingNumber)}
                          target="_blank" 
                          rel="noreferrer"
                          className="font-mono font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition-all"
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
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Carrier</label>
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
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tracking Code</label>
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
                          className="w-full bg-rivix text-white py-3 rounded-xl text-xs font-bold hover:bg-rivix-dark hover:shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          Dispatch Replicated Sample
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: CHAT FEED & PRESETS */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                
                {/* Chat presets widget */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={12}/> Engineering Preset Templates</h4>
                  
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Weave Check', msg: 'We have received your physical overalls. We are analyzing the weave under 400x magnification to match the exact GSM density. Expect a full blueprint update soon.' },
                      { label: 'Nomex Zip Recommendation', msg: 'For maximum safety compliance in the refining area, we strongly recommend utilizing YKK Nomex zippers instead of standard nylon. Please review and confirm.' },
                      { label: 'Magnets Standard Approved', msg: 'Our factory has approved the custom high-durability magnetic closure setup for low ambient operations. Spec sheet locked.' }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => handleUsePresetMessage(preset.msg)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:border-rivix hover:text-rivix transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat dialogue */}
                <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-6 h-[300px] overflow-y-auto space-y-4 flex flex-col justify-end">
                  <div className="space-y-4 overflow-y-auto pr-2">
                    {selectedRep.messages.map((msg) => {
                      const isAdmin = msg.sender === 'admin';
                      
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} gap-3 items-start`}>
                          {!isAdmin && (
                            <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5">
                              PM
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500">{msg.senderName}</span>
                              <span className="text-[8px] text-slate-400">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className={`p-4 rounded-2xl text-xs max-w-sm leading-relaxed shadow-sm ${
                              isAdmin 
                                ? 'bg-rivix text-white rounded-tr-none' 
                                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chat Input */}
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Provide manufacturing/shipping instructions to the client..." 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:border-rivix/50"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="bg-rivix text-white rounded-xl px-5 py-3 hover:bg-rivix-dark transition-all flex items-center justify-center"
                  >
                    <Send size={16} />
                  </button>
                </div>

              </div>
            )}

          </div>
        ) : (
          <div className="bg-white rounded-3xl p-20 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Package size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-4">Select a Client Replication Ticket</h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Choose a ticket from the left column queue to review user spec sheets, log sample tracking, and converse with local clients.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
