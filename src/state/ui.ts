import { create } from 'zustand';

export type Tab = 'calendar' | 'tasks' | 'routines' | 'settings';

export type SheetState =
  | { kind: 'task'; taskId?: string }
  | { kind: 'block'; blockId?: string; start?: string }
  | { kind: 'routine'; routineId?: string; preset?: { label: string; days: number[]; startTime: string; endTime: string } }
  | { kind: 'chunk'; taskId: string; start: string }
  | { kind: 'occurrence'; routineId: string; dateKey: string; start: number; end: number }
  | null;

interface UIState {
  tab: Tab;
  sheet: SheetState;
  /** One-off message such as "Scheduled: Tue 10:00–11:30". */
  toast: string | null;
  setTab: (t: Tab) => void;
  open: (s: SheetState) => void;
  close: () => void;
  showToast: (msg: string | null) => void;
}

export const useUI = create<UIState>((set) => ({
  tab: 'calendar',
  sheet: null,
  toast: null,
  setTab: (tab) => set({ tab }),
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  showToast: (toast) => set({ toast }),
}));
