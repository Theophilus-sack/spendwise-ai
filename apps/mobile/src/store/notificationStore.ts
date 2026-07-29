import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sentAt: string;
  readAt?: string;
}

interface NotificationState {
  items:   NotificationItem[];
  loading: boolean;

  load:     (userId: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  reset:    () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items:   [],
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('notification_log')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(100);
      if (data) set({ items: data.map(remoteToItem) });
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const now = new Date().toISOString();
    set(s => ({ items: s.items.map(n => n.id === id ? { ...n, readAt: now } : n) }));
    await supabase.from('notification_log').update({ read_at: now }).eq('id', id);
  },

  reset: () => set({ items: [], loading: false }),
}));

function remoteToItem(r: Record<string, unknown>): NotificationItem {
  return {
    id: String(r.id), type: String(r.type), title: String(r.title), body: String(r.body),
    data: (r.data as Record<string, unknown>) ?? undefined,
    sentAt: String(r.sent_at), readAt: r.read_at ? String(r.read_at) : undefined,
  };
}
