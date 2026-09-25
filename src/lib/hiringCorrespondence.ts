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

export const DEFAULT_CANDIDATE_CHATS: Record<string, CorrespondenceMessage[]> = {
  'cand-test-sol': [
    {
      id: 'c1',
      sender: 'admin',
      senderName: 'Sol (RIVIX CEO)',
      text: 'Hi Solomon — this is your test candidate profile. Use Schedule Call or send a real message below.',
      timestamp: '2026-05-31T10:00:00Z',
      channel: 'email',
      deliveryStatus: 'simulated',
    },
    {
      id: 'c2',
      sender: 'candidate',
      senderName: 'Solomon Riby-Williams',
      text: 'Perfect — testing resume embed and correspondence from solgoody@gmail.com.',
      timestamp: '2026-05-31T10:05:00Z',
      channel: 'email',
      deliveryStatus: 'simulated',
    },
  ],
  'cand-indeed-1': [
    {
      id: 'c1',
      sender: 'admin',
      senderName: 'Sol (RIVIX CEO)',
      text: 'Hi Leanne, we reviewed your Indeed B2B strategist application. We would love to set up a Zoom speed-screening call.',
      timestamp: '2026-05-28T10:00:00Z',
      channel: 'email',
      deliveryStatus: 'simulated',
    },
    {
      id: 'c2',
      sender: 'candidate',
      senderName: 'Leanne Dumas',
      text: "Hi Sol! I would love to connect. I have been following RIVIX's expansion in safety garments and have direct contacts with industrial accounts.",
      timestamp: '2026-05-28T10:15:00Z',
      channel: 'email',
      deliveryStatus: 'simulated',
    },
  ],
  'cand-indeed-2': [
    { id: 'c1', sender: 'admin', senderName: 'Sol (RIVIX CEO)', text: "Hi Eduardo, we saw your heavy industry safety supply B2B sales management profile. Let's schedule a brief Zoom call.", timestamp: '2026-05-28T11:00:00Z', channel: 'email', deliveryStatus: 'simulated' },
    { id: 'c2', sender: 'candidate', senderName: 'Eduardo Dela Cruz', text: 'Sounds great. I am highly familiar with Fort McMurray oil sands safety contracts.', timestamp: '2026-05-28T11:20:00Z', channel: 'email', deliveryStatus: 'simulated' },
  ],
  'cand-indeed-3': [
    { id: 'c1', sender: 'admin', senderName: 'Sol (RIVIX CEO)', text: 'Hi Dwight, certified Journeyman Partsman with 30 years? Incredible. We would love to chat.', timestamp: '2026-05-28T12:00:00Z', channel: 'email', deliveryStatus: 'simulated' },
    { id: 'c2', sender: 'candidate', senderName: 'Dwight Kerr', text: 'Thank you. I have active safety managers inside Nisku ready to review RIVIX overalls.', timestamp: '2026-05-28T12:10:00Z', channel: 'email', deliveryStatus: 'simulated' },
  ],
  'cand-indeed-4': [
    { id: 'c1', sender: 'admin', senderName: 'Sol (RIVIX CEO)', text: "Hi Matthew, B2B Relationship Manager with college partnerships. Let's discuss representing RIVIX in AB.", timestamp: '2026-05-28T13:00:00Z', channel: 'email', deliveryStatus: 'simulated' },
    { id: 'c2', sender: 'candidate', senderName: 'Matthew Marois', text: 'Hello Sol. Looking forward to discussing. I have strong experience negotiating institutional contract renewals.', timestamp: '2026-05-28T13:30:00Z', channel: 'email', deliveryStatus: 'simulated' },
  ],
  'cand-indeed-5': [
    { id: 'c1', sender: 'admin', senderName: 'Sol (RIVIX CEO)', text: 'Hi Jaspreet, your Territory Sales Representative and Mechanical Engineering background is interesting.', timestamp: '2026-05-28T14:00:00Z', channel: 'email', deliveryStatus: 'simulated' },
    { id: 'c2', sender: 'candidate', senderName: 'Jaspreet Singh', text: 'Thanks Sol. I specialize in territory optimization and closing contracts with heavy mechanical supply distributors.', timestamp: '2026-05-28T14:15:00Z', channel: 'email', deliveryStatus: 'simulated' },
  ],
  'cand-indeed-6': [
    { id: 'c1', sender: 'admin', senderName: 'Sol (RIVIX CEO)', text: "Hi Petref, noticed you had experience selling for Mark's. Let's schedule a call to see if you can translate that to B2B.", timestamp: '2026-05-30T10:00:00Z', channel: 'email', deliveryStatus: 'simulated' },
    { id: 'c2', sender: 'candidate', senderName: 'Petref Vila', text: "Thank you Sol, I know the Mark's playbook and can definitely bring high B2B energy to RIVIX!", timestamp: '2026-05-30T10:30:00Z', channel: 'email', deliveryStatus: 'simulated' },
  ],
  'cand-indeed-7': [
    { id: 'c1', sender: 'admin', senderName: 'Sol (RIVIX CEO)', text: 'Hi Anthony, your background as a Sales Consultant at UniFirst is exactly what we are looking for to build our competitive sales strategy. Do you have time to chat?', timestamp: '2026-05-30T10:30:00Z', channel: 'email', deliveryStatus: 'simulated' },
    { id: 'c2', sender: 'candidate', senderName: 'Anthony Di Ponio', text: "Absolutely Sol. I know exactly how UniFirst locks companies into rental contracts. I'd love to discuss how RIVIX can disrupt them.", timestamp: '2026-05-30T11:00:00Z', channel: 'email', deliveryStatus: 'simulated' },
  ],
};

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