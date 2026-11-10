# Timetabling App: Plan

## Goal

A personal timetable where you:

1. **Block out busy time.** Draw blocks on a weekly calendar for times you're not free (lectures, work, sleep, gym) and label them. Blocks can repeat weekly.
2. **Add tasks.** Type a task with a **name**, **how long it takes**, and **when it's due**.
3. **Get it scheduled automatically.** The app finds free time before the deadline and places the task there, splitting it into chunks if needed. If it can't fit, the app tells you.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| App type | Single-page web app (runs in the browser, works on a phone) | No install, no server needed to start |
| Language | TypeScript | Catches date and time mistakes early |
| UI framework | React + Vite | Fast to build with, simple tooling |
| Calendar grid | Custom CSS grid (one column per day, rows of 15 minutes) | Full control over drag-to-create and colouring, no heavy dependency |
| Dates | `date-fns` | Small and reliable date arithmetic |
| Storage | `localStorage` (v1) | Data stays on your device, no account needed |
| Tests | Vitest | The scheduler is pure logic and easy to unit test |

A backend or sync can come later. Nothing in v1 depends on one.

---

## Data model

```ts
// Time you are NOT available
interface BusyBlock {
  id: string;
  label: string;            // "Maths lecture", "Work", "Sleep"
  start: string;            // ISO datetime
  end: string;              // ISO datetime
  repeat: 'none' | 'weekly';
  repeatUntil?: string;     // optional end date for weekly repeats
  color: string;
}

// Something you need to do
interface Task {
  id: string;
  title: string;            // "Write history essay"
  durationMinutes: number;  // total time needed
  deadline: string;         // ISO datetime: must be finished by this
  earliestStart?: string;   // optional: "don't start before"
  splittable: boolean;      // may be broken into chunks?
  minChunkMinutes: number;  // smallest chunk worth doing (default 30)
  priority: 'low' | 'normal' | 'high';
  done: boolean;
}

// Output of the scheduler (computed, not typed in)
interface ScheduledChunk {
  taskId: string;
  start: string;
  end: string;
  locked: boolean;          // you pinned it, so the scheduler won't move it
}

interface Settings {
  dayStart: string;         // e.g. "08:00": never schedule tasks before
  dayEnd: string;           // e.g. "22:00": never schedule tasks after
  slotMinutes: 15;          // grid granularity
  bufferMinutes: number;    // gap kept around tasks (default 10)
  maxChunkMinutes: number;  // longest single sitting (default 120)
}
```

**Key idea:** busy blocks and tasks are what you enter. The schedule is **derived** from them, so it is recalculated whenever anything changes. Only chunks you lock are kept fixed.

---

## The auto-scheduling algorithm

Run every time a block, task or setting changes:

1. **Build the free-time map** from now until the latest deadline:
   - Start with each day's working window (`dayStart` to `dayEnd`).
   - Subtract every busy block, with weekly repeats expanded into individual occurrences.
   - Subtract locked chunks.
   - The result is a sorted list of free intervals.
2. **Order the tasks** that aren't done by:
   1. deadline, earliest first (Earliest-Deadline-First is the classic rule that best avoids missed deadlines)
   2. priority, high first
   3. duration, longest first (big tasks get first pick of large gaps)
3. **Place each task** by walking the free intervals from `max(now, earliestStart)` up to `deadline`:
   - **Not splittable:** take the first gap that fits the whole duration plus buffers.
   - **Splittable:** fill gaps in chunks between `minChunkMinutes` and `maxChunkMinutes` until the duration is covered.
   - Snap every start and end to the 15-minute grid.
   - Remove the used time (plus buffer) from the free map so later tasks can't overlap.
4. **Report anything that doesn't fit:** a task that can't be fully placed before its deadline gets an "⚠ Can't fit, short by 1h 30m" warning, and its partial chunks are still shown.

The scheduler is a **pure function**, `schedule(blocks, tasks, settings, now) → { chunks, warnings }`, so it is easy to test and has no UI dependencies.

