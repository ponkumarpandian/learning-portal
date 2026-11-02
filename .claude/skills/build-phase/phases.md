# Phase map (SPEC §16)

For each phase: the SPEC sections to read, the files it touches, the acceptance checklist (copied from §16) and the workstreams that can run in parallel. §12, §0 and `CLAUDE.md` always apply. Files marked _(new)_ don't exist yet.

---

## Phase 0: Foundation ✅ done (2026-10-29)

- **Read:** §0, §12, §13, §14, §15, App A–D
- **Built:** the tooling, `/content` samples, `src/content/*` (schemas, validate, loader), `scripts/validate-content.ts`, `src/engine/clock.ts`, `src/db/*`, tokens and the 3 worlds, fonts, routes, placeholder screens, `docs/theme-prototype.html`
- **Acceptance:**
  - [x] `validate-content` passes on the samples, and gives a clear error on a broken file (`scripts/__fixtures__/broken`)
  - [x] `npm test` runs
  - [x] a placeholder Today screen shows in light and dark

---

## Phase C: Textbook import (repeat for each chapter; can run any time after 0)

- **Read:** §13A, App F, §13 (core types), §5.4 (slot lengths), §7.5 (visuals), §8.2 (question types)
- **Use the `import-chapter` skill.** It holds the whole procedure.
- **Touches:** `source/<subject>/<NN-chapter>/extract.md`, `content/chapters/<subject>/<NN-chapter>.json`, `content/explainers/*.json`, `content/media/images/*`, `content/plan.json` (`chapterOrder`)
- **Acceptance:**
  - [ ] it produces `extract.md` and a chapter file in which every item has page sources
  - [ ] every book exercise question is present, with `bookRef`
  - [ ] nothing appears that isn't in the pages (the parent spot-checks)
  - [ ] `validate-content` passes
  - [ ] the chapter stays hidden from the kid until it is approved (`status: "draft"`; the parent sets `approved` until Phase 6 exists)
- **Parallel:** none inside one chapter, because the steps wait on the parent. Different chapters can be imported in parallel sessions.

---

## Phase 1: Timetable & Today

- **Read:** §4, §5.1, §5.2, §15.1–15.3, §15.10, App A, App E, §17
- **Touches:**
  - `src/engine/timetable.ts` _(new)_: slots for a date, now and next, slot state (done, now, later, catch-up), bedtime, future-day lock
  - `src/engine/index.ts`
  - `src/features/today/todayModel.ts`: **replace** it with engine calls
  - `TodayScreen.tsx` and `WeekScreen.tsx`
  - `src/db/repos/slotLog.ts`: tick-offs (`setSlotStatus` / `listSlotLogForDate` already exist)
  - a bedtime screen in `src/features/`, using Tara in her sleepy mood
  - `tests/e2e/*`
- **Acceptance:**
  - [ ] unit tests cover the slot boundaries (Mon 18:29 vs 18:30, Sun 10:30)
  - [ ] with the fake clock at Tue 17:20, the Now card shows Tuition
  - [ ] the Week view matches Appendix A exactly
  - [ ] catch-up shows in amber and stays open until bedtime
  - [ ] future days are locked (a PIN stub until Phase 6)
  - [ ] the bedtime block runs after `timetable.bedtime.schoolNights` on `schoolNights`
- **Parallel:**
  - A: the engine `timetable.ts` with table-driven tests
  - B: Week view UI and the tick-off repo wiring
  - C: Today and bedtime UI, after A's types exist
  - D: e2e with `?now=` in a `VITE_ALLOW_FAKE_CLOCK=1` build

---

## Phase 2: Lessons & videos

- **Read:** §5.3, §5.4, §6, §7 (all of it), §8.2, §8.4, §15.2, §15.6, §15.9, App B, App C
- **Touches:**
  - `src/engine/lessonTemplate.ts` _(new)_: slot minutes → template, mini lesson, check only
  - `src/engine/grading.ts` _(new)_: every question type, partial marks, `accept[]`, `tolerance`, units
  - `src/explainers/` _(new)_: player, narration (speechSynthesis en-IN at rate 0.95), and `visuals/` with `ParticleBox`, `LightRay` and `NumberLine`
  - `src/features/lesson/` and `src/features/video/` _(new)_: these replace `LessonPlaceholder`
  - question components using @dnd-kit (match, order, label_diagram)
  - the lessonProgress and attempts repos
  - the `validate.ts` `LIMITS` and `estimate*` helpers (reuse them)
- **Acceptance:**
  - [ ] the sample Physics lesson can be completed from start to finish
  - [ ] a checkpoint pauses at the right second
  - [ ] two wrong answers let her continue
  - [ ] when offline, the explainer fallback plays
  - [ ] reloading mid-lesson resumes at the same step
- **Parallel:**
  - A: `grading.ts` and `lessonTemplate.ts` (engine)
  - B: the explainer player and the 3 visuals
  - C: the YouTube/MP4 player, checkpoints, end overlay and fallbacks
  - D: question-type components
  - E: the lesson flow shell, autosave and resume. This one integrates A–D, so do it last.

