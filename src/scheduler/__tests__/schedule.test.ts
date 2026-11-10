import { schedule } from '../schedule';
import { expandRoutines } from '../routines';
import { fillChunks } from '../splitDecision';
import type { BusyBlock, Routine, ScheduleInput, Settings, Task } from '../types';

// Monday 16 November 2026, local time (tests run in Europe/London).
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();
const iso = (day: number, h: number, m = 0) => new Date(at(day, h, m)).toISOString();
const hm = (isoStr: string) => {
  const d = new Date(isoStr);
  return `${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const settings: Settings = { bufferMinutes: 10, leadTimeMinutes: 15 };

function task(id: string, minutes: number, deadline: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    durationMinutes: minutes,
    deadline,
    priority: 'normal',
    minutesDone: 0,
    done: false,
    createdAt: iso(16, 0),
    ...extra,
  };
}

function block(id: string, start: string, end: string): BusyBlock {
  return { id, label: id, start, end, color: '#888' };
}

function routine(id: string, days: number[], startTime: string, endTime: string, extra: Partial<Routine> = {}): Routine {
  return { id, label: id, days, startTime, endTime, color: '#888', activeFrom: '2026-01-01', skipDates: [], ...extra };
}

function run(partial: Partial<ScheduleInput> & { now: number }) {
  return schedule({ routines: [], blocks: [], tasks: [], fixedChunks: [], settings, ...partial });
}

const chunksOf = (r: ReturnType<typeof run>, id: string) =>
  r.chunks.filter((c) => c.taskId === id).map((c) => `${hm(c.start)}-${hm(c.end).split(' ')[1]}`);

describe('schedule', () => {
  test('places a task as early as possible, after the lead time', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 60, iso(16, 17))] });
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-10:15']);
    expect(r.warnings).toEqual([]);
    expect(r.plans.a.spareMinutes).toBe(17 * 60 - (10 * 60 + 15));
  });

  test('avoids busy blocks and keeps a buffer after them', () => {
    const r = run({
      now: at(16, 9),
      blocks: [block('lecture', iso(16, 9), iso(16, 12))],
      tasks: [task('a', 60, iso(16, 17))],
    });
    // Block ends 12:00, +10 min buffer = 12:10, snapped to 12:15.
    expect(chunksOf(r, 'a')).toEqual(['16 12:15-13:15']);
  });

  test('keeps a buffer before the next busy item', () => {
    const r = run({
      now: at(16, 8),
      routines: [routine('work', [1, 2, 3, 4, 5], '09:00', '17:00')],
      tasks: [task('a', 30, iso(17, 20))],
    });
    // 08:15–08:45 ends before 08:50 (09:00 minus buffer): fits.
    expect(chunksOf(r, 'a')).toEqual(['16 08:15-08:45']);

    const r2 = run({
      now: at(16, 8),
      routines: [routine('work', [1, 2, 3, 4, 5], '09:00', '17:00')],
      tasks: [task('b', 60, iso(17, 20))],
    });
    // 60 min doesn't fit before work, so it goes after work.
    expect(chunksOf(r2, 'b')).toEqual(['16 17:15-18:15']);
  });

  test('handles overnight routines', () => {
    const r = run({
      now: at(16, 22, 30),
      routines: [routine('sleep', [0, 1, 2, 3, 4, 5, 6], '23:00', '07:00')],
      tasks: [task('a', 60, iso(17, 12))],
    });
    expect(chunksOf(r, 'a')).toEqual(['17 07:15-08:15']);
  });

  test('skipped routine occurrences free up time', () => {
    const r = run({
      now: at(16, 8),
      routines: [routine('work', [1, 2, 3, 4, 5], '09:00', '17:00', { skipDates: ['2026-11-16'] })],
      tasks: [task('a', 60, iso(17, 20))],
    });
    expect(chunksOf(r, 'a')).toEqual(['16 08:15-09:15']);
  });

  test('short tasks are never split: warns instead', () => {
    // Only 40-minute gaps exist before the deadline.
    const r = run({
      now: at(16, 9),
      blocks: [block('x', iso(16, 10), iso(16, 11)), block('y', iso(16, 11, 50), iso(16, 18))],
      tasks: [task('a', 60, iso(16, 18))],
    });
    expect(chunksOf(r, 'a')).toEqual([]);
    expect(r.warnings).toEqual([expect.objectContaining({ taskId: 'a', kind: 'cant-fit', shortMinutes: 60 })]);
  });

  test('medium tasks prefer one sitting when it is not much later', () => {
    // 75 min free now, 3h free in the afternoon.
    const r = run({
      now: at(16, 9),
      blocks: [block('x', iso(16, 10, 40), iso(16, 14))],
      tasks: [task('a', 120, iso(17, 18))],
    });
    expect(chunksOf(r, 'a')).toEqual(['16 14:15-16:15']);
    expect(r.plans.a.split).toBe(false);
  });

  test('medium tasks split when one sitting would be more than a day later', () => {
    // Each day only has 9:15–10:45 free (busy 10:45–next day 09:00), until a big gap on day 3.
    const blocks = [
      block('d16', iso(16, 10, 50), iso(17, 9)),
      block('d17', iso(17, 10, 50), iso(18, 9)),
      block('d18', iso(18, 10, 50), iso(18, 12)),
    ];
    const r = run({ now: at(16, 9), blocks, tasks: [task('a', 120, iso(19, 18))] });
    expect(r.plans.a.split).toBe(true);
    // Fills the earliest gaps: 85 min today, the last 35 min tomorrow.
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-10:40', '17 09:15-09:50']);
  });

  test('long tasks are split into chunks of at most 2 hours', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 300, iso(18, 18))] });
    // 120 min, 10 min break (snapped), 120 min, break, 60 min.
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-11:15', '16 11:30-13:30', '16 13:45-14:45']);
    expect(r.plans.a.split).toBe(true);
  });

  test('chunking never leaves a tiny leftover', () => {
    const MIN = 60_000;
    const gaps = [
      { start: at(16, 9), end: at(16, 11) }, // 120 min
      { start: at(16, 14), end: at(16, 18) },
    ];
    const res = fillChunks(gaps, 140, 10);
    const lengths = res.chunks.map((c) => (c.end - c.start) / MIN);
    expect(lengths).toEqual([95, 45]);
  });

  test('earliest deadline goes first', () => {
    const r = run({
      now: at(16, 9),
      tasks: [task('later', 60, iso(20, 17)), task('sooner', 60, iso(17, 17))],
    });
    expect(chunksOf(r, 'sooner')).toEqual(['16 09:15-10:15']);
    expect(chunksOf(r, 'later')).toEqual(['16 10:30-11:30']);
  });

  test('high priority goes first when deadlines are close', () => {
    const r = run({
      now: at(16, 9),
      tasks: [task('normal', 60, iso(17, 12)), task('urgent', 60, iso(17, 15), { priority: 'high' })],
    });
    expect(chunksOf(r, 'urgent')).toEqual(['16 09:15-10:15']);
  });

  test('warns with the shortfall when a task cannot fit before its deadline', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 300, iso(16, 12))] });
    const placed = r.chunks.reduce((s, c) => s + (new Date(c.end).getTime() - new Date(c.start).getTime()) / 60000, 0);
    const w = r.warnings.find((x) => x.taskId === 'a')!;
    expect(w.kind).toBe('cant-fit');
    expect(w.shortMinutes).toBe(300 - placed);
    expect(placed).toBeGreaterThan(0);
  });

  test('locked chunks stay put, count toward the task, and block other tasks', () => {
    const r = run({
      now: at(16, 9),
      tasks: [task('a', 120, iso(18, 18)), task('b', 60, iso(16, 18))],
      fixedChunks: [{ taskId: 'a', start: iso(16, 9, 15), end: iso(16, 10, 15), locked: true }],
    });
    expect(chunksOf(r, 'a')[0]).toBe('16 09:15-10:15');
    // Remaining 60 min of a placed after b.
    expect(chunksOf(r, 'b')).toEqual(['16 10:30-11:30']);
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-10:15', '16 11:45-12:45']);
  });

  test('flags a locked chunk that clashes with a new busy block', () => {
    const r = run({
      now: at(16, 9),
      tasks: [task('a', 60, iso(18, 18))],
      blocks: [block('emergency', iso(16, 9), iso(16, 12))],
      fixedChunks: [{ taskId: 'a', start: iso(16, 10), end: iso(16, 11), locked: true }],
    });
    expect(r.warnings.map((w) => w.kind)).toContain('locked-conflict');
  });

  test('progress already done reduces what is scheduled', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 90, iso(17, 18), { minutesDone: 60 })] });
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-09:45']);
  });

  test('done tasks are not scheduled', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 60, iso(17, 18), { done: true })] });
    expect(r.chunks).toEqual([]);
  });

  test('overdue tasks are scheduled as soon as possible with a warning', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 60, iso(15, 17))] });
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-10:15']);
    expect(r.warnings[0].kind).toBe('overdue');
  });

  test('respects "not before"', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 60, iso(18, 18), { earliestStart: iso(17, 14) })] });
    expect(chunksOf(r, 'a')).toEqual(['17 14:00-15:00']);
  });

  test('one-sitting override never splits', () => {
    const r = run({ now: at(16, 9), tasks: [task('a', 240, iso(18, 18), { splitOverride: 'one-sitting' })] });
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-13:15']);
  });

  test('allow-split override can split a short task', () => {
    const r = run({
      now: at(16, 9),
      blocks: [block('x', iso(16, 10, 10), iso(16, 11)), block('y', iso(16, 12, 10), iso(16, 18))],
      tasks: [task('a', 90, iso(16, 18), { splitOverride: 'allow-split' })],
    });
    expect(chunksOf(r, 'a')).toEqual(['16 09:15-10:00', '16 11:15-12:00']);
  });
});

describe('expandRoutines', () => {
  test('keeps local wall-clock times across a daylight-saving change', () => {
    // UK clocks go back on Sunday 25 October 2026.
    const occ = expandRoutines(
      [routine('r', [0, 1], '09:00', '10:00')],
      new Date(2026, 9, 25).getTime(),
      new Date(2026, 9, 27).getTime(),
    );
    expect(occ.map((o) => new Date(o.start).getHours())).toEqual([9, 9]);
    expect(occ.map((o) => (o.end - o.start) / 60000)).toEqual([60, 60]);
  });

  test('respects activeFrom and activeUntil', () => {
    const occ = expandRoutines(
      [routine('r', [0, 1, 2, 3, 4, 5, 6], '09:00', '10:00', { activeFrom: '2026-11-17', activeUntil: '2026-11-18' })],
      at(16, 0),
      at(21, 0),
    );
    expect(occ.map((o) => o.dateKey)).toEqual(['2026-11-17', '2026-11-18']);
  });
});
