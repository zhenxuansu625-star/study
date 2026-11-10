import { addDays, format, parseISO, startOfDay } from 'date-fns';
import type { Routine } from './types';

export interface RoutineOccurrence {
  /** Stable id: `${routineId}@${dateKey}`. */
  id: string;
  routineId: string;
  label: string;
  color: string;
  /** Local date of the occurrence's start, "yyyy-MM-dd". */
  dateKey: string;
  start: number;
  end: number;
}

export function parseHM(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return { hours: h || 0, minutes: m || 0 };
}

/** Set the local wall-clock time on a given day (DST-safe). */
function atLocalTime(day: Date, hm: string): Date {
  const { hours, minutes } = parseHM(hm);
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function dateKey(d: Date | number): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Expand routines into concrete occurrences overlapping [from, to).
 * Occurrences that cross midnight belong to the day they start on.
 */
export function expandRoutines(routines: Routine[], from: number, to: number): RoutineOccurrence[] {
  const out: RoutineOccurrence[] = [];
  if (to <= from) return out;
  for (const r of routines) {
    if (r.days.length === 0) continue;
    const activeFrom = startOfDay(parseISO(r.activeFrom)).getTime();
    const activeUntil = r.activeUntil ? startOfDay(parseISO(r.activeUntil)).getTime() : Infinity;
    const skip = new Set(r.skipDates);
    // Start one day early so an overnight occurrence from yesterday is included.
    let day = startOfDay(addDays(new Date(from), -1));
    while (day.getTime() < to) {
      const dayMs = day.getTime();
      const key = dateKey(day);
      if (r.days.includes(day.getDay()) && dayMs >= activeFrom && dayMs <= activeUntil && !skip.has(key)) {
        const start = atLocalTime(day, r.startTime);
        let end = atLocalTime(day, r.endTime);
        if (end.getTime() <= start.getTime()) end = atLocalTime(addDays(day, 1), r.endTime);
        if (end.getTime() > from && start.getTime() < to) {
          out.push({
            id: `${r.id}@${key}`,
            routineId: r.id,
            label: r.label,
            color: r.color,
            dateKey: key,
            start: start.getTime(),
            end: end.getTime(),
          });
        }
      }
      day = addDays(day, 1);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
