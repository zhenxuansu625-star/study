import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  MINUTE,
  schedule,
  type BusyBlock,
  type Routine,
  type ScheduledChunk,
  type Settings,
  type Task,
  type TaskPlan,
  type TaskWarning,
} from '../scheduler';
import { buildDemoData } from './demo';

export type CheckinStatus = 'done' | 'partial' | 'missed';

/** A past session and what you said happened. */
export interface HistoryEntry {
  taskId: string;
  title: string;
  start: string;
  end: string;
  status: CheckinStatus;
  minutes: number;
}

export interface PersistedData {
  tasks: Task[];
  blocks: BusyBlock[];
  routines: Routine[];
  settings: Settings;
  /** Last computed plan, kept so sessions under way stay put and past ones can be checked in. */
  chunks: ScheduledChunk[];
  /** Past sessions waiting for "Did you do it?". */
  checkins: ScheduledChunk[];
  history: HistoryEntry[];
  onboarded: boolean;
}

interface Derived {
  warnings: TaskWarning[];
  plans: Record<string, TaskPlan>;
  /** Short message shown after a change, e.g. "3 tasks rescheduled". */
  notice: string | null;
}

interface Actions {
  /** Recompute the plan. Returns the ids of tasks whose sessions moved. */
  reschedule: (opts?: { ignoreTaskId?: string; announce?: boolean }) => string[];
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'minutesDone' | 'done'>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskDone: (id: string, done: boolean) => void;
  addBlock: (b: Omit<BusyBlock, 'id'>) => void;
  updateBlock: (id: string, patch: Partial<BusyBlock>) => void;
  deleteBlock: (id: string) => void;
  addRoutine: (r: Omit<Routine, 'id' | 'skipDates'>) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  skipOccurrence: (routineId: string, dateKey: string) => void;
  toggleLock: (taskId: string, start: string) => void;
  answerCheckin: (chunk: ScheduledChunk, fractionDone: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setOnboarded: () => void;
  dismissNotice: () => void;
  importData: (json: string) => string | null;
  exportData: () => string;
  loadDemo: () => void;
  resetAll: () => void;
}

export type AppState = PersistedData & Derived & Actions;

export const DEFAULT_SETTINGS: Settings = { bufferMinutes: 10, leadTimeMinutes: 15 };

const EMPTY: PersistedData = {
  tasks: [],
  blocks: [],
  routines: [],
  settings: DEFAULT_SETTINGS,
  chunks: [],
  checkins: [],
  history: [],
  onboarded: false,
};

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const ms = (iso: string) => new Date(iso).getTime();
const chunkKey = (c: ScheduledChunk) => `${c.taskId}|${c.start}`;

function signature(chunks: ScheduledChunk[], taskId: string) {
  return chunks
    .filter((c) => c.taskId === taskId)
    .map((c) => `${c.start}-${c.end}`)
    .join(',');
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      warnings: [],
      plans: {},
      notice: null,

      reschedule: ({ ignoreTaskId, announce = false } = {}) => {
        const s = get();
        const now = Date.now();
        const taskById = new Map(s.tasks.map((t) => [t.id, t]));
        const live = (c: ScheduledChunk) => {
          const t = taskById.get(c.taskId);
          return !!t && !t.done;
        };

        // Sessions that have finished move to check-in.
        const seen = new Set(s.checkins.map(chunkKey));
        const newlyPast = s.chunks.filter((c) => live(c) && ms(c.end) <= now && !seen.has(chunkKey(c)));
        const checkins = [...s.checkins.filter(live), ...newlyPast].sort((a, b) => ms(a.start) - ms(b.start));

        // Sessions that are locked, under way, or about to start stay where they are.
        const commitBefore = now + s.settings.leadTimeMinutes * MINUTE;
        const fixedChunks = s.chunks.filter(
          (c) => live(c) && ms(c.end) > now && (c.locked || ms(c.start) < commitBefore),
        );

        const result = schedule({
          routines: s.routines,
          blocks: s.blocks,
          tasks: s.tasks,
          fixedChunks,
          settings: s.settings,
          now,
        });

        const moved = s.tasks
          .filter((t) => !t.done && t.id !== ignoreTaskId)
          .filter((t) => s.chunks.some((c) => c.taskId === t.id))
          .filter((t) => signature(s.chunks, t.id) !== signature(result.chunks, t.id))
          .map((t) => t.id);

        set({
          chunks: result.chunks,
          checkins,
          warnings: result.warnings,
          plans: result.plans,
          notice:
            announce && moved.length
              ? `${moved.length} ${ignoreTaskId ? 'other ' : ''}task${moved.length === 1 ? '' : 's'} rescheduled`
              : s.notice,
        });
        return moved;
      },

      addTask: (t) => {
        const id = newId();
        set((s) => ({
          tasks: [...s.tasks, { ...t, id, minutesDone: 0, done: false, createdAt: new Date().toISOString() }],
        }));
        get().reschedule({ ignoreTaskId: id, announce: true });
        return id;
      },
      updateTask: (id, patch) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        get().reschedule({ ignoreTaskId: id, announce: true });
      },
      deleteTask: (id) => {
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          chunks: s.chunks.filter((c) => c.taskId !== id),
          checkins: s.checkins.filter((c) => c.taskId !== id),
        }));
        get().reschedule({ announce: true });
      },
      setTaskDone: (id, done) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done } : t)),
          chunks: done ? s.chunks.filter((c) => c.taskId !== id || ms(c.end) <= Date.now()) : s.chunks,
          checkins: done ? s.checkins.filter((c) => c.taskId !== id) : s.checkins,
        }));
        get().reschedule({ ignoreTaskId: id, announce: true });
      },

      addBlock: (b) => {
        set((s) => ({ blocks: [...s.blocks, { ...b, id: newId() }] }));
        get().reschedule({ announce: true });
      },
      updateBlock: (id, patch) => {
        set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
        get().reschedule({ announce: true });
      },
      deleteBlock: (id) => {
        set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
        get().reschedule({ announce: true });
      },

      addRoutine: (r) => {
        set((s) => ({ routines: [...s.routines, { ...r, id: newId(), skipDates: [] }] }));
        get().reschedule({ announce: true });
      },
      updateRoutine: (id, patch) => {
        set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
        get().reschedule({ announce: true });
      },
      deleteRoutine: (id) => {
        set((s) => ({ routines: s.routines.filter((r) => r.id !== id) }));
        get().reschedule({ announce: true });
      },
      skipOccurrence: (routineId, dateKey) => {
        set((s) => ({
          routines: s.routines.map((r) =>
            r.id === routineId ? { ...r, skipDates: Array.from(new Set([...r.skipDates, dateKey])) } : r,
          ),
        }));
        get().reschedule({ announce: true });
      },

      toggleLock: (taskId, start) => {
        set((s) => ({
          chunks: s.chunks.map((c) => (c.taskId === taskId && c.start === start ? { ...c, locked: !c.locked } : c)),
        }));
        get().reschedule({ announce: true });
      },

      answerCheckin: (chunk, fractionDone) => {
        const minutes = Math.round(((ms(chunk.end) - ms(chunk.start)) / MINUTE) * fractionDone);
        const status: CheckinStatus = fractionDone >= 1 ? 'done' : fractionDone > 0 ? 'partial' : 'missed';
        set((s) => {
          const task = s.tasks.find((t) => t.id === chunk.taskId);
          const tasks = s.tasks.map((t) => {
            if (t.id !== chunk.taskId) return t;
            const minutesDone = Math.min(t.durationMinutes, t.minutesDone + minutes);
            return { ...t, minutesDone, done: minutesDone >= t.durationMinutes };
          });
          return {
            tasks,
            checkins: s.checkins.filter((c) => chunkKey(c) !== chunkKey(chunk)),
            chunks: s.chunks.filter((c) => chunkKey(c) !== chunkKey(chunk)),
            history: [
              ...s.history,
              { taskId: chunk.taskId, title: task?.title ?? '', start: chunk.start, end: chunk.end, status, minutes },
            ],
          };
        });
        get().reschedule({ ignoreTaskId: chunk.taskId });
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        get().reschedule({ announce: true });
      },
      setOnboarded: () => set({ onboarded: true }),
      dismissNotice: () => set({ notice: null }),

      exportData: () => {
        const { tasks, blocks, routines, settings, chunks, checkins, history } = get();
        return JSON.stringify({ version: 1, tasks, blocks, routines, settings, chunks, checkins, history }, null, 2);
      },
      importData: (json) => {
        try {
          const d = JSON.parse(json);
          if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.blocks) || !Array.isArray(d.routines)) {
            return 'That doesn’t look like a timetable backup.';
          }
          set({
            tasks: d.tasks,
            blocks: d.blocks,
            routines: d.routines,
            settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
            chunks: d.chunks ?? [],
            checkins: d.checkins ?? [],
            history: d.history ?? [],
            onboarded: true,
          });
          get().reschedule();
          return null;
        } catch {
          return 'Couldn’t read that text as JSON.';
        }
      },
      loadDemo: () => {
        set({ ...EMPTY, ...buildDemoData(new Date()), onboarded: true });
        get().reschedule();
      },
      resetAll: () => {
        set({ ...EMPTY, onboarded: true, warnings: [], plans: {}, notice: null });
      },
    }),
    {
      name: 'timetable-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): PersistedData => ({
        tasks: s.tasks,
        blocks: s.blocks,
        routines: s.routines,
        settings: s.settings,
        chunks: s.chunks,
        checkins: s.checkins,
        history: s.history,
        onboarded: s.onboarded,
      }),
      onRehydrateStorage: () => (state) => {
        state?.reschedule();
      },
    },
  ),
);
