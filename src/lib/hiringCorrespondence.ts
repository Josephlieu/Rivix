/** @deprecated SMS channel reserved for future use — UI is email-only for now */
export type CorrespondenceChannel = 'email' | 'sms';

export interface CorrespondenceMessage {
  id: string;
  sender: 'admin' | 'candidate';
  senderName: string;
  text: string;
  timestamp: string;
  channel: CorrespondenceChannel;
  deliveryStatus?: 'sent' | 'failed' | 'simulated';
  deliveryError?: string;
}

const STORAGE_KEY = 'rivix_hiring_correspondence_v1';

// No built-in conversations: the old sample chats (names of earlier candidates) were deleted. The thread only
// holds emails sent from this browser (see the note on the Correspondence tab).
export const DEFAULT_CANDIDATE_CHATS: Record<string, CorrespondenceMessage[]> = {};

export function loadCandidateChats(): Record<string, CorrespondenceMessage[]> {
  if (typeof window === 'undefined') return { ...DEFAULT_CANDIDATE_CHATS };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CANDIDATE_CHATS };
    const parsed = JSON.parse(raw) as Record<string, CorrespondenceMessage[]>;
    return { ...DEFAULT_CANDIDATE_CHATS, ...parsed };
  } catch {
    return { ...DEFAULT_CANDIDATE_CHATS };
  }
}

export function saveCandidateChats(chats: Record<string, CorrespondenceMessage[]>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function appendCandidateMessage(
  chats: Record<string, CorrespondenceMessage[]>,
  candidateId: string,
  message: CorrespondenceMessage
): Record<string, CorrespondenceMessage[]> {
  const next = {
    ...chats,
    [candidateId]: [...(chats[candidateId] || []), message],
  };
  saveCandidateChats(next);
  return next;
}