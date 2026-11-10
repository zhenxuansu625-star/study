import { addDays, format, set as setTime } from 'date-fns';
import type { BusyBlock, Routine, Task } from '../scheduler';

/** Example data relative to today, so the prototype can be tried straight away. */
export function buildDemoData(today: Date): { routines: Routine[]; blocks: BusyBlock[]; tasks: Task[] } {
  const at = (days: number, h: number, m = 0) =>
    setTime(addDays(today, days), { hours: h, minutes: m, seconds: 0, milliseconds: 0 }).toISOString();
  const activeFrom = format(addDays(today, -7), 'yyyy-MM-dd');
  const created = new Date().toISOString();

  return {
    routines: [
      {
        id: 'demo-sleep',
        label: 'Sleep',
        days: [0, 1, 2, 3, 4, 5, 6],
        startTime: '23:00',
        endTime: '07:00',
        color: '#7C8DB5',
        activeFrom,
        skipDates: [],
      },
      {
        id: 'demo-work',
        label: 'Work',
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00',
        color: '#B49660',
        activeFrom,
        skipDates: [],
      },
      {
        id: 'demo-gym',
        label: 'Gym',
        days: [2, 4],
        startTime: '18:00',
        endTime: '19:30',
        color: '#7FA37F',
        activeFrom,
        skipDates: [],
      },
    ],
    blocks: [{ id: 'demo-dentist', label: 'Dentist', start: at(1, 17, 30), end: at(1, 18, 30), color: '#C27C7C' }],
    tasks: [
      {
        id: 'demo-essay',
        title: 'Write history essay',
        durationMinutes: 240,
        deadline: at(3, 17),
        priority: 'normal',
        minutesDone: 0,
        done: false,
        createdAt: created,
      },
      {
        id: 'demo-maths',
        title: 'Maths problem set',
        durationMinutes: 90,
        deadline: at(1, 22),
        priority: 'normal',
        minutesDone: 0,
        done: false,
        createdAt: created,
      },
      {
        id: 'demo-reading',
        title: 'Read chapter 5',
        durationMinutes: 45,
        deadline: at(2, 21),
        priority: 'normal',
        minutesDone: 0,
        done: false,
        createdAt: created,
      },
      {
        id: 'demo-revision',
        title: 'Revise for chemistry test',
        durationMinutes: 180,
        deadline: at(5, 9),
        priority: 'high',
        minutesDone: 0,
        done: false,
        createdAt: created,
      },
    ],
  };
}
