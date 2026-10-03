import { Bell, Package, FileText, Truck, MessageSquare, CheckCircle, Sparkles, UserPlus, UserMinus, UserCog } from 'lucide-react';

// Icon and colour for each kind of notification (used by the bell and the full page).
export const notificationIcon = (kind: string) => {
  switch (kind) {
    case 'order_created': return { Icon: Package, color: 'bg-emerald-50 text-emerald-600' };
    case 'new_order': return { Icon: Package, color: 'bg-rivix/10 text-rivix' };
    case 'stage_changed': return { Icon: Truck, color: 'bg-amber-50 text-amber-600' };
    case 'document_added': return { Icon: FileText, color: 'bg-sky-50 text-sky-600' };
    case 'document_request': return { Icon: MessageSquare, color: 'bg-violet-50 text-violet-600' };
    case 'customer_request': return { Icon: MessageSquare, color: 'bg-violet-50 text-violet-600' };
    case 'request_update': return { Icon: MessageSquare, color: 'bg-sky-50 text-sky-600' };
    case 'request_done': return { Icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' };
    case 'customer_assigned': return { Icon: UserPlus, color: 'bg-emerald-50 text-emerald-600' };
    case 'customer_unassigned': return { Icon: UserMinus, color: 'bg-slate-100 text-slate-500' };
    case 'rep_changed': return { Icon: UserCog, color: 'bg-sky-50 text-sky-600' };
    case 'welcome': return { Icon: Sparkles, color: 'bg-rivix/10 text-rivix' };
    default: return { Icon: Bell, color: 'bg-slate-100 text-slate-500' };
  }
};

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
};

export const notificationsPath = (mode: 'admin' | 'client' | 'rep') =>
  mode === 'admin' ? '/admin/notifications' : mode === 'rep' ? '/rep/notifications' : '/portal/notifications';