### Possible later upgrades
- **Spread work out:** prefer placing chunks on different days instead of cramming everything early.
- **Preferred times:** for example "deep work in the morning".
- **Smarter packing:** a look-ahead or backtracking pass when greedy placement fails but a valid arrangement exists.

---

## Screens and UI

1. **Week view (main screen)**
   - 7 columns × time rows with a "now" line.
   - **Click and drag** on empty space to create a busy block. A popup asks for a label, colour and whether it repeats weekly.
   - Busy blocks are solid colour. Scheduled task chunks are a distinct striped or outlined style so you can tell them apart.
   - Click a block or chunk to edit, delete, lock, or mark it done.
   - Arrows to move between weeks, plus a "Today" button.
2. **Quick-add task bar** at the top:
   `[ Task name ] [ 2h ] [ due: Fri 17:00 ] [Add]`
   with an "advanced" toggle for splittable, minimum chunk, priority and earliest start.
   - Durations are typed naturally: "90m", "1.5h", "2h 30m".
3. **Task list sidebar**
   - Every task with its status: ✅ scheduled, ⚠ can't fit, ✔ done.
   - Shows when each task is planned ("Tue 14:00–15:30, Wed 10:00–10:30").
4. **Settings panel:** day start and end, buffer, maximum chunk length.

---

## Edge cases to handle

- A deadline that is already in the past: reject it, or flag it as overdue.
- A task longer than any single free gap while not splittable: warn and suggest allowing splitting.
- Overlapping busy blocks: merge them when building the free map.
- Editing a busy block on top of scheduled tasks: tasks reflow automatically. Locked chunks that conflict get flagged.
- Time passing: chunks in the past that aren't marked done count as missed, and the remaining work reschedules.
- Daylight-saving changes: do all date arithmetic with `date-fns` in local time, never by adding raw milliseconds.
- Marking a task done early frees its remaining chunks for other tasks.

---

## Build phases

| Phase | Deliverable | Done when |
|---|---|---|
| **1. Scaffold** | Vite + React + TS project, folder structure, Vitest set up | `npm run dev` and `npm test` both work |
| **2. Scheduler core** | `src/scheduler/` with free-time map, EDF placement, splitting, warnings, plus unit tests | Tests cover: simple fit, split across gaps, can't-fit warning, recurring blocks, buffers, locked chunks |
| **3. Week view + busy blocks** | Calendar grid, drag-to-create, edit and delete labelled blocks, weekly repeat | Blocks can be added, labelled and repeated |
| **4. Tasks + auto-slotting** | Quick-add bar, duration parser, task list, chunks drawn on the calendar, live rescheduling | Typing a task makes it appear in free time before its deadline |
| **5. Persistence + settings** | Save and load from `localStorage`, settings panel | Data survives a page refresh |
| **6. Polish** | Lock or pin chunks, mark done, missed-chunk handling, mobile layout, colours | Comfortable to use day to day |
| *Later* | Export and import (.ics or JSON), Google Calendar import, sync across devices, notifications | — |

---

## Proposed folder structure

```
src/
  scheduler/
    freeTime.ts        # build free intervals from settings and busy blocks
    recurrence.ts      # expand weekly blocks into occurrences
    schedule.ts        # EDF placement and splitting, returns chunks and warnings
    schedule.test.ts
  lib/
    parseDuration.ts   # "1h 30m" → 90
    storage.ts         # localStorage load and save
  components/
    WeekView.tsx
    BusyBlockEditor.tsx
    TaskQuickAdd.tsx
    TaskList.tsx
    SettingsPanel.tsx
  state/
    store.ts           # app state; runs the scheduler on change
  App.tsx
```

---

## Open questions

1. **Platform:** is a web app (works on laptop and phone browser) right, or do you want a native phone app or desktop app?
2. **Working hours:** what default window should tasks be placed in (for example 08:00–22:00)?
3. **Splitting:** should tasks split into chunks by default, or stay in one sitting unless you say otherwise?
4. **Placement style:** schedule tasks as early as possible, or spread them out evenly before the deadline?
5. **Sync:** is it fine for data to stay on one device for v1?
