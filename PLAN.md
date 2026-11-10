# Timetabling App: Final Plan

## Goal

A personal timetable app for your phone (a desktop version comes later) where you:

1. **Block out busy time.** Add labelled blocks for times you're not free, such as "Maths lecture", "Work" or "Sleep". Blocks can be one-off or repeating.
2. **Set up routines.** Create recurring blocks in one step, for example "Work, Mon–Fri, 9:00–17:00".
3. **Add tasks.** Type a task with a name, how long it takes, and when it's due.
4. **Get it scheduled automatically.** The app places each task as early as reasonably possible before its deadline. It decides by itself whether to split a task into chunks, and it reshuffles everything when your plans change.

## Decisions made

| Question | Decision |
|---|---|
| Platform | **Phone app first** (iOS and Android). Desktop comes later and reuses the same code. |
| Default hours | **None.** The app starts with no assumed working or sleeping hours. You add your own with the **Routines** feature. |
| Splitting | **Decided automatically** by the scheduler's rules (see below). You can override it for a single task if you want. |
| Placement | **As early as reasonably possible**, so later free time stays open for emergencies. |
| Storage | **On-device only** for v1. No account and no sync. |

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| App framework | **React Native + Expo** (TypeScript) | One codebase for iOS and Android. You can try it on your own phone with the Expo Go app by scanning a QR code. |
| Navigation | Expo Router | Simple screen-based navigation |
| Gestures and animation | react-native-gesture-handler + Reanimated | Smooth long-press-and-drag to create blocks |
| Dates | `date-fns` | Reliable date arithmetic that handles daylight-saving changes |
| Storage | `expo-sqlite` | Fast, structured, on-device storage |
| State | Zustand | Lightweight store that reruns the scheduler whenever something changes |
| Tests | Jest | Unit tests for the scheduler |
| Desktop (later) | Same code via Expo's web build, wrapped with **Tauri** | The scheduler and most of the UI carry over unchanged |

The scheduler is plain TypeScript with no phone-specific code, so the desktop app reuses it as-is.

---

## Data model

```ts
// Time you are NOT available (one-off, or one occurrence of a routine)
interface BusyBlock {
  id: string;
  label: string;              // "Dentist", "Maths lecture"
  start: string;              // ISO datetime
  end: string;
  color: string;
  routineId?: string;         // set if this block comes from a routine
}

// Recurring busy time, e.g. "Work, Mon–Fri, 9:00–17:00"
interface Routine {
  id: string;
  label: string;
  days: number[];             // 0 = Sun … 6 = Sat, e.g. [1,2,3,4,5]
  startTime: string;          // "09:00"
  endTime: string;            // "17:00" (may cross midnight, e.g. Sleep 23:00–07:00)
  color: string;
  activeFrom: string;         // date
  activeUntil?: string;       // optional end date (e.g. end of term)
  skipDates: string[];        // single occurrences removed (e.g. a day off)
}

// Something you need to do
interface Task {
  id: string;
  title: string;
  durationMinutes: number;
  deadline: string;           // must be finished by this time
  earliestStart?: string;     // optional "not before"
  priority: 'normal' | 'high';
  splitOverride?: 'one-sitting' | 'allow-split';  // normally empty: the app decides
  minutesDone: number;        // progress, so partially done tasks reschedule correctly
  done: boolean;
}

// Output of the scheduler (computed, never typed in)
interface ScheduledChunk {
  taskId: string;
  start: string;
  end: string;
  locked: boolean;            // pinned by you, so the scheduler won't move it
}

interface Settings {
  bufferMinutes: number;      // gap kept between items (default 10)
  leadTimeMinutes: number;    // don't schedule anything starting sooner than this from now (default 15)
}
```

**Key idea:** busy blocks, routines and tasks are what you enter. The schedule is **derived** from them and recalculated whenever anything changes. Only chunks you lock stay fixed.

---

## The Routines feature (setting your own default hours)

- A **Routines** screen lists your recurring blocks: "Work Mon–Fri 9–5", "Sleep every day 23:00–07:00", "Football Wed 18–20".
- **Creating one:** enter a label, tap the days you want (with shortcuts for *Weekdays*, *Weekends* and *Every day*), pick start and end times, choose a colour, and optionally set an end date.
- **Editing a routine** updates every future occurrence. Tapping a single occurrence on the calendar offers "Skip this one" (for example a bank holiday) or "Edit only this one".
- **First launch:** an optional welcome screen suggests adding routines such as sleep and work. **Nothing is pre-filled.** If you skip it, every hour of the day counts as free.

