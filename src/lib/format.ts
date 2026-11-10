import { format, isSameDay, isToday, isTomorrow, isYesterday } from 'date-fns';
import { formatMinutes } from '../scheduler';

type D = Date | number | string;
const toDate = (d: D) => (d instanceof Date ? d : new Date(d));

export const fmtTime = (d: D) => format(toDate(d), 'HH:mm');

export function fmtDay(d: D): string {
  const date = toDate(d);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE d MMM');
}

export const fmtDayTime = (d: D) => `${fmtDay(d)} ${fmtTime(d)}`;

export function fmtRange(start: D, end: D): string {
  const s = toDate(start);
  const e = toDate(end);
  if (isSameDay(s, e)) return `${fmtDay(s)} ${fmtTime(s)}–${fmtTime(e)}`;
  return `${fmtDayTime(s)} – ${fmtDayTime(e)}`;
}

/** "2d 4h", "3h 15m", "20m" */
export function fmtSpan(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  if (m >= 24 * 60) {
    const d = Math.floor(m / (24 * 60));
    const h = Math.floor((m % (24 * 60)) / 60);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  return formatMinutes(m);
}

export { formatMinutes as fmtDuration };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every day", "Weekdays", "Weekends", "Mon, Wed, Fri" */
export function fmtDays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.has(d)).map((d) => DAY_NAMES[d]).join(', ');
}

export { DAY_NAMES };
