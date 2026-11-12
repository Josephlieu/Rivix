import type { PersistedGarmentAIAnalysis } from './garmentAiAnalysis';
import type { GarmentCategory, GarmentType } from './garment-types-data';
import type { TemplateCatalog } from './template-catalog';
import type { WebFound } from './link-source';

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
  /** Care text the customer copied from the label (optional; the AI never writes care text). */
  careText?: string;
  /** When the customer's parcel arrived at RIVIX (set from the inbound parcel card). */
  inboundReceivedAt?: string;
  /** True when the customer is posting the real garment to RIVIX (otherwise photos only). */
  garmentPosted?: boolean;
  /** Task 21: the product page the request started from (set by the server only; admins only). Read with readWebSource(). */
  webSource?: unknown;
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
  garmentType: string; // the key of a garment type (see garment-types-data.ts); show it with garmentTypeLabel()
  status: 'received' | 'spec_mapped' | 'sample_production' | 'sample_shipped';
  submissionDate: string;
  images: string[]; // short-lived private links to the photos, in display order
  imagePaths?: string[]; // where the photos live in private storage (same order as images)
  imageLabels?: string[]; // task 21: "Reference image from <site>" for photos taken from a website, '' for the others
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
  /** Task 30: when the request was archived (it then leaves the queue); null = not archived. */
  archivedAt?: string | null;
  /** Task 30, set on a save's reply only: the approval stands but its PDF could not be stored. */
  pdfWarning?: string;
  /** Saved Gemini tech pack — persists across refresh */
  aiAnalysis?: PersistedGarmentAIAnalysis | null; // admin only: always null for a sales rep
  /** Where the tech file is, without its content (sent to reps and admins). */
  techFile?: { status: 'none' | 'draft' | 'approved'; revision: number };
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
  r: Pick<ReplicationRequest, 'clientName' | 'productName' | 'garmentType'> & Partial<ReplicationRequest> & { linkRead?: { readId: string; images: number[] } }
): Promise<ReplicationRequest> => {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
  if (!res.ok) await fail(res, 'Could not create the request.');
  return (await res.json()).replication as ReplicationRequest;
};

/** Save changes to a request. Returns the saved request (fresh photo links included). */
export const saveReplication = async (replication: ReplicationRequest, opts: { approve?: boolean; newDraft?: boolean } = {}): Promise<ReplicationRequest> => {
  const { pdfWarning: _w, ...rest } = replication; // eslint-disable-line @typescript-eslint/no-unused-vars
  const res = await fetch(`${API}/${encodeURIComponent(replication.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...rest, approve: opts.approve === true, newDraft: opts.newDraft === true }),
  });
  if (!res.ok) await fail(res, 'Could not save the request.');
  const j = await res.json();
  return { ...(j.replication as ReplicationRequest), ...(j.pdfWarning ? { pdfWarning: j.pdfWarning as string } : {}) };
};

// ---- Task 30: revision history, customer approvals, archive (admin only) ----------------------------------------------------
export interface RevisionApproval { id: string; fileName: string; fileType: string; fileSize: number; sha256: string; approvedBy: string; approvedOn: string; note: string; uploadedBy: string; at: string }
export interface RevisionEntry { id: string; seq: number; status: 'draft' | 'approved'; revision: number; changes: string[]; templateVersions: Array<{ key: string; version: number }>; drawing: { key: string; version: number | null; parts?: Array<{ key: string; version: number | null }> } | null; pdf: { sha256: string } | null; by: string; at: string; approvals: RevisionApproval[] }
export const getRevisions = async (id: string): Promise<{ revisions: RevisionEntry[]; missing?: boolean }> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/revisions`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load the revision history.');
  return res.json();
};
export const compareRevisions = async (id: string, from: number, to: number): Promise<string[]> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/revisions/compare?from=${from}&to=${to}`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not compare the revisions.');
  return (await res.json()).changes as string[];
};
export const revisionPdfLink = async (id: string, seq: number): Promise<string> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/revisions/${seq}/pdf`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not get the PDF.');
  return (await res.json()).url as string;
};
export const makeRevisionPdf = async (id: string, seq: number): Promise<void> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/revisions/${seq}/pdf`, { method: 'POST' });
  if (!res.ok) await fail(res, 'Could not make the PDF.');
};
export const attachCustomerApproval = async (id: string, seq: number, form: FormData): Promise<void> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/revisions/${seq}/approvals`, { method: 'POST', body: form });
  if (!res.ok) await fail(res, 'Could not attach the approval.');
};
export const approvalFileLink = async (id: string, approvalId: string): Promise<string> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/approvals/${encodeURIComponent(approvalId)}`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not get the file.');
  return (await res.json()).url as string;
};
export const archiveReplication = async (id: string, archived: boolean): Promise<ReplicationRequest> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/archive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }) });
  if (!res.ok) await fail(res, archived ? 'Could not archive the request.' : 'Could not restore the request.');
  return (await res.json()).replication as ReplicationRequest;
};

/** Task 28: ask the AI to suggest the product type from the photos (admin only). Saves the suggestion; the type does not change. */
export const suggestReplicationType = async (id: string): Promise<{ replication: ReplicationRequest; note?: string }> => {
  const res = await fetch('/api/analyze-garment/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replicationId: id }) });
  if (!res.ok) await fail(res, 'Could not suggest a product type.');
  const j = await res.json();
  return { replication: j.replication as ReplicationRequest, note: j.note };
};

/** Task 28: confirm the request's product type (admin only). The AI scan needs this first. */
export const confirmReplicationType = async (id: string, typeKey: string): Promise<ReplicationRequest> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/type`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ typeKey }) });
  if (!res.ok) await fail(res, 'Could not confirm the product type.');
  return (await res.json()).replication as ReplicationRequest;
};

/** Task 21: what an admin's read of a product page found (the server keeps the rest; the request takes it by readId). */
export interface LinkReadResult {
  readId: string;
  finalUrl: string;
  site: string;
  found: WebFound;
  images: Array<{ index: number; thumb: string; width: number; height: number }>;
  notes: string[];
}
export const readProductLink = async (url: string): Promise<LinkReadResult> => {
  const res = await fetch(`${API}/read-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  if (!res.ok) await fail(res, 'The page could not be read.');
  return (await res.json()) as LinkReadResult;
};

export const uploadReplicationPhoto = async (id: string, file: File): Promise<ReplicationRequest> => {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${API}/${encodeURIComponent(id)}/photos`, { method: 'POST', body: form });
  if (!res.ok) await fail(res, 'Could not add the photo.');
  return (await res.json()).replication as ReplicationRequest;
};

/** Deletes a request. A request with an approved tech file or a customer approval is refused (task 30): the Error then has
 *  code "archive-instead", and the caller offers to archive it. */
export const deleteReplication = async (id: string): Promise<void> => {
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (res.status === 409) {
    const j = await res.json().catch(() => ({}));
    throw Object.assign(new Error(j.error || 'This request cannot be deleted: archive it instead.'), { code: j.code as string | undefined });
  }
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

export interface GarmentLibraryData { categories: GarmentCategory[]; types: GarmentType[]; editable: boolean; templates?: TemplateCatalog }

/** The garment categories and types for the new-request form (admins can ask for the inactive ones too). */
export const getGarmentTypes = async (all = false): Promise<GarmentLibraryData> => {
  const res = await fetch(`${API}/garment-types${all ? '?all=1' : ''}`, { cache: 'no-store' });
  if (!res.ok) await fail(res, 'Could not load the garment types.');
  return (await res.json()) as GarmentLibraryData;
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