---

## Phase 3: Daily Assignment & rewards

- **Read:** §5.4 (final lesson), §8.1, §8.5, §10, §15.1 (Rewards tab), §15.9, App E
- **Touches:**
  - `src/engine/mastery.ts` _(new)_: weights checkpoint 0.5, warm-up 0.5, check 1, daily 1, weekly test 2; the last 5 results; weak below 70, strong at 85 or more
  - `src/engine/rewards.ts` _(new)_: stars, streak with a weekly shield, levels every 100 stars, the 13 badges in `src/features/progress/badges.ts`
  - the mastery, rewards and attempts repos
  - `ProgressScreen.tsx` and the Today chips: replace the 0 / 1 Explorer placeholders
  - confetti and the star pop
- **Acceptance:**
  - [ ] unit tests cover the streak (shield, test days) and the mastery weights
  - [ ] the Daily Assignment takes 2–3 questions from each lesson done today
- **Parallel:**
  - A: mastery
  - B: rewards
  - C: the Daily Assignment flow UI, after A
  - D: the Progress screen, after B

---

## Phase 4: Weekly online tests

- **Read:** §8.3, §8.4, §8.6, App D (test-blueprint), §15.2 (focus mode), App E
- **Touches:**
  - `src/engine/testBuilder.ts` _(new)_: seeded and deterministic, with the source mix, difficulty mix and fallback
  - `src/features/test/`, `results/` and `fixit/` _(new)_: these replace `TestPlaceholder` and `ResultsPlaceholder`
  - the tests repo: `TestRecord.results` gets its type
  - attempts
- **Acceptance:**
  - [ ] the same seed always produces the same test
  - [ ] sections submit by themselves when time runs out
  - [ ] reloading keeps the remaining time
  - [ ] Saturday's English fix-it lists exactly that day's English mistakes
  - [ ] the windows and missed/practice states follow `blueprint.windows`
- **Parallel:**
  - A: testBuilder and its tests
  - B: the test runner (timer, flags, auto-submit, resume)
  - C: report card and correction report
  - D: fix-it sessions

---

## Phase 5: Study plan

- **Read:** §9 (all of it), App D (plan), §5.2 (missed slots), §13A ("Draft and approved")
- **Touches:**
  - `src/engine/queue.ts` _(new)_
  - `src/engine/planner.ts` _(new)_: coverage forecast, revision window, per-subject exams, the day before an exam, mock exams, taught-already chapters
  - `src/features/revise/` _(new)_: replaces `RevisePlaceholder`
  - Today/Week, which now get lessons from the queue
- **Acceptance:**
  - [ ] a missed slot keeps its lesson at the front of the queue
  - [ ] the forecast states are correct
  - [ ] the revision window changes the slots
  - [ ] the day before an exam is light revision of that subject only
  - [ ] draft chapters count as "not ready"
- **Parallel:**
  - A: queue
  - B: planner, after A's types exist
  - C: the revise screen and mock exams

---

## Phase 6: Parent area

- **Read:** §11, §2, §5.2 (PIN overrides), §8.3 (+5 min), §13A (Chapter review), §14 (backup), §12
- **Touches:**
  - `src/features/parent/*`: replaces `ParentPlaceholder`
  - `settings.pinHash`
  - `src/db/repos/contentOverrides.ts` and `state/content.ts` `refresh()`
  - backup export/import/wipe in `src/db/repos` (see the TODO in `repos/index.ts`)
  - Recharts in the dashboard
  - the timetable editor, using the validator's overlap rules
- **Acceptance:**
  - [ ] editing a slot time in the timetable editor changes the Today screen
  - [ ] export → wipe → import restores exactly the same state
  - [ ] Chapter review shows `needsReview` items first, and Approve is enabled only when there are none
- **Parallel:**
  - A: PIN and the dashboard
  - B: Content Manager, Chapter review and video add/preview
  - C: plan settings and the timetable editor
  - D: backup and the weekly report

---

## Phase 7: Polish & PWA

- **Read:** §7.5 (the remaining visuals that the real content needs), §14 (PWA), §12 (accessibility), §15 (all of it), §15.8, §15.9
- **Touches:**
  - `vite.config.ts` (PWA precache: content, fonts, media)
  - `src/explainers/visuals/*`
  - the sound toggle and Tara
  - `tests/e2e/*` (axe in every world)
  - performance
- **Acceptance:**
  - [ ] it installs as a PWA
  - [ ] lessons, explainers and tests work offline
  - [ ] axe shows no serious issues
  - [ ] it is tested at 768×1024 and 390×844
  - [ ] all 3 worlds, plus night mode, pass contrast (`node docs/design/check-tokens.mjs`) and look like the prototype
- **Parallel:** one workstream per visual (`explainer-visual` skill), plus PWA/offline and the a11y sweep.
