---
name: build-phase
description: Use when starting, planning, resuming, verifying or reporting a build phase of Avantika's Adventure from docs/SPEC.md §16, for example "start Phase 1", "build Phase 3", "what's left in Phase 2", "write the end-of-phase report", or when deciding which SPEC sections and files a phase touches. Phase C (textbook import) also uses the import-chapter skill.
---

# Build a SPEC §16 phase

One phase at a time. Never start the next phase without the parent's go-ahead (SPEC §0.2).

## 1. Load only what the phase needs

1. Read `CLAUDE.md` (conventions and rules) and the tail of `docs/DECISIONS.md` (earlier choices, so you don't re-decide them).
2. Open [phases.md](phases.md) and find the phase row. It gives:
   - the **exact SPEC sections to read**: read those parts of `docs/SPEC.md` with offset/limit, not the whole file
   - the files and modules the phase touches
   - the acceptance checklist, copied from §16
   - a suggested split into parallel workstreams
3. Load the matching skills before you code:
   - `engine-module` for any `src/engine/*` work
   - `kid-ui` for any screen or component
   - `explainer-visual` for visuals and scenes
   - `content-edit` for any `/content` change
   - `import-chapter` for Phase C
4. Check the real code before you assume an API. Library typings are in `node_modules` (react-router 8, zod 4, dexie 4, framer-motion).

## 2. Plan (keep it short)

- Write the phase's acceptance checklist as todos, then add the workstreams from phases.md.
- Engine first (pure, test-first), then state and repos, then UI, then e2e. UI code calls the engine and never re-implements its rules.
- Phase 0 placeholders have to be replaced, not added to:
  - `src/features/today/todayModel.ts` becomes the Phase 1 engine
  - `src/features/focus/FocusPlaceholders.tsx` becomes real focus screens
  - `src/features/parent/ParentPlaceholder.tsx` becomes Phase 6
  - the `TODO(Phase N)` comments in the code (`grep -rn "TODO(Phase" src`)
- When the spec is ambiguous, pick the simpler option and add one line to `docs/DECISIONS.md` under a new heading `## YYYY-MM-DD · Phase N (...)`. Group the lines by area and give each a "why".

## 3. Rules that apply in every phase

- Never hard-code content (§0.4). It comes from `useBundle()` / `loadContent()`, and the kid sees `approvedChapters(b)` only.
- The engine is pure and uses an injected `Clock`. Storage goes only through `@/db/repos`. Colours come only from tokens.
- §12 can't be traded away: privacy, kind words, the soft amber colour, reduced motion, AA contrast, 48px targets.
- Don't add npm deps unless they are needed. Record any you add in DECISIONS.md.
- Every new behaviour gets a test. Engine coverage must stay at least 90% (`npm run coverage`).

## 4. Verify (run all of these, in this order, and fix before reporting)

```bash
npx tsc -b                      # types
npm run lint                    # eslint (react-hooks v7 rules are strict)
npm test                        # vitest (includes the content validation tests)
npm run coverage                # if src/engine changed; 90% lines threshold
npm run validate-content        # must print "✔ Content looks good!"
npm run build
npm run e2e                     # Playwright, tablet + phone, with axe
MSYS_NO_PATHCONV=1 npx tsx scripts/screenshot.ts --routes <changed routes> --out tmp/shots   # UI phases
```

For a UI change, look at the PNGs in `tmp/shots`, and compare them with `docs/design/*.png` and `docs/theme-prototype.html`. The screenshot script also flags horizontal overflow. `tmp/` is not git-ignored, so delete it afterwards.

## 5. Report, then STOP

Use this template, then **wait for the go-ahead**. Do not begin the next phase.

```markdown
## Phase N: <name> · report

**Built**

- <feature>: <where it lives> (one line each)

**Acceptance criteria (§16)**

- [x] <criterion>: <how it was shown (test name / e2e / screenshot)>
- [ ] <criterion>: <why not yet>

**Not done / deferred**

- <item>: <reason, and which phase picks it up>

**Decisions** (also added to docs/DECISIONS.md)

- <one line each>

**Checks**

- tsc ✔ · lint ✔ · test ✔ (N tests) · coverage engine NN% · validate-content ✔ (N warnings) · build ✔ · e2e ✔ (N)

Ready for Phase N+1 when you say go.
```

After the report, update the **Status** section of `CLAUDE.md`, and update any skill whose "Phase N will…" note is now out of date. For example, after Phase 2, update the player section of `explainer-visual`.
