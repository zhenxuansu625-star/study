# Timetable

A phone app that fits your tasks around the times you're busy.

1. **Block out busy time.** Tap an empty slot on the calendar to add something like "Dentist". Choose *Every Saturday* to make it repeat.
2. **Set up routines.** On the *Routines* tab, add recurring busy time such as "Work, weekdays, 09:00–17:00" or "Sleep, every day, 23:00–07:00". Nothing is set up for you: until you add routines, every hour counts as free.
3. **Add tasks.** Tap **＋ Task**, then enter a name, how long it takes (`45m`, `1.5h`, `2h 30m`) and when it's due.
4. **It schedules itself.** Each task goes into the earliest free time before its deadline. The app decides whether to split it into sessions, and moves things around when your plans change.

This is a **prototype**: the scheduling engine and all the main screens work, but it still needs polish.

## Trying it out

### On your phone (Expo Go)

1. Install **Node.js 20 or newer** on your computer.
2. Install **Expo Go** on your phone from the App Store or Google Play.
3. On your computer, run:

   ```bash
   git clone https://github.com/zhenxuansu625-star/study.git
   cd study
   git checkout ccr-115bca2e-ulk99z
   npm install
   npx expo start
   ```

4. Scan the QR code it shows: use the Camera app on iPhone, or Expo Go on Android. Your phone and computer need to be on the same Wi-Fi network. If they aren't, run `npx expo start --tunnel` instead.

### In a browser

```bash
npm run web          # dev server with live reload
npm run build:web    # builds dist/timetable.html, a single file you can open in any browser
```

## How tasks are placed

Code: `src/scheduler/`. The rules are in `src/scheduler/config.ts`.

- **Order:** tasks due soonest go first. High-priority tasks are treated as if they were due 6 hours earlier.
- **Placement:** each task goes in the **earliest** free gap before its deadline, so later time stays open for emergencies. Nothing is placed in the next 15 minutes, and a 10-minute gap is kept around tasks. Both can be changed in Settings.
- **Splitting** is decided automatically:
  - up to 1h: always one sitting;
  - 1h–2.5h: one sitting, unless splitting would finish it more than a day sooner;
  - over 2.5h: split into sessions of 45 min to 2h, using as few as possible, and never leaving a leftover shorter than 30 min.

  You can override this per task under *More options*.
- **Changes:** whenever anything changes, the plan is recalculated and you're told how many tasks moved.
  - Sessions that are locked 🔒, already under way, or about to start stay where they are.
- **Missed sessions:** when a session's time has passed, the app asks *Did you do it?* (Yes / Partly / No). Your progress is updated and whatever is left is rescheduled.
- **Warnings:** a task that can't fit before its deadline is marked **⚠ Can't fit, short by Xh**. Overdue tasks are placed as soon as possible.

## Development

```bash
npm test             # scheduler and duration-parser unit tests
npm run typecheck
```

| Path | What's there |
|---|---|
| `src/scheduler/` | Pure TypeScript scheduling engine with no UI code. It will be shared with the desktop app later. |
| `src/state/store.ts` | App state (Zustand). It reruns the scheduler on every change and saves to the device. |
| `src/screens/` | Calendar, Tasks, Routines and Settings tabs |
| `src/sheets/` | Editors and prompts: task, busy time, routine, check-in, welcome |
| `src/ui/` | Theme (light and dark) and shared controls |

Data is stored only on the device, using AsyncStorage (localStorage in a browser). See `PLAN.md` for the full plan and what's next.
