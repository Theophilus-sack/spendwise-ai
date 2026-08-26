import { create } from 'zustand';

// Screen-local useState resets the moment a screen unmounts, which happens
// every time the user navigates away from Quick Add and back (it's not kept
// mounted in the stack). Holding the in-progress text here instead survives
// that unmount/remount cycle, so a half-typed batch of expenses isn't lost
// just from backing out to check something.
interface DraftState {
  quickAddText: string;
  setQuickAddText: (text: string) => void;
}

export const useDraftStore = create<DraftState>((set) => ({
  quickAddText: '',
  setQuickAddText: (text) => set({ quickAddText: text }),
}));