> Note: with no routines, the scheduler treats all 24 hours as free and could place a task at 3 a.m. Adding a "Sleep" routine prevents that. This is your choice to make; nothing is assumed.

---

## Auto-scheduling algorithm

Runs automatically after any change to tasks, blocks, routines or settings, and whenever the app is opened.

### 1. Build the free-time map
- Start from **now plus the lead time**, rounded up to the next 15 minutes, and go up to the latest deadline.
- Expand routines into concrete occurrences in that range, then subtract them along with one-off blocks and locked chunks.
- Merge overlapping busy time. The result is a sorted list of free gaps.

### 2. Order the tasks
Tasks are placed one at a time in this order:
1. **Earliest deadline first.** This is the standard rule that best avoids missed deadlines.
2. **High priority** before normal when deadlines are close.
3. **Longest task first** when there is a tie, so big tasks get first pick of large gaps.

### 3. Decide automatically whether to split
For each task, the scheduler picks **whichever valid option finishes the task earliest**, using these rules:

| Rule | Behaviour |
|---|---|
| Short tasks (**≤ 60 min**) | Always one sitting. Splitting something that short isn't worth it. |
| Medium tasks (**61–150 min**) | One sitting if a gap that fits exists before the deadline and finishing that way is **no more than about a day later** than the split option. Otherwise split. |
| Long tasks (**> 150 min**) | Split into chunks of **45–120 min** each, using as few chunks as possible. |
| Chunk limits | No chunk shorter than 45 min (except a final leftover of at least 30 min). No chunk longer than 2 h without a gap. |
| Override | Long-press a task and choose "Keep in one sitting" or "Allow splitting" to overrule the rules. |

These thresholds live in a single config file so they're easy to tune once you've used the app.

### 4. Place as early as reasonably possible
- Each task or chunk goes into the **earliest free gap** that can hold it, with the buffer applied on both sides.
- "Reasonably" means:
  - Nothing is scheduled within the lead time, so a task never lands in the next few minutes.
  - Buffers keep items from sitting back to back.
  - The 2-hour chunk limit stops marathon sessions.
- Used time is removed from the free map so tasks never overlap.

### 5. Report problems
- If a task can't be fully placed before its deadline, it is marked **"⚠ Can't fit, short by 1h 30m"** and the parts that do fit are still shown.
- For each task, the app also shows **how much spare time is left before the deadline**, so you can see how much room you have for surprises.

### Handling emergencies and changes
- **Adding an emergency block** (for example "Hospital, today 14:00–18:00") moves affected tasks to the next earliest free time automatically. A short message summarises what moved, such as "3 tasks rescheduled".
- **Missed chunks:** if a chunk's time passes and you haven't confirmed it, the app asks "Did you do *Essay* (14:00–15:00)?" with the options **Yes / Partly / No**, then updates progress and reschedules the rest.
- **Finishing early:** marking a task done frees its remaining time for other tasks.

The scheduler is a **pure function**:
`schedule(routines, blocks, tasks, lockedChunks, settings, now) → { chunks, warnings }`.
It has no UI code, so it is fully unit-testable and shared with the future desktop app.

---

## Screens (phone-first)

1. **Calendar (home)**
   - **Day view** and **3-day view** by default, since 7 columns are too cramped on a phone. A compact **week overview** is available too.
   - Swipe left or right to change days. A "Today" button and a "now" line.
   - **Long-press and drag** on empty time to create a busy block, then name it and pick a colour.
   - Busy blocks are solid colour. Task chunks have a distinct outlined style with a progress tick.
   - Tap any item to edit, delete, lock or unlock, mark done, or "skip this occurrence".
2. **Quick-add task** (floating ＋ button)
   - Fields: `Task name` · `Duration` (accepts "90m", "1.5h", "2h 30m") · `Due` (date and time picker).
   - An optional "More" section for priority, earliest start and splitting override.
   - After saving, the app shows where the task landed, for example "Scheduled: Tue 10:00–11:30".
