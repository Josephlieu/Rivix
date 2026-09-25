import { supabase } from './supabase';
import type { PersistedGarmentAIAnalysis } from './garmentAiAnalysis';

export interface ReplicationSpec {
  fabricWeight: string;
  coreMaterial: string;
  liningMaterial: string;
  zippers: string;
  buttonsSnaps: string;
  safetyRating: string;
  reflectiveStriping: string;
  pocketsCount: string;
  seamConstruction: string;
  specialInstructions: string;
  annotations: Array<{
    id: string;
    x: number; // percentage from left
    y: number; // percentage from top
    title: string;
    description: string;
  }>;
  /** Fallback storage when ai_analysis column is unavailable */
  aiAnalysis?: PersistedGarmentAIAnalysis;
}

export interface ReplicationRequest {
  id: string;
  clientName: string;
  productName: string;
  garmentType: 'overalls' | 'parka' | 'jacket' | 'pants' | 'vest' | 'hoodie' | 'coat';
  status: 'received' | 'spec_mapped' | 'sample_production' | 'sample_shipped';
  submissionDate: string;
  images: string[]; // Mock or uploaded image data URLs / placeholders
  specs: ReplicationSpec;
  clientTrackingCarrier?: string;
  clientTrackingNumber?: string;
  rivixTrackingCarrier?: string;
  rivixTrackingNumber?: string;
  messages: Array<{
    id: string;
    sender: 'client' | 'admin';
    senderName: string;
    message: string;
    timestamp: string;
  }>;
  /** Saved Gemini tech pack — persists across refresh */
  aiAnalysis?: PersistedGarmentAIAnalysis | null;
}

const DEFAULT_REPLICATIONS: ReplicationRequest[] = [];

const LOCAL_STORAGE_KEY = 'rivix_uniform_replications_v2';

// Safely get all replication requests
export const getReplications = async (): Promise<ReplicationRequest[]> => {
  if (typeof window === 'undefined') return DEFAULT_REPLICATIONS;

  try {
    // Attempt Supabase fetch
    const { data, error } = await supabase
      .from('replications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase error fetching replications, falling back to local storage:', error);
      throw error;
    }

    if (data && data.length > 0) {
      // Map database format to local format
      return data.map((d: any) => ({
        id: d.id,
        clientName: d.client_name,
        productName: d.product_name,
        garmentType: d.garment_type,
        status: d.status,
        submissionDate: d.submission_date || new Date(d.created_at).toISOString().split('T')[0],
        images: d.images || [],
        specs: d.specs || {},
        clientTrackingCarrier: d.client_tracking_carrier,
        clientTrackingNumber: d.client_tracking_number,
        rivixTrackingCarrier: d.rivix_tracking_carrier,
        rivixTrackingNumber: d.rivix_tracking_number,
        messages: d.messages || [],
        aiAnalysis: d.ai_analysis || d.specs?.aiAnalysis || null,
      }));
    }
  } catch (err) {
    // Silent catch, fall back to local storage
  }

  // Local Storage Fallback
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_REPLICATIONS));
    return DEFAULT_REPLICATIONS;
  }
  
  return JSON.parse(stored);
};

// Save a single/updated replication request
export const saveReplication = async (replication: ReplicationRequest): Promise<void> => {
  if (typeof window === 'undefined') return;

  // 1. Try updating Supabase
  try {
    const dbObject = {
      id: replication.id,
      client_name: replication.clientName,
      product_name: replication.productName,
      garment_type: replication.garmentType,
      status: replication.status,
      images: replication.images,
      specs: {
        ...replication.specs,
        aiAnalysis: replication.aiAnalysis ?? undefined,
      },
      client_tracking_carrier: replication.clientTrackingCarrier,
      client_tracking_number: replication.clientTrackingNumber,
      rivix_tracking_carrier: replication.rivixTrackingCarrier,
      rivix_tracking_number: replication.rivixTrackingNumber,
      messages: replication.messages,
      ai_analysis: replication.aiAnalysis ?? null,
    };

    const { error } = await supabase
      .from('replications')
      .upsert(dbObject, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert failed, saving to localStorage:', error);
      throw error;
    }
  } catch (err) {
    // Silent catch, handle locally
  }

  // 2. Local Storage Sync with QuotaExceeded fallback
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    let reps: ReplicationRequest[] = stored ? JSON.parse(stored) : DEFAULT_REPLICATIONS;
    
    const index = reps.findIndex(r => r.id === replication.id);
    if (index >= 0) {
      reps[index] = replication;
    } else {
      reps.push(replication);
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reps));
  } catch (localStorageError) {
    console.warn('LocalStorage write failed (likely quota exceeded due to large base64 images). Saving metadata without images:', localStorageError);
    try {
      const cleanReplication = {
        ...replication,
        images: [] // Strip heavy image payloads so the ticket metadata saves successfully
      };
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      let reps: ReplicationRequest[] = stored ? JSON.parse(stored) : DEFAULT_REPLICATIONS;
      
      const index = reps.findIndex(r => r.id === cleanReplication.id);
      if (index >= 0) {
        reps[index] = cleanReplication;
      } else {
        reps.push(cleanReplication);
      }
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reps));
      console.log('Successfully saved replication request metadata (images omitted to fit browser storage quota).');
    } catch (retryError) {
      console.error('Failed to save replication request even without images:', retryError);
    }
  }
};
