import type { Interval } from './types';

export const MINUTE = 60_000;

/** Round a timestamp up to the next multiple of `stepMinutes` (local grids line up because UTC offsets are multiples of 15 min). */
export function ceilTo(ms: number, stepMinutes: number): number {
  const step = stepMinutes * MINUTE;
  return Math.ceil(ms / step) * step;
}

/** Sort and merge overlapping or touching intervals. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

/** Remove `busy` from a list of free intervals. */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  const merged = mergeIntervals(busy);
  const out: Interval[] = [];
  for (const f of free) {
    let cursor = f.start;
    for (const b of merged) {
      if (b.end <= cursor) continue;
      if (b.start >= f.end) break;
      if (b.start > cursor) out.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
      if (cursor >= f.end) break;
    }
    if (cursor < f.end) out.push({ start: cursor, end: f.end });
  }
  return out;
}

/** Restrict free intervals to [start, end). */
export function clipIntervals(list: Interval[], start: number, end: number): Interval[] {
  const out: Interval[] = [];
  for (const i of list) {
    const s = Math.max(i.start, start);
    const e = Math.min(i.end, end);
    if (e > s) out.push({ start: s, end: e });
  }
  return out;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function pad(i: Interval, minutes: number): Interval {
  return { start: i.start - minutes * MINUTE, end: i.end + minutes * MINUTE };
}
