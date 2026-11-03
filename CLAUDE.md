# Avantika’s Adventure: kid study PWA

Vite 8 + React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`), Tailwind 4 (CSS-first), react-router 8, zustand 5, Dexie 4, Zod 4, framer-motion, date-fns(-tz). Static app: no server, no AI at runtime, works offline.

**Full spec: docs/SPEC.md — read the relevant section before each phase.** Decisions so far are in `docs/DECISIONS.md` (append new ones, one line each, with the date and a "why").

## Status

- **Phase 0 (Foundation): done.**
- **Phase C:** Chemistry Ch 3 "Matter" (pp.58–62) imported and **approved**. Its exercises and opening pages are still to come. Maths Ch 5 "Fractions" (pp.89–101, 7 lessons, 136 bank questions) imported as **draft**, waiting for the parent's review.
- **Phase 2 (Lessons & videos): built early, at the parent's request.**
  - `src/features/lesson/`: the lesson flow, autosave and resume.
  - `src/explainers/`: the narrated player, plus ParticleBox, LightRay, NumberLine and FractionBar.
  - `src/features/video/`: YouTube, MP4 and the fallbacks.
  - `src/features/questions/`: every question type and the correction report.
  - `src/engine/`: grading, lessonTemplate and queue.
  - YouTube and MP4 haven't been tried with real videos yet, because every id is still REPLACE_ME.
- **Phase 1 (Timetable & Today):** partly done. The catch-up and done states are in `todayModel.ts`. Still to do: the engine `timetable.ts`, the bedtime block, the future-day lock and the Week view.
- **Next:** finish Phase 1, then Phase 3. Use the `build-phase` skill.

## Commands

```bash
npm run dev                # Vite dev server (?now=2026-11-02T16:20 fake clock, ?world=&night=&text= look)
npm test                   # vitest run (jsdom, includes content validation tests)
npm run coverage           # engine coverage; the threshold is 90% lines on src/engine/**
npm run validate-content   # Zod + integrity + authoring checks on /content (-- --dir <path>)
npm run lint               # eslint
npx tsc -b                 # type-check only
npm run build              # tsc -b && vite build
npm run e2e                # Playwright (builds, then previews on :4173; tablet + phone projects)
npx tsx scripts/screenshot.ts --routes /,/week   # visual QA PNGs (Git Bash: prefix MSYS_NO_PATHCONV=1)
node docs/design/check-tokens.mjs                # WCAG contrast for every world/theme + prototype sync
```

These run in Git Bash on Windows. `cd /C/src/personal/study-companion-app` first, with a capital `C`: from a lowercase `/c/` cwd, vitest loads two copies of itself and every jest-dom matcher fails with "Invalid Chai property".

## Folder map

```
content/                 parent-editable JSON (bundled with import.meta.glob, validated with Zod)
  subjects.json timetable.json plan.json test-blueprint.json
  chapters/<subject>/<chapter>.json    explainers/<id>.json    media/{images,videos}/
