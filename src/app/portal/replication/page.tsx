'use client';

import { useEffect, useState } from 'react';
import { 
  getReplications, 
  saveReplication, 
  ReplicationRequest, 
  ReplicationSpec 
} from '@/lib/replicationStorage';
import { 
  UploadCloud, 
  Package, 
  FileText, 
  ShieldCheck, 
  Truck, 
  Send, 
  Plus, 
  ArrowLeft, 
  ChevronRight, 
  User, 
  Info,
  MapPin,
  ExternalLink,
  Download,
  AlertCircle
} from 'lucide-react';
import Image from 'next/image';

export default function ClientReplicationPage() {
  const [replications, setReplications] = useState<ReplicationRequest[]>([]);
  const [selectedRep, setSelectedRep] = useState<ReplicationRequest | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'specs' | 'tracking' | 'chat'>('specs');
  
  // Form States for Upload
  const [newProductName, setNewProductName] = useState('');
  const [newGarmentType, setNewGarmentType] = useState<'overalls' | 'parka' | 'jacket' | 'pants' | 'vest'>('overalls');
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: string }>({});

  // Client Tracking Input
  const [clientCarrier, setClientCarrier] = useState('Canada Post');
  const [clientTrackingCode, setClientTrackingCode] = useState('');

  // Chat Input
  const [chatMessage, setChatMessage] = useState('');

  // Hotspot State
  const [activeHotspot, setActiveHotspot] = useState<{ id: string; title: string; description: string } | null>(null);

  // Wizard States
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [wizardTrackingCarrier, setWizardTrackingCarrier] = useState('Canada Post');
  const [wizardTrackingCode, setWizardTrackingCode] = useState('');
  const [wizardNotificationPref, setWizardNotificationPref] = useState<'email' | 'sms' | 'portal'>('portal');
  const [generatedRefId, setGeneratedRefId] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const stored = await getReplications();
      // Only show for Pacific Mining Co
      const filtered = stored.filter(r => r.clientName === 'Pacific Mining Co.');
      setReplications(filtered);
      if (filtered.length > 0 && !selectedRep) {
        setSelectedRep(filtered[0]);
      }
    };
    loadData();
  }, [selectedRep]);

  const handleFileUpload = (view: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      
      setIsUploading(false);
      setUploadProgress(100);
      setUploadedFiles(prevFiles => ({
        ...prevFiles,
        [view]: base64
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleWizardNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    setWizardStep(2);
  };

  const handleWizardNextToStep3 = () => {
    setWizardStep(3);
  };

  const handleWizardComplete = async () => {
    const newId = `RIV-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedRefId(newId);
    
    const collectedImages = [];
    if (uploadedFiles.front) collectedImages.push(uploadedFiles.front);
    if (uploadedFiles.back) collectedImages.push(uploadedFiles.back);
    if (uploadedFiles.tag) collectedImages.push(uploadedFiles.tag);
    if (uploadedFiles.detail) collectedImages.push(uploadedFiles.detail);

    const newRequest: ReplicationRequest = {
      id: newId,
      clientName: 'Pacific Mining Co.',
      productName: newProductName,
      garmentType: newGarmentType as any,
      status: 'received',
      submissionDate: new Date().toISOString().split('T')[0],
      images: collectedImages,
      clientTrackingCarrier: wizardTrackingCode.trim() ? wizardTrackingCarrier : undefined,
      clientTrackingNumber: wizardTrackingCode.trim() ? wizardTrackingCode : undefined,
      specs: {
        fabricWeight: '320 GSM',
        coreMaterial: '100% FR Cotton Twill',
        liningMaterial: 'Quilted Polyester',
        zippers: 'Standard Heavy-Duty Zippers',
        buttonsSnaps: 'Metal snaps',
        safetyRating: 'CSA Z96 Class 1',
        reflectiveStriping: '2" Standard Reflective Ribbon',
        pocketsCount: '6 pockets',
        seamConstruction: 'Double stitched seams',
        specialInstructions: 'Replicate fit exactly.',
        annotations: [
          { id: '1', x: 50, y: 15, title: 'Reinforced Collar', description: 'Dual layer fabric for high abrasion areas' },
          { id: '2', x: 25, y: 40, title: 'Utility Pockets', description: 'Deep utility layouts with heavy duty reinforcement' },
          { id: '3', x: 50, y: 55, title: 'Hardware closures', description: 'Secure front snaps with protective flap' },
        ]
      },
      messages: [
        { id: `m-${Date.now()}`, sender: 'admin', senderName: 'RIVIX Automated', message: `Your replication ticket has been initialized. We have noted your preference for ${wizardNotificationPref.toUpperCase()} updates. Once we inspect the uploaded photos, our AI will generate the initial tech pack.`, timestamp: new Date().toISOString() }
      ]
    };

    await saveReplication(newRequest);
    setWizardStep(4);
  };

  const finishWizardAndOpenDashboard = async () => {
    setWizardStep(0);
    // Reset form
    setNewProductName('');
    setNewGarmentType('overalls');
    setUploadedFiles({});
    setWizardTrackingCode('');
    
    // Reload data and select new submission
    const stored = await getReplications();
    const filtered = stored.filter(r => r.clientName === 'Pacific Mining Co.');
    setReplications(filtered);
    const found = filtered.find(r => r.id === generatedRefId);
    if (found) setSelectedRep(found);
  };

  const handleSubmitClientTracking = async () => {
    if (!selectedRep || !clientTrackingCode.trim()) return;

    const updated: ReplicationRequest = {
      ...selectedRep,
      clientTrackingCarrier: clientCarrier,
      clientTrackingNumber: clientTrackingCode,
      status: 'received',
      messages: [
        ...selectedRep.messages,
        {
          id: `msg-${Date.now()}`,
          sender: 'client',
          senderName: 'Gary Vance',
          message: `Physical sample shipped via ${clientCarrier}. Tracking Number: ${clientTrackingCode}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    await saveReplication(updated);
    setSelectedRep(updated);
    setClientTrackingCode('');
  };

  const handleSendMessage = async () => {
    if (!selectedRep || !chatMessage.trim()) return;

    const updated: ReplicationRequest = {
      ...selectedRep,
      messages: [
        ...selectedRep.messages,
        {
          id: `msg-${Date.now()}`,
          sender: 'client',
          senderName: 'Gary Vance',
          message: chatMessage,
          timestamp: new Date().toISOString()
        }
      ]
    };

    await saveReplication(updated);
    setSelectedRep(updated);
    setChatMessage('');

    // Trigger mock admin reply after 1.5 seconds
    setTimeout(async () => {
      const stored = await getReplications();
      const latest = stored.find(r => r.id === selectedRep.id);
      if (!latest) return;
      
      const adminReply: ReplicationRequest = {
        ...latest,
        messages: [
          ...latest.messages,
          {
            id: `msg-admin-${Date.now()}`,
            sender: 'admin',
            senderName: 'Sarah R. (RIVIX Production)',
            message: `Hi Gary, thank you for the feedback. I have notified our production supervisor to review the specifications of the ${latest.productName}. We will adjust the material sample accordingly.`,
            timestamp: new Date().toISOString()
          }
        ]
      };
      await saveReplication(adminReply);
      setSelectedRep(adminReply);
    }, 1500);
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

  const getStatusStepClass = (currentStatus: string, step: string) => {
    const statusOrder = ['received', 'spec_mapped', 'sample_production', 'sample_shipped'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(step);
    
    if (currentIndex >= stepIndex) {
      if (currentStatus === step && step === 'sample_shipped') {
        return 'bg-emerald-500 border-emerald-500 text-white font-bold scale-110';
      }
      return 'bg-rivix border-rivix text-white font-bold';
    }
    return 'bg-white border-slate-200 text-slate-400';
  };

  const getStatusLineClass = (currentStatus: string, startStep: string) => {
    const statusOrder = ['received', 'spec_mapped', 'sample_production', 'sample_shipped'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const startIndex = statusOrder.indexOf(startStep);
    
    if (currentIndex > startIndex) {
      return 'bg-rivix';
    }
    return 'bg-slate-200';
  };


  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 font-sans">
      
      {/* LEFT COLUMN: Submissions queue & Upload block (4 cols) */}
      <div className="xl:col-span-4 space-y-6">
        
        {wizardStep === 0 && (
          <>
            <button 
              onClick={() => { setWizardStep(1); setSelectedRep(null); }}
              className="w-full bg-rivix text-white py-4 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-rivix-dark hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus size={18} /> New Replication Request
            </button>

            {/* Existing Submissions List */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Active Tickets ({replications.length})</h3>
              
              <div className="space-y-3">
                {replications.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">No active requests. Click above to start.</div>
                )}
                {replications.map(rep => {
                  const isActive = selectedRep?.id === rep.id;
                  
                  return (
                    <div 
                      key={rep.id}
                      onClick={() => { setSelectedRep(rep); setActiveHotspot(null); }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isActive 
                          ? 'border-rivix bg-rivix/5 shadow-sm' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">{rep.productName}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{rep.garmentType}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-[9px] font-bold text-slate-400">{rep.submissionDate}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          rep.status === 'sample_shipped' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : rep.status === 'sample_production'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rep.status.replace('_', ' ')}
                        </span>
                        <ChevronRight size={14} className="text-slate-400 group-hover:text-rivix transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {wizardStep > 0 && wizardStep < 4 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <button onClick={() => wizardStep === 1 ? setWizardStep(0) : setWizardStep((wizardStep - 1) as any)} className="text-slate-400 hover:text-rivix transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div className="flex gap-1.5">
                {[1, 2, 3].map(step => (
                  <div key={step} className={`w-8 h-1.5 rounded-full transition-all ${wizardStep >= step ? 'bg-rivix' : 'bg-slate-100'}`} />
                ))}
              </div>
            </div>

            {/* STEP 1: Uploads */}
            {wizardStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest italic">1. Garment Details</h2>
                  <p className="text-[11px] text-slate-400 mt-1">Specify what you want us to reverse engineer.</p>
                </div>

                <form onSubmit={handleWizardNextToStep2} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Apparel Piece Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Custom Safety Parka" 
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rivix/50"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Garment Class (Optional)</label>
                      <select 
                        value={newGarmentType} 
                        onChange={(e: any) => setNewGarmentType(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-3 bg-white focus:outline-none focus:border-rivix/50"
                      >
                        <option value="overalls">FR Overalls</option>
                        <option value="parka">Arctic Parka</option>
                        <option value="jacket">Safety Jacket</option>
                        <option value="hoodie">Hoodie / Sweatshirt</option>
                        <option value="coat">Coat / Parka</option>
                        <option value="pants">Work Pants</option>
                        <option value="vest">High-Vis Vest</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Image Upload Terminal</h3>
                    <p className="text-[11px] text-slate-400 -mt-2">Provide high-resolution photos for detail accuracy.</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Front Angle', key: 'front' },
                        { label: 'Back Angle', key: 'back' },
                        { label: 'Fabric Tag', key: 'tag' },
                        { label: 'Close Detail', key: 'detail' }
                      ].map(photo => (
                        <div 
                          key={photo.key} 
                          className={`border-2 border-dashed rounded-2xl overflow-hidden p-4 flex flex-col items-center justify-center text-center transition-all min-h-[120px] relative ${
                            uploadedFiles[photo.key] 
                              ? 'border-emerald-500/20 bg-emerald-50/5' 
                              : 'border-slate-200 hover:border-rivix bg-slate-50/50'
                          }`}
                        >
                          <input 
                            type="file" 
                            id={`file-upload-${photo.key}`} 
                            onChange={(e) => handleFileUpload(photo.key, e)} 
                            className="hidden" 
                            accept="image/*" 
                          />
                          {uploadedFiles[photo.key] ? (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-1">
                              <img 
                                src={uploadedFiles[photo.key]} 
                                alt={photo.label} 
                                className="w-12 h-12 rounded-lg object-cover border border-emerald-100 shadow-sm mx-auto" 
                              />
                              <p className="text-[9px] font-bold text-slate-700">{photo.label}</p>
                              <div className="flex items-center gap-1.5 justify-center">
                                <span className="text-[7px] font-black text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5">
                                  <ShieldCheck size={8} /> Ready
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => setUploadedFiles(prev => {
                                    const updated = { ...prev };
                                    delete updated[photo.key];
                                    return updated;
                                  })}
                                  className="text-[7px] font-black text-slate-400 hover:text-rivix uppercase tracking-widest hover:underline"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label 
                              htmlFor={`file-upload-${photo.key}`}
                              className="space-y-1 w-full cursor-pointer group flex flex-col items-center justify-center"
                            >
                              <UploadCloud size={18} className="text-slate-400 mx-auto group-hover:text-rivix transition-colors" />
                              <p className="text-[9px] font-bold text-slate-600">{photo.label}</p>
                              <span className="text-[8px] font-black text-slate-400 group-hover:text-rivix uppercase tracking-widest block">Browse</span>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-slate-800 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Next: Transit Details <ChevronRight size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* STEP 2: Physical Transit */}
            {wizardStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest italic">2. Physical Transit</h2>
                  <p className="text-[11px] text-slate-400 mt-1">To ensure 100% material compliance, please send us a physical prototype. (Optional)</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Carrier</label>
                    <select 
                      value={wizardTrackingCarrier}
                      onChange={(e) => setWizardTrackingCarrier(e.target.value)}
                      className="w-full text-sm font-bold border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:border-rivix/50"
                    >
                      <option>Canada Post</option>
                      <option>Purolator</option>
                      <option>UPS</option>
                      <option>FedEx</option>
                      <option>DHL Express</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tracking Code</label>
                    <input 
                      type="text"
                      placeholder="e.g. CX8892100CA"
                      value={wizardTrackingCode}
                      onChange={(e) => setWizardTrackingCode(e.target.value)}
                      className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rivix/50"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleWizardNextToStep3}
                    className="flex-1 bg-slate-100 text-slate-500 py-3.5 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Skip / Add Later
                  </button>
                  <button 
                    onClick={handleWizardNextToStep3}
                    className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    Continue <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Notifications & Finish */}
            {wizardStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest italic">3. Notifications</h2>
                  <p className="text-[11px] text-slate-400 mt-1">How should we notify you when the AI Tech Pack is completed?</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'email', label: 'Email Alerts', icon: <Send size={16}/> },
                    { id: 'sms', label: 'SMS Text Message', icon: <Info size={16}/> },
                    { id: 'portal', label: 'Portal Only (No Alerts)', icon: <ShieldCheck size={16}/> },
                  ].map(method => (
                    <div key={method.id} className="space-y-3">
                      <div 
                        onClick={() => setWizardNotificationPref(method.id as any)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer flex items-center gap-4 transition-all ${
                          wizardNotificationPref === method.id ? 'border-rivix bg-rivix/5 text-rivix' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          wizardNotificationPref === method.id ? 'border-rivix' : 'border-slate-300'
                        }`}>
                          {wizardNotificationPref === method.id && <div className="w-2.5 h-2.5 bg-rivix rounded-full" />}
                        </div>
                        <div className="font-bold text-sm uppercase tracking-wider">{method.label}</div>
                      </div>

                      {wizardNotificationPref === method.id && method.id === 'email' && (
                        <div className="pl-6 animate-in slide-in-from-top-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                          <input type="email" defaultValue="gary.vance@pacificmining.com" className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rivix/50" />
                        </div>
                      )}

                      {wizardNotificationPref === method.id && method.id === 'sms' && (
                        <div className="pl-6 animate-in slide-in-from-top-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mobile Number</label>
                          <input type="tel" defaultValue="(403) 555-0192" className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rivix/50" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleWizardComplete}
                  className="w-full bg-rivix text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-rivix-dark hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
                >
                  <Send size={18} /> Complete Submission
                </button>
              </div>
            )}

          </div>
        )}

        {/* STEP 4: Success Screen */}
        {wizardStep === 4 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-emerald-100 space-y-6 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner text-emerald-500">
              <ShieldCheck size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Submission Accepted</h2>
              <p className="text-xs text-slate-500">Your custom apparel has been logged into the RIVIX queue.</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 inline-block mx-auto text-left w-full space-y-3">
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-400 uppercase tracking-widest">Reference ID:</span>
                 <span className="font-black text-rivix bg-rivix/10 px-2 py-1 rounded-lg">{generatedRefId}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-400 uppercase tracking-widest">Notification:</span>
                 <span className="font-bold text-slate-700 capitalize flex items-center gap-1"><AlertCircle size={12} className="text-emerald-500"/> Sent via {wizardNotificationPref}</span>
               </div>
            </div>

            <button 
              onClick={finishWizardAndOpenDashboard}
              className="w-full bg-slate-900 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Open Ticket Dashboard <ExternalLink size={16} />
            </button>
          </div>
        )}

      </div>
{/* RIGHT COLUMN: Active Submission Details & Interactive Builder (8 cols) */}
      <div className="xl:col-span-8 space-y-6">
        {selectedRep ? (
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 space-y-6">
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-[9px] font-black text-rivix uppercase tracking-widest bg-rivix/10 px-3 py-1 rounded-full">{selectedRep.id}</span>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 mt-2">{selectedRep.productName}</h1>
                <p className="text-xs text-slate-500 mt-1">Submitted on {selectedRep.submissionDate} by Pacific Mining Co.</p>
              </div>

              {/* Status Tracker */}
              <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
                {[
                  { label: 'Received', status: 'received' },
                  { label: 'Mapped', status: 'spec_mapped' },
                  { label: 'Production', status: 'sample_production' },
                  { label: 'Shipped', status: 'sample_shipped' }
                ].map((step, idx) => (
                  <div key={step.status} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5 relative">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all ${
                        getStatusStepClass(selectedRep.status, step.status)
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{step.label}</span>
                    </div>
                    {idx < 3 && (
                      <div className={`h-0.5 w-8 lg:w-12 mx-1 -mt-3.5 rounded-full transition-all ${
                        getStatusLineClass(selectedRep.status, step.status)
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* TAB INTERFACE: Photographic Replication Guide, Shipping, Chat */}
            <div className="flex border-b border-slate-100">
              <button 
                onClick={() => setActiveTab('specs')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                  activeTab === 'specs' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Photo Capture Guide
              </button>
              <button 
                onClick={() => setActiveTab('tracking')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                  activeTab === 'tracking' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Shipment Tracking
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                  activeTab === 'chat' 
                    ? 'border-rivix text-rivix' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Correspondence Feed ({selectedRep.messages.length})
              </button>
            </div>

            {/* TAB CONTENT: PHOTO CAPTURE GUIDE */}
            {activeTab === 'specs' && (
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-rivix/10 text-rivix rounded-2xl shrink-0">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Garment Photographic Replication Guide</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        To replicate your high-stress coveralls or workwear, please follow our guided photographic spec layout. Provide high-resolution detail photos below to allow our engineering team to map the fit, cut, and fire-resistance parameters accurately.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { 
                      label: '1. Front View (Flat Layout)', 
                      key: 'front',
                      desc: 'Lay the garment completely flat. Zipped and buttoned. Ensure even shadowless lighting to capture precise stripe and pocket spacing.',
                      tip: 'Tip: Maintain full-frame coverage showing sleeves and hems.'
                    },
                    { 
                      label: '2. Back View (Flat Layout)', 
                      key: 'back',
                      desc: 'Capture the rear side flat. Shows reflective H-pattern layout, shoulder action vents, waistband elastic, and back pockets.',
                      tip: 'Tip: Smooth out wrinkles to verify back measurements.'
                    },
                    { 
                      label: '3. Fabric Care & Spec Tag', 
                      key: 'tag',
                      desc: 'Macro extreme close-up of labeling. Must show fiber composition (cotton/modacrylic), safety certifications (CSA Z96, NFPA 2112), and manufacturer specifications.',
                      tip: 'Tip: Extremely critical for fire-resistance compliance.'
                    },
                    { 
                      label: '4. Seams & Critical Details', 
                      key: 'detail',
                      desc: 'Zoomed shot of triple-needle stitching, crotch gussets, hardware snap details, or heavy-duty YKK brass zipper reinforcements.',
                      tip: 'Tip: Helps our factory copy the high-abrasion reinforcement.'
                    }
                  ].map(photo => {
                    const isUploaded = uploadedFiles[photo.key];
                    return (
                      <div key={photo.key} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between">
                            <span>{photo.label}</span>
                            {isUploaded && (
                              <span className="text-[7px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5">
                                <ShieldCheck size={8} /> Selected
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{photo.desc}</p>
                          <span className="text-[9px] font-bold text-rivix bg-rivix/5 px-2 py-1 rounded-lg inline-block">{photo.tip}</span>
                        </div>

                        <div className="relative">
                          <input 
                            type="file" 
                            id={`guide-upload-${photo.key}`}
                            onChange={(e) => handleFileUpload(photo.key, e)}
                            className="hidden"
                            accept="image/*"
                          />
                          {isUploaded ? (
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 aspect-video relative group shadow-sm flex items-center justify-center">
                              <img 
                                src={uploadedFiles[photo.key]} 
                                alt={photo.label} 
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                <label 
                                  htmlFor={`guide-upload-${photo.key}`}
                                  className="bg-white text-slate-900 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-all active:scale-95"
                                >
                                  Replace
                                </label>
                                <button 
                                  type="button"
                                  onClick={() => setUploadedFiles(prev => {
                                    const updated = { ...prev };
                                    delete updated[photo.key];
                                    return updated;
                                  })}
                                  className="bg-rivix text-white rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-rivix-dark transition-all active:scale-95"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label 
                              htmlFor={`guide-upload-${photo.key}`}
                              className="border-2 border-dashed border-slate-200 hover:border-rivix rounded-2xl aspect-video bg-slate-50 flex flex-col items-center justify-center text-center p-6 cursor-pointer group transition-all"
                            >
                              <UploadCloud size={28} className="text-slate-400 group-hover:text-rivix transition-colors animate-pulse" />
                              <p className="text-xs font-bold text-slate-700 mt-2">Upload Reference Photo</p>
                              <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Click to select image</span>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Technical compliance declaration */}
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">RIVIX Compliance Replication Standards</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-500">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Weave replication</span>
                      <p className="text-[11px] leading-relaxed">Reverse engineering fabric weight (GSM) under micro-magnification to match exact safety ratings.</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Stitching Compliance</span>
                      <p className="text-[11px] leading-relaxed">Deploying 100% genuine Nomex® carbon-core sewing threads to prevent seam melting at 400°C.</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Accreditation Lock</span>
                      <p className="text-[11px] leading-relaxed">Direct manufacturing mapping to ensure compliance certifications (CSA Z96 & NFPA 2112) remain fully intact.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SHIPMENT TRACKING */}
            {activeTab === 'tracking' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Card: Customer to Factory tracking */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-5 shadow-sm hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">1. Client Physical Sample Shipment</h3>
                      <p className="text-[10px] text-slate-400">Send your physical piece to RIVIX factory for review.</p>
                    </div>
                  </div>

                  {selectedRep.clientTrackingNumber ? (
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Carrier / Partner</span>
                        <span className="font-black text-slate-700">{selectedRep.clientTrackingCarrier}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Tracking Number</span>
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
                        Track Shipment <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        To guarantee 100% material and cut replication, send your physical sample to our Calgary warehouse. Log your tracking number below:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Carrier</label>
                            <select 
                              value={clientCarrier}
                              onChange={(e) => setClientCarrier(e.target.value)}
                              className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-2.5 bg-white focus:outline-none focus:border-rivix/50"
                            >
                              <option>Canada Post</option>
                              <option>Purolator</option>
                              <option>UPS</option>
                              <option>FedEx</option>
                              <option>DHL Express</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tracking Code</label>
                            <input 
                              type="text"
                              placeholder="e.g. CX8892100CA"
                              value={clientTrackingCode}
                              onChange={(e) => setClientTrackingCode(e.target.value)}
                              className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-2.5 focus:outline-none focus:border-rivix/50"
                            />
                          </div>
                        </div>

                        <button 
                          onClick={handleSubmitClientTracking}
                          className="w-full bg-rivix text-white py-3 rounded-xl text-xs font-bold hover:bg-rivix-dark hover:shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          Submit Transit Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Card: RIVIX reproduced prototype tracking back to customer */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-5 shadow-sm hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rivix/10 flex items-center justify-center text-rivix">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">2. RIVIX Prototype Dispatch</h3>
                      <p className="text-[10px] text-slate-400">RIVIX sends the finished replicated sample to you.</p>
                    </div>
                  </div>

                  {selectedRep.rivixTrackingNumber ? (
                    <div className="bg-rivix/5 rounded-2xl border border-rivix/10 p-5 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Prototype Courier</span>
                        <span className="font-black text-slate-700">{selectedRep.rivixTrackingCarrier}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Sample Tracking</span>
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
                        Track Prototype Sample <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-center items-center text-center py-10 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 animate-pulse">
                        ⌛
                      </div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mt-2">Awaiting Manufacture</h4>
                      <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                        Once we complete analysis and stitch the prototype, carrier tracking details will instantly populate this frame.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: CHAT CORRESPONDENCE */}
            {activeTab === 'chat' && (
              <div className="space-y-4">
                
                {/* Chat window */}
                <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-6 h-[400px] overflow-y-auto space-y-4 flex flex-col justify-end">
                  <div className="space-y-4 overflow-y-auto pr-2">
                    {selectedRep.messages.map((msg) => {
                      const isAdmin = msg.sender === 'admin';
                      
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} gap-3 items-start`}>
                          {isAdmin && (
                            <div className="w-7 h-7 rounded-full bg-rivix flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5">
                              RX
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
                                ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none' 
                                : 'bg-slate-900 text-white rounded-tr-none'
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Input block */}
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Type a query for RIVIX design and manufacturing engineers..." 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:border-rivix/50"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="bg-slate-900 text-white rounded-xl px-5 py-3 hover:bg-slate-800 transition-all flex items-center justify-center"
                  >
                    <Send size={16} />
                  </button>
                </div>

              </div>
            )}

          </div>
        ) : (
          <div className="bg-white rounded-3xl p-20 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-rivix/10 flex items-center justify-center text-rivix">
              <Package size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-4">Select or Create a Replication Ticket</h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Use the sidebar form to submit a new uniform piece or click on an existing ticket to view its active tech sheets and tracking statuses.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
