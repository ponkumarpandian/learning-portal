---
name: engine-module
description: Use when adding or changing pure logic in src/engine/ for Avantika's Adventure: timetable now/next/catch-up/bedtime, lesson queues, the planner and revision window, lesson templates, grading of question types, mastery, the test builder, rewards and streaks, or any date/time (IST) calculation. Also use when writing their vitest tests or checking the 90% coverage target.
---

# Pure engine modules (`src/engine/`)

SPEC §14 and §17. The engine holds the app's rules. It is **pure**: no React, no DOM, no Dexie, no `window`, and no `import.meta.glob`. Features call it and render what it returns.

## Rules

1. **Inputs in, data out.** The function takes plain data and returns plain data:
   - content types from `@/content` (`Timetable`, `Slot`, `Chapter`, `Question`, `Plan`, `TestBlueprint`…)
   - DB record types from `@/db/db` (**type-only** imports: `import type { AttemptRecord } from '@/db/db'`)
   - a `Clock` or a `Date`

   Never read storage, and never mutate the inputs.

2. **Time.** Take a `Clock` (`import type { Clock } from './clock'`), or take `now: Date` from the caller. **Never call `new Date()` or `Date.now()`** inside a rule.
3. **IST everywhere.** Break the instant into parts with `zonedParts(now)`, which gives `{dateKey 'YYYY-MM-DD', hhmm 'HH:MM', weekday 'mon'…'sun', hour, minute, year, month, day}`. Turn wall time back into an instant with `fromWallTime(dateKey, 'HH:MM')`. Compare times of day with `toMinutes('HH:MM')` from `@/content` (it lives in schemas.ts). Never use the device's own local-time getters (`getHours()` and the like). `TZ = 'Asia/Kolkata'`, and there is no DST.
   - Days of the week: `WEEKDAYS` from `./clock` (Monday first).
   - Date arithmetic: date-fns on IST date keys, or `fromWallTime` plus `addDays`, then `zonedParts` again.
4. **Determinism.** Anything random (test builder, option shuffles) takes a **seed** and uses a small seeded PRNG inside the engine (e.g. mulberry32). Same seed in, same result out.
5. **Rule values come from content.** Lengths, mixes, bands, bedtime and windows come from `timetable.json`, `plan.json` and `test-blueprint.json`. Constants that the SPEC fixes, and that aren't in content, live at the top of the module as a named `const` with a § reference, for example mastery weights §8.5, star values §10, and the templates in §5.4.
6. **Export** from `src/engine/index.ts` (`export * from './timetable'`).
7. **Throw only on programmer error** (`RangeError`, e.g. a bad `fixedClock` string). Content problems are the validator's job, so assume validated content.
8. **The types are the API.** Export small named result types (e.g. `SlotState = 'done'|'now'|'later'|'catchup'|'locked'`). Map them to UI types in the feature, not in the engine.

## How features call the engine

```ts
// in a screen (src/features/...)
const clock = useClock();                 // src/state/clock.ts (ClockContext, or the ?now= app clock)
const bundle = useBundle();               // src/state/content.ts
const log = /* from @/db/repos, loaded in an effect or store */;
const view = todayView(bundle.timetable, log, clock.now());   // pure
```

Keep the glue (repos and stores) in `src/state/*` or the feature, never in `src/engine`. Phase 1 replaces `src/features/today/todayModel.ts` (`buildToday`) with an engine module. Move its logic, keep its tests passing, and then delete it.

## Tests (table-driven, next to the module)

```ts
// src/engine/timetable.test.ts (vitest globals are on: describe/it/expect, no import needed)
import { fixedClock } from './clock';
import { loadContent } from '@/content';
import { slotStateAt } from './timetable';

const { timetable } = loadContent(); // real Appendix A content; or build a tiny Timetable inline

describe('slotStateAt', () => {
  it.each([
    // [IST wall time,        day index, expected]
    ['2026-11-02T18:29', 5, 'later'], // Mon 18:29: Bharatanatyam (18:30) not started
    ['2026-11-02T18:30', 5, 'now'], // boundary: start is inclusive
    ['2026-11-08T10:30', 2, 'now'], // Sun 10:30: review starts, test ends (end exclusive)
  ] as const)('%s slot %i → %s', (wall, idx, expected) => {
    expect(slotStateAt(timetable, fixedClock(wall).now(), idx)).toBe(expected);
  });
});
```

- `fixedClock('2026-11-02T16:20')` takes **IST wall time**, or an ISO string with `Z`/`+05:30`. Reference week: Mon 2 Nov 2026 to Sun 8 Nov 2026. `plan.startDate` is 2026-11-02.
- Cover:
  - the boundaries (start inclusive, end exclusive)
  - midnight and the IST/UTC day flip (18:30Z is 00:00 IST)
  - empty inputs
  - every enum branch
- Build small inline fixtures for edge cases. Use `loadContent()` for "matches Appendix A" tests.
- The §16 and §17 criteria each name a test: write those tests with the spec's exact example times.
- Grading (Phase 2): at least one test per question type, plus partial marks, `accept[]`, `tolerance` and units.

## Coverage (at least 90% lines on `src/engine/**`)

```bash
npm run coverage        # vitest run --coverage (v8). The threshold is in vitest.config.ts and fails the run if missed
npx vitest run src/engine/timetable.test.ts   # quick loop on one file
```

The HTML report is written to `coverage/index.html` (git-ignored). Uncovered lines usually mean a missing table row, not a reason to lower the threshold.

## Checklist for a new module

- [ ] `src/engine/<name>.ts`: pure, with a JSDoc header naming the SPEC §, and typed exports
- [ ] `src/engine/<name>.test.ts`: table-driven, with the spec examples and edge cases
- [ ] exported from `src/engine/index.ts`
- [ ] no `new Date()`, `Date.now()`, `Math.random()`, `window` or `document`, and no imports from `@/db/repos`, `@/state` or `react`: `grep -nE "new Date\(\)|Date\.now|Math\.random|window|document|@/db/repos|@/state|from 'react'" src/engine/<name>.ts`
- [ ] `npm run coverage` passes, and `npx tsc -b` and `npm run lint` are clean
- [ ] each new rule decision gets one line in `docs/DECISIONS.md`