3. **Tasks list:** all tasks with their status (✅ scheduled · ⚠ can't fit · ✔ done), planned times, and spare time before each deadline.
4. **Routines:** create and edit recurring blocks, as described above.
5. **Settings:** buffer, lead time, and export/import a JSON backup.

---

## Edge cases covered

- A deadline in the past or within the lead time is flagged as overdue or unschedulable.
- A routine that crosses midnight (Sleep 23:00–07:00) is handled correctly.
- Overlapping blocks and routines are merged.
- A locked chunk that ends up under a newly added busy block is flagged so you can resolve it.
- Daylight-saving changes are handled because all arithmetic is in local time via `date-fns`, never raw milliseconds.
- The app recalculates when reopened, since time has passed while it was closed.
- With lots of tasks, scheduling only looks as far ahead as the latest deadline so it stays fast.

---

## Build phases

> **Status (prototype):** phases 1–5 and 7 are working, and phase 6 is partly done. See "Prototype notes" below.

| Phase | Deliverable | Done when |
|---|---|---|
| **1. Scaffold** | Expo + TypeScript project, navigation, Jest, folder structure | App opens on your phone via Expo Go; `npm test` runs |
| **2. Scheduler core** | Free-time map, routine expansion, EDF ordering, automatic split decision, earliest placement, warnings, plus unit tests | Tests pass for: simple fit, split vs one-sitting choice, can't-fit, routines (including overnight), buffers, lead time, locked chunks |
| **3. Calendar + busy blocks** | Day and 3-day views, swipe navigation, long-press-drag to create, edit and delete | You can block out labelled time on your phone |
| **4. Routines** | Routines screen, weekday shortcuts, skip and edit single occurrences | "Work Mon–Fri 9–5" fills the calendar in one step |
| **5. Tasks + auto-slotting** | Quick-add, duration parser, task list, chunks on the calendar, live rescheduling, "moved N tasks" message | Adding a task makes it appear in the earliest sensible free time |
| **6. Persistence** | SQLite storage, JSON export/import | Everything survives closing the app |
| **7. Real-life handling** | Missed-chunk check-ins (Yes/Partly/No), locking, mark done, spare-time display | Usable day to day, recovers gracefully from disruptions |
| **8. Polish + release build** | Colours, dark mode, empty states, app icon, installable build via Expo EAS | Installed on your phone like a normal app |
| *Later: Desktop* | Expo web build wrapped in Tauri for Windows and macOS, reusing the scheduler | Same timetable on your computer |
| *Later: Extras* | Sync between phone and desktop, notifications ("Essay starts in 10 min"), calendar import (.ics) | — |

---

## Folder structure

```
app/                       # screens (Expo Router)
  index.tsx                # calendar (home)
  tasks.tsx
  routines.tsx
  settings.tsx
src/
  scheduler/               # pure TypeScript, shared with desktop later
    config.ts              # split thresholds, chunk sizes
    routines.ts            # expand routines into occurrences
    freeTime.ts            # build free-gap map
    splitDecision.ts       # one sitting vs chunks
    schedule.ts            # ordering + earliest placement + warnings
    __tests__/
  lib/
    parseDuration.ts       # "1h 30m" → 90
    db.ts                  # SQLite load and save
  state/
    store.ts               # Zustand store; reruns scheduler on change
  components/
    DayColumn.tsx
    BlockEditor.tsx
    TaskQuickAdd.tsx
    RoutineEditor.tsx
    MissedChunkPrompt.tsx
```

---

## Prototype notes

What's built, and where it differs from the plan above:

- **Storage:** uses AsyncStorage (a single saved JSON document) instead of SQLite. This is fine at prototype scale. Move to `expo-sqlite` when the data grows.
- **Navigation:** a simple bottom tab bar instead of Expo Router, to keep the prototype small.
- **Creating busy time:** you tap an empty half-hour slot, then adjust the time in the editor. Long-press-and-drag comes in the polish phase.
- **Calendar views:** Day and 3-day views are built. The week overview isn't yet.
- **Routines:** "active until" end dates are supported by the scheduler but have no editor yet.
- **Partial check-ins:** "Partly" records half of the session as done. A slider for the exact amount can come later.
- **Not built yet:** installable release build (EAS), app icon, notifications, desktop app, sync.
