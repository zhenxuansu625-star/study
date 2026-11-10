/**
 * Tunable rules for the scheduler. All values are in minutes.
 * Change these to adjust how tasks are split and placed.
 */
export const SCHEDULER_CONFIG = {
  /** Grid that start times snap to. */
  slotMinutes: 15,

  /** Tasks this long or shorter always stay in one sitting. */
  shortTaskMaxMinutes: 60,
  /**
   * Tasks up to this long prefer one sitting, unless splitting would finish
   * them more than `oneSittingMaxDelayMinutes` sooner.
   */
  mediumTaskMaxMinutes: 150,
  oneSittingMaxDelayMinutes: 24 * 60,

  /** Smallest chunk worth doing. */
  minChunkMinutes: 45,
  /** A final leftover chunk may be this short. */
  minFinalChunkMinutes: 30,
  /** Longest single sitting before a break. */
  maxChunkMinutes: 120,

  /** High-priority tasks are ordered as if their deadline were this much earlier. */
  highPriorityBoostMinutes: 6 * 60,

  /** Overdue tasks are still placed, as soon as possible, within this window. */
  overdueWindowMinutes: 7 * 24 * 60,
} as const;

export type SchedulerConfig = typeof SCHEDULER_CONFIG;
