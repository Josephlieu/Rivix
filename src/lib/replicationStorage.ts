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
  /** When the customer's parcel arrived at RIVIX (set from the inbound parcel card). */
  inboundReceivedAt?: string;
  /** True when the customer is posting the real garment to RIVIX (otherwise photos only). */
  garmentPosted?: boolean;
  annotations: Array<{
    id: string;
    x: number; // percentage from left
    y: number; // percentage from top
    title: string;
    description: string;
  }>;
  aiAnalysis?: PersistedGarmentAIAnalysis;
}

export interface ReplicationRequest {
  id: string;
  requestCode?: string; // readable number such as RQ-0001; show this instead of the id
  repId?: string | null; // the sales rep who owns the request; empty = the admin handles it directly
  repName?: string | null;
  createdByRole?: string | null;
  createdByName?: string | null;
  clientName: string;
  productName: string;
  garmentType: 'overalls' | 'parka' | 'jacket' | 'pants' | 'vest' | 'hoodie' | 'coat';
  status: 'received' | 'spec_mapped' | 'sample_production' | 'sample_shipped';
  submissionDate: string;
  images: string[]; // short-lived private links to the photos, in display order
  imagePaths?: string[]; // where the photos live in private storage (same order as images)
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

// Requests live in the database and are reached only through the server routes, which check the signed-in role
// (an admin sees all requests; a sales rep sees only their own; customers are never connected to the queue).
// There is deliberately NO fallback to browser storage: if something fails the caller gets an
// Error with a readable message, so a failed save is never mistaken for a successful one.
const API = '/api/replications';

const fail = async (res: Response, fallback: string): Promise<never> => {
  if (res.status === 401) throw new Error('Your sign-in has expired. Reload this page (or sign in again), then try again.');
  const data = await res.json().catch(() => ({}));
  throw new Error(typeof data?.error === 'string' ? data.error : fallback);
};

export const getReplications = async (): Promise<ReplicationRequest[]> => {
  const res = await fetch(API, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load the replication requests.');
  return (await res.json()).replications as ReplicationRequest[];
};

/** One request by id or readable number (RQ-0001). Returns null when it does not exist. */
export const getReplication = async (idOrCode: string): Promise<ReplicationRequest | null> => {
  const res = await fetch(`${API}/${encodeURIComponent(idOrCode)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, 'Could not load the request.');
  return (await res.json()).replication as ReplicationRequest;
};

/** Create a request (no photos yet; add them with uploadReplicationPhoto). Returns the saved request. */
export const createReplication = async (
  r: Pick<ReplicationRequest, 'clientName' | 'productName' | 'garmentType'> & Partial<ReplicationRequest>
): Promise<ReplicationRequest> => {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
  if (!res.ok) await fail(res, 'Could not create the request.');
  return (await res.json()).replication as ReplicationRequest;
};

/** Save changes to a request. Returns the saved request (fresh photo links included). */
export const saveReplication = async (replication: ReplicationRequest, opts: { approve?: boolean } = {}): Promise<ReplicationRequest> => {
  const res = await fetch(`${API}/${encodeURIComponent(replication.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...replication, approve: opts.approve === true }),
  });
  if (!res.ok) await fail(res, 'Could not save the request.');
  return (await res.json()).replication as ReplicationRequest;
};

export const uploadReplicationPhoto = async (id: string, file: File): Promise<ReplicationRequest> => {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${API}/${encodeURIComponent(id)}/photos`, { method: 'POST', body: form });
  if (!res.ok) await fail(res, 'Could not add the photo.');
  return (await res.json()).replication as ReplicationRequest;
};

export const deleteReplication = async (id: string): Promise<void> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) await fail(res, 'Could not delete the request.');
};

// ---- Chat between the sales rep and the admin on one request ----------------------------------------------
export interface ChatMessage { id: string; senderRole: 'admin' | 'rep'; senderName: string; message: string; timestamp: string }

export const getChatMessages = async (id: string): Promise<ChatMessage[]> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/messages`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load the chat.');
  return (await res.json()).messages as ChatMessage[];
};

export const sendChatMessage = async (id: string, message: string): Promise<ChatMessage> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
  if (!res.ok) await fail(res, 'Could not send the message.');
  return (await res.json()).message as ChatMessage;
};

// ---- New-request form suggestions and the tech file download log -----------------------------------------
export interface ReplicationLookups { role: 'admin' | 'rep'; repName: string | null; customers: string[]; reps: Array<{ id: string; name: string }> }

export const getReplicationLookups = async (): Promise<ReplicationLookups> => {
  const res = await fetch(`${API}/lookups`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load the form options.');
  return (await res.json()) as ReplicationLookups;
};

export interface DownloadEntry { id: string; by: string | null; role: string | null; revision: number | null; approved: boolean | null; at: string }

export const getDownloadLog = async (id: string): Promise<DownloadEntry[]> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/downloads`, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()).downloads as DownloadEntry[];
};

/** Best effort: a failed log must never stop the file from being made. */
export const logDownload = async (id: string, revision: number, approved: boolean): Promise<void> => {
  try {
    await fetch(`${API}/${encodeURIComponent(id)}/downloads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, approved }) });
  } catch { /* ignore */ }
};
