import { SCHEDULER_CONFIG, type SchedulerConfig } from './config';
import { MINUTE, ceilTo, clipIntervals, mergeIntervals, overlaps, pad, subtractIntervals } from './intervals';
import { expandRoutines } from './routines';
import { decidePlacement } from './splitDecision';
import type {
  Interval,
  ScheduleInput,
  ScheduleResult,
  ScheduledChunk,
  Task,
  TaskPlan,
  TaskWarning,
} from './types';

const toMs = (iso: string) => new Date(iso).getTime();
const toISO = (ms: number) => new Date(ms).toISOString();

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

/**
 * Order tasks: earliest (priority-adjusted) deadline first, then longest first.
 * Earliest-Deadline-First minimises missed deadlines; longest-first gives big tasks first pick of big gaps.
 */
export function orderTasks(tasks: Task[], cfg: SchedulerConfig = SCHEDULER_CONFIG): Task[] {
  const key = (t: Task) => toMs(t.deadline) - (t.priority === 'high' ? cfg.highPriorityBoostMinutes * MINUTE : 0);
  return [...tasks].sort(
    (a, b) => key(a) - key(b) || b.durationMinutes - a.durationMinutes || a.id.localeCompare(b.id),
  );
}

/**
 * Build the timetable. Pure function: same input, same output.
 *
 * 1. Free time = [now + lead time, latest deadline) minus routines, blocks and fixed chunks (all padded by the buffer).
 * 2. Tasks are placed in deadline order, each as early as possible before its deadline.
 * 3. Whether a task is split is decided by `decidePlacement` (see splitDecision.ts).
 * 4. Anything that cannot be fully placed produces a warning.
 */
export function schedule(input: ScheduleInput, cfg: SchedulerConfig = SCHEDULER_CONFIG): ScheduleResult {
  const { routines, blocks, tasks, settings, now } = input;
  const buffer = settings.bufferMinutes;
  const warnings: TaskWarning[] = [];
  const plans: Record<string, TaskPlan> = {};

  const active = tasks.filter((t) => !t.done);
  const activeIds = new Set(active.map((t) => t.id));
  const fixed = input.fixedChunks.filter((c) => activeIds.has(c.taskId) && toMs(c.end) > now);
  const chunks: ScheduledChunk[] = [...fixed];

  const earliest = ceilTo(now + settings.leadTimeMinutes * MINUTE, cfg.slotMinutes);

  // Work out each task's placement window up front, to know how far ahead to look.
  const windows = new Map<string, Interval>();
  let horizon = earliest;
  for (const t of active) {
    const deadline = toMs(t.deadline);
    const start = Math.max(earliest, t.earliestStart ? ceilTo(toMs(t.earliestStart), cfg.slotMinutes) : earliest);
    const end = deadline > start ? deadline : start + cfg.overdueWindowMinutes * MINUTE;
    windows.set(t.id, { start, end });
    horizon = Math.max(horizon, end);
  }

  // Busy time over the whole horizon.
  const routineBusy = expandRoutines(routines, Math.min(now, earliest), horizon);
  const blockBusy = blocks.map((b) => ({ start: toMs(b.start), end: toMs(b.end) }));
  const hardBusy: Interval[] = [...routineBusy, ...blockBusy];

  // Locked/in-progress chunks that now clash with busy time.
  for (const c of fixed) {
    const ci = { start: toMs(c.start), end: toMs(c.end) };
    if (c.locked && hardBusy.some((b) => overlaps(b, ci))) {
      warnings.push({
        taskId: c.taskId,
        kind: 'locked-conflict',
        message: 'A locked session overlaps something you are busy with.',
      });
    }
  }

  const fixedBusy = fixed.map((c) => ({ start: toMs(c.start), end: toMs(c.end) }));
  let free = subtractIntervals(
    [{ start: earliest, end: horizon }],
    mergeIntervals([...hardBusy, ...fixedBusy].map((i) => pad(i, buffer))),
  );

  for (const t of orderTasks(active, cfg)) {
    const fixedForTask = fixed.filter((c) => c.taskId === t.id);
    const fixedMinutes = fixedForTask.reduce((s, c) => s + (toMs(c.end) - toMs(c.start)) / MINUTE, 0);
    const remaining = Math.max(0, Math.round(t.durationMinutes - t.minutesDone - fixedMinutes));
    const deadline = toMs(t.deadline);
    const win = windows.get(t.id)!;
    const overdue = deadline <= earliest;

    let placed: Interval[] = [];
    let split = false;
    let unplaced = 0;

    if (t.earliestStart && toMs(t.earliestStart) >= deadline && !overdue) {
      warnings.push({
        taskId: t.id,
        kind: 'bad-window',
        shortMinutes: remaining,
        message: '"Not before" is after the deadline.',
      });
      unplaced = remaining;
    } else if (remaining > 0) {
      const gaps = clipIntervals(free, win.start, win.end);
      const decision = decidePlacement(gaps, remaining, buffer, t.splitOverride, cfg);
      placed = decision.chunks;
      split = decision.split;
      const placedMinutes = placed.reduce((s, i) => s + (i.end - i.start) / MINUTE, 0);
      unplaced = Math.max(0, remaining - Math.round(placedMinutes));

      if (overdue) {
        warnings.push({
          taskId: t.id,
          kind: 'overdue',
          shortMinutes: unplaced || undefined,
          message: unplaced
            ? `Overdue, and ${formatMinutes(unplaced)} couldn't be fitted in the next week.`
            : 'Overdue: scheduled as soon as possible.',
        });
      } else if (unplaced > 0) {
        warnings.push({
          taskId: t.id,
          kind: 'cant-fit',
          shortMinutes: unplaced,
          message: `Can't fit before the deadline: short by ${formatMinutes(unplaced)}.`,
        });
      }

      free = subtractIntervals(free, placed.map((i) => pad(i, buffer)));
      for (const i of placed) {
        chunks.push({ taskId: t.id, start: toISO(i.start), end: toISO(i.end), locked: false });
      }
    }

    const allEnds = [...fixedForTask.map((c) => toMs(c.end)), ...placed.map((i) => i.end)];
    const finish = allEnds.length ? Math.max(...allEnds) : undefined;
    plans[t.id] = {
      taskId: t.id,
      finish,
      spareMinutes: finish !== undefined ? Math.round((deadline - finish) / MINUTE) : undefined,
      split: split || fixedForTask.length + placed.length > 1,
      unplacedMinutes: unplaced,
    };
  }

  chunks.sort((a, b) => toMs(a.start) - toMs(b.start));
  return { chunks, warnings, plans };
}