source/                  family-private textbook material (git-ignored): books.json, portions.md, <subject>/<NN-chapter>/
scripts/                 validate-content.ts (CLI) · screenshot.ts · make-icons.ts · __fixtures__/broken/
src/
  engine/                PURE logic: no React, no DOM. clock.ts now; Phase 1+ adds timetable, queue, grading…
  content/               schemas.ts (Zod + types) · validate.ts (rules) · raw.ts · index.ts (loadContent)
  db/                    db.ts (Dexie "avantikas-adventure") · repos/* (the ONLY storage API)
  state/                 zustand stores: settingsStore.ts (theme attributes) · content.ts · clock.ts (ClockContext)
  components/            shared kid UI (ChunkyButton, Card, Stone, Trail, BottomSheet…) + ui.css · layout/
  features/              screens: today/ week/ progress/ me/ focus/ parent/ kit/ · features.css · copy.ts
  explainers/            (Phase 2) the explainer player + visuals/ registry (§7.4–7.5)
  styles/                tokens.css (design tokens) · index.css (Tailwind + @theme inline)
  routes.tsx App.tsx main.tsx
tests/e2e/               Playwright specs (axe, light/dark, no outbound requests)
docs/                    SPEC.md · DECISIONS.md · theme-prototype.html · design/ (NOTES.md, screenshots)
.claude/skills/          project skills (see below)
```

## Coding conventions

- **TS strict.** Use no `any`. Narrow indexed access (`arr[i]!` only when it is provably safe). Use the aliases `@/…` for src and `@content/…` for content.
- **Engine is pure.** Code in `src/engine/*` takes a `Clock` (`now(): Date`) and plain data, and returns plain data. All time logic runs in IST through `zonedParts()` / `fromWallTime()`. Never call `new Date()` to make a scheduling decision. Tests are table-driven and use `fixedClock('2026-11-02T16:20')`.
- **Screens get time from `useClock()`** (`src/state/clock.ts`). Tests wrap a screen in `<ClockContext.Provider value={fixedClock(...)}>`.
- **Storage only through `@/db/repos`.** Never import `@/db/db` or Dexie in features. Write functions take an optional `at` timestamp. No `localStorage` outside the repos either: the only copy, the first-paint look mirror, lives in `repos/settings.ts` (`readLookMirror` / `clearLookMirror`), and the Phase 6 wipe must clear it.
- **Content only through the loader.** Use `useBundle()` / `loadContent()` from `@/content`, `approvedChapters(b)` for anything the kid sees, and `getSubject / getChapter / getExplainer`.
- **Colours come from tokens, never raw hex.** Use CSS vars from `tokens.css`, Tailwind `bg-surface text-ink…`, and `subjectVars(subject)` / `tokenVars('dance')` for `--s/--sd/--on-s` (a built-in subject uses its token while subjects.json keeps the token's hex; a changed colour wins). There are no blurred shadows; the only shadow is the solid ledge `0 Npx 0 var(--ledge)`.
- **Sizes are in rem.** `calc(N * var(--px))` equals N px at the Big setting. Text on a `--go` or subject fill is at least `--fs-button` (1.35rem) or emoji only.
- **Reduced motion.** framer-motion is wrapped in `MotionConfig reducedMotion="user"`, and a global CSS kill-switch stops animations. Idle motion is limited to the Now-stone halo.
- Component CSS lives in `ui.css` / `features.css` inside `@layer components`. Class names must not clash with Tailwind utilities.
- New npm dependencies need a stated reason (record it in DECISIONS.md).

## No hard-coded content (§0.4)

Subjects, chapters, lessons, questions, videos and timetable slots live **only** in `/content` JSON. Components never list them. App rules (badge names, tab routes, lesson step names, `KID_NAME`) are allowed in code. Real chapters come **only** from Avantika's textbooks and notes, through §13A (`import-chapter` skill). Never invent syllabus facts. Seed content is marked `sample: true`.

## Non-negotiables (§12, condensed)

- No accounts, server, analytics, tracking, ads or purchases. Data stays in IndexedDB and leaves only through the parent's export. The e2e test checks that no request goes to another origin.
- Videos: only parent-approved IDs from content files, on `youtube-nocookie.com` with `rel=0`. The app's own end-screen overlay always covers YouTube's. Kid mode has no search, comments or outbound links. External links appear only in the parent area.
- Kind words only. Never write "wrong", "bad", "careless", "fail" or "hurry". Use "Not quite", "Almost!" and "Let's fix this one". Use soft amber (`--catch`), never red. Never compare her with others.
- Wellbeing: the bedtime block, eye breaks, offline notebook tasks, and no extra slots added by the app.
- Accessibility:
  - base 18px, questions about 22–24px
  - tap targets at least 48px
  - WCAG AA in every world, light and dark
  - full keyboard support and visible focus rings (`--focus`)
  - captions on
  - `prefers-reduced-motion` respected everywhere
- Every phase ends with tests, `validate-content` and a report, then **stop and wait for the go-ahead**.

## Skills (in `.claude/skills/`; use them instead of re-reading the spec)

| Skill              | Use when                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `build-phase`      | Starting, planning, checking or reporting any SPEC §16 phase (0, C, 1–7)                      |
| `import-chapter`   | The parent says "Import source/<subject>/<NN-chapter>" or gives textbook photos or PDFs       |
| `kid-ui`           | Building or changing any kid-facing screen, component, copy or style                          |
| `engine-module`    | Adding or changing pure logic in `src/engine/` (timetable, queue, grading, mastery, rewards…) |
| `explainer-visual` | Adding a §7.5 visual component or writing explainer scene JSON                                |
| `content-edit`     | Editing `/content` JSON: subjects, timetable, plan, blueprint, chapters, videos, explainers   |
