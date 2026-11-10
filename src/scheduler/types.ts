/** ISO 8601 datetime string, e.g. "2026-11-12T17:00:00.000Z". */
export type ISODate = string;

/** Recurring busy time, e.g. "Work, Mon–Fri, 09:00–17:00". */
export interface Routine {
  id: string;
  label: string;
  /** Days of the week it happens on: 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Local time "HH:mm". */
  startTime: string;
  /** Local time "HH:mm". If it is not after startTime the routine ends the next day (e.g. Sleep 23:00–07:00). */
  endTime: string;
  color: string;
  /** Local date "yyyy-MM-dd" from which the routine applies. */
  activeFrom: string;
  /** Optional local date "yyyy-MM-dd" after which the routine stops. */
  activeUntil?: string;
  /** Local dates "yyyy-MM-dd" (of the occurrence's start) that are skipped. */
  skipDates: string[];
}

/** A one-off period when you are not available. */
export interface BusyBlock {
  id: string;
  label: string;
  start: ISODate;
  end: ISODate;
  color: string;
}

export type SplitOverride = 'one-sitting' | 'allow-split';

export interface Task {
  id: string;
  title: string;
  durationMinutes: number;
  deadline: ISODate;
  earliestStart?: ISODate;
  priority: 'normal' | 'high';
  /** Normally undefined: the scheduler decides whether to split. */
  splitOverride?: SplitOverride;
  /** Minutes of work already done (from check-ins). */
  minutesDone: number;
  done: boolean;
  createdAt: ISODate;
}

/** A piece of a task placed on the timetable. */
export interface ScheduledChunk {
  taskId: string;
  start: ISODate;
  end: ISODate;
  /** Pinned by the user; the scheduler will not move it. */
  locked: boolean;
}

export interface Settings {
  /** Gap kept between a task and anything around it. */
  bufferMinutes: number;
  /** Nothing new is scheduled to start sooner than this from now. */
  leadTimeMinutes: number;
}

/** Half-open interval [start, end) in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

export type WarningKind = 'cant-fit' | 'overdue' | 'locked-conflict' | 'bad-window';

export interface TaskWarning {
  taskId: string;
  kind: WarningKind;
  /** Minutes of the task that could not be placed (for cant-fit / overdue). */
  shortMinutes?: number;
  message: string;
}

export interface TaskPlan {
  taskId: string;
  /** When the last scheduled piece ends (epoch ms), if anything is scheduled. */
  finish?: number;
  /** Minutes between the planned finish and the deadline (negative = after the deadline). */
  spareMinutes?: number;
  /** Whether the scheduler chose to split the task into several chunks. */
  split: boolean;
  /** Minutes still to place after this run (0 when fully scheduled). */
  unplacedMinutes: number;
}

export interface ScheduleInput {
  routines: Routine[];
  blocks: BusyBlock[];
  tasks: Task[];
  /** Chunks that must stay where they are: locked ones and ones already under way. */
  fixedChunks: ScheduledChunk[];
  settings: Settings;
  /** Current time, epoch ms. */
  now: number;
}

export interface ScheduleResult {
  /** All chunks, fixed ones included, sorted by start. */
  chunks: ScheduledChunk[];
  warnings: TaskWarning[];
  plans: Record<string, TaskPlan>;
}
