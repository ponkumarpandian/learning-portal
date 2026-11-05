# Decisions

Ambiguities resolved while building, one line each, with a short "why" (SPEC §0.6: choose the simpler option and record it). Newest phase at the bottom.

## 2026-10-29 · Phase 0 (Foundation)

### Process and docs

- The spec file is saved as `docs/SPEC.md`. Why: §0.1 names this path, and every phase reads its sections from it.
- No theme prototype was supplied, so `docs/theme-prototype.html` was written from §15. Why: §0.1 and §15 need a visual reference to match.
- The prototype's clock is fixed at Monday 2 Nov 2026, 5:40 pm (Maths done, Physics up now). Its sample question and hint come from the Appendix B SAMPLE chapter. Why: the screenshots are repeatable and no syllabus content is invented.
- The prototype's smooth world switch (`@property` colour transitions) is optional for the React port and is not in tokens.css. Why: it is polish, not a token.
- For e2e tests, fake time comes from `?now=` in a `VITE_ALLOW_FAKE_CLOCK=1` build or from Playwright's `page.clock`. Why: production builds must ignore `?now=`, but e2e tests run against a built preview.

### Content schemas (`src/content/schemas.ts`)

- Every content object is `strictObject`. Why: an unknown key, usually a typo like `optons`, becomes a schema error.
- `Question` is one flat strict object, exactly as in the §13 interface, with per-type rules in `superRefine`:
  - mcq: 2–4 unique options, and the answer is one of them
  - true_false: a boolean answer
  - fill_blank: a string or number answer
  - match: at least 2 pairs
  - order: at least 2 items in `sequence`
  - label_diagram: an image and at least 1 hotspot
  - numeric: a number answer
  - short_answer and think_write: a `modelAnswer`

  Why: this keeps the §13 shape and still catches broken questions.

- Each slot kind has required fields. lesson and homework_lesson need a single `subject`. revise, fixit and review need `subject` or `subjects`. test needs `testId` and `subjects`. activity, break and offline_task need a `label` and have no subject. Why: the Today and Week screens can trust every slot.
- Slot times must be HH:MM, and `start` must be before `end`. The timetable `timezone` must be the literal `'Asia/Kolkata'`. Why: these are cheap checks that catch typos.
- Plan exams support mode `single` (with `date`) and mode `per_subject` (with `dates`). Dates are YYYY-MM-DD or `REPLACE_ME`, and `examPattern` must include `default`. Why: §9.1 allows both, and `REPLACE_ME` marks what the parent still has to fill in.
- `source` on Lesson, LearnCard and Question, and `Chapter.book`, are optional in the schema. The validator requires them for non-sample chapters. Why: SAMPLE content has no book.
- `Explainer.questions` defaults to `[]`. `scene.visual` is `z.enum(VISUAL_NAMES)`, which lists all 28 §7.5 components. Why: a misspelt visual is caught before Phase 2's registry exists.
- `videoRef.scene` is a 0-based index. Appendix B's `scene: 3` is "shadow formation", the 4th scene of `light-straight-line`. Why: it matches array indexing in the player.
- Ids are unique in one namespace across subjects, chapters, lessons, all questions and explainers. Why: §13 says "unique across all content", and one namespace is the simplest reading.
- `ContentOverride` is defined in schemas.ts, and the db layer imports it. Why: there is one source of truth for the override shape.

### Validator (`src/content/validate.ts`, `npm run validate-content`)

- Every issue has a kind: `schema`, `integrity` or `authoring`. Why: the loader blocks an override only for schema or integrity problems.
- Zod's wording is rewritten for the parent, for example "should be a number, but found a string" and 'unknown field "x" — is it a typo?'. Why: the parent reads these messages.
- How a checkpoint's `questionId` must resolve:
  - YouTube and MP4 checkpoints: a question in the same chapter (questionBank, or any lesson's practice or check), or in the questions of an explainer that the lesson uses.
  - Explainer scene checkpoints: the explainer's own questions, or any question anywhere.

  Why: the player can always find the question.

- Rules added beyond §13 (errors): questionBank items need a `lessonId` from the same chapter; `variantOf` must point to an existing question; `videoRef` role, scene and time are checked; practice questions need hints; a `fromBook` question needs `bookRef`. Why: the lesson flow and correction report depend on these.
- These are only warnings:
  - more than 6 check questions
  - no primary video
  - a YouTube clip with no `end`
  - 0 checkpoints, or more than 3
  - fewer than 4 questionBank questions per lesson (Appendix F)
  - questions marked `needsReview`
  - an unknown slot colour token
  - slots not listed in time order
  - a test slot whose start doesn't match the blueprint's `windows.opens`
  - a chapter that is not in `plan.chapterOrder`
  - a chapter whose folder doesn't match its subject

  Why: none of these stop the kid from using the app.

- For sample chapters and explainers, missing questionBank size and source rules give one summary warning each, not an error per item. Why: SAMPLE content has no book pages.
- Video limits (§7.7) are warnings:
  - YouTube length is `end − start`.
  - An explainer's length is the sum over its scenes of max(`minDuration`, words ÷ 2.3 words per second).
  - The 15-minute lesson total counts primary videos only.
  - MP4 length is not checked.

  Why: an MP4's length is only known when it plays.

- Weekly session counts include slots with a single `subject` and kind lesson, homework_lesson, revise or fixit, compared with `subjects.json` `sessionsPerWeek`. Multi-subject revise and fixit slots don't count. A mismatch is an error. Why: this is the Appendix A check, and it gives Maths 5 and every other subject 3.
- Blueprint checks: the structure's marks must add up to `sectionMarks`; `sourceMix` and `difficultyMix` must each add up to 1; `bands` must include `min: 0` and be listed from highest to lowest. Why: the Phase 4 test builder depends on these.
- `validate.ts` also exports `LIMITS`, `estimateSceneSeconds` and `estimateExplainerSeconds` for Phase 2. `raw.ts` `rawFromFiles()` is shared by the loader and the CLI. Why: the rules are written once.

### Loader (`src/content/index.ts`)

- Chapter and explainer overrides replace by `targetId ?? data.id`, and unknown ids are added. Timetable, plan and subjects overrides replace the whole object. Overrides are applied oldest `updatedAt` first. Why: the latest edit wins.
- An override is skipped, with a warning, if it fails Zod or adds new schema or integrity errors. Authoring problems never block it. Why: a parent's edit must never break the kid's view (§13), but missing sources shouldn't block it either.
- The loader throws a clear Error if one of the 4 core files (subjects, timetable, plan, test-blueprint) is invalid. A broken bundled chapter or explainer is skipped with a warning. Why: CI catches core files first, and the app can't run without them.
- `ContentBundle.warnings` holds only loader messages, not validator output. Why: validation doesn't need to run on every load.
- Extra exports: `bundledRawContent()`, `getChapter()`, `getExplainer()`, and everything from `./schemas`. Why: features import from one place.

### Sample content (`/content`)

- `timetable.json`, `plan.json`, `test-blueprint.json`, `states-of-matter.json` and `source/books.json` are byte-for-byte copies of the SPEC code blocks. `subjects.json` is Appendix A2 plus `sessionsPerWeek` from §3. Why: the spec is the source.
- `light.json` is Appendix B, plus `parentNotes` that mark it SAMPLE and list video search words, plus 8 SAMPLE questions (`phy-light-1-q3` to `q10`, `fromBook: false`). That makes 11 bank questions: 4 easy, 5 medium and 2 challenge. Why: this exercises every rule while using only Appendix B facts.
- `light-straight-line.json` has 5 LightRay scenes: torch, corner, materials, shadow and pinhole. Its props are `{scene, beam, showBlockedRay, material, showShadow, showImage}`, changed through `steps`. Its checkpoints (`lsl-cp1`, an mcq at scene 2, and `lsl-cp2`, a true_false at scene 4) are in the explainer's own questions. Why: these are the scenes Appendix C asks for.
- Tests that need `fs` are in `scripts/validate-content.test.ts`, which imports vitest explicitly because tsconfig.node has no vitest globals. Tests under `src` read content through `import.meta.glob`. Why: each tsconfig stays clean.

### Clock (`src/engine/clock.ts`)

- The fake clock from `?now=` or `fixedClock` is frozen and does not tick, and each `now()` returns a new Date. Why: e2e screens are deterministic, and a caller can't change the next result.
- `?now=` accepts YYYY-MM-DD and YYYY-MM-DDTHH:MM[:SS[.sss]], optionally followed by Z or ±HH:MM. With no offset it is IST wall time, and a bare date means IST midnight. Why: it is easy to type in a URL.
- In `?now=`, an unencoded `+05:30` arrives as a space after URL decoding. The space is turned back into `+`. Why: hand-typed URLs still work.
- `fixedClock` throws `RangeError` on bad input, while `createAppClock` falls back to `systemClock`. Why: bad input in a test is a bug, but a bad URL must not crash the app.
- Fake time is allowed when `import.meta.env.DEV` or `VITE_ALLOW_FAKE_CLOCK === '1'`. This rule can be injected as `createAppClock`'s second argument. Why: tests can try both cases.

### Storage (`src/db`)

- Dexie tables are declared with `declare` rather than `!`. Why: ES2022 class fields would overwrite the tables that Dexie installs.
- Indexes: slotLog `id, date`; lessonProgress `lessonId, status, updatedAt`; attempts `++id, source, lessonId, testId, questionId, at`; tests `testId, status`; mastery `lessonId`; rewards `id`; settings `id`; contentOverrides `id, target`. Why: these are the lookups later phases need.
- Fields added beyond the brief: `testId` on AttemptRecord, `completedAt` on LessonProgressRecord, `seed`, `startedAt`, `submittedAt` and `updatedAt` on TestRecord, and `updatedAt` on MasteryRecord and RewardsRecord. Why: test lookups, fix-it and resume need them.
- TestRecord status is `not_started | in_progress | submitted | missed`, and section status is `pending | active | submitted`. `results` is `unknown` until Phase 4 defines it. Why: the shape isn't fixed before Phase 4.
- RewardsRecord holds stars, level (default 1), badges, streak, bestStreak, an optional `lastStreakDate` (an IST date key), shields and updatedAt. `DEFAULT_REWARDS` is exported. Why: this is the §10 state.
- `getSettings` merges the stored record over `DEFAULT_SETTINGS`. `saveSettings` runs in a read-write transaction, and patching a key with `undefined` removes it. Why: settings added later get their defaults, and `pinHash` can be cleared.
- `putOverride`, `saveTest` and `putMastery` fill in `updatedAt` when it is missing. `listOverrides` returns the oldest first. Override data is stored as given, and `loadContent` validates it. Why: overrides apply in the order they were made.
- Write functions take an optional `at` timestamp (default `Date.now()`), and repos don't depend on the Clock. Why: tests are deterministic, and the repo layer stays plain.
- `addAttempt` throws `RangeError` when `score` is outside 0..1 or NaN. Why: bad scores would corrupt mastery.
- Repos use the module-level `db` singleton, and features import only from `@/db/repos`. Why: a sync layer can go here later (§14).

### Design tokens and theme (`src/styles/tokens.css`)

- Every spec colour for go buttons and subjects is kept. Text on subject fills is white, except dark `#08343a` on Chemistry and Geography. Why: these are the §15.5 values.
- White on Maths, Biology, English, Meadow green and Ocean pink is only 3.2–3.9:1. Text on those fills must be at least 1.35rem (about 24px, which counts as AA large text) or be emoji only. Why: this keeps the spec colours and still meets WCAG AA.
- Small text on a go colour uses `--go-d` (5.4–7.0:1). This covers the "Start here!" tag, today's date in Week and the "Now" pill. Why: contrast.
- Tokens added beyond §15.5:
  - `--focus` per world (the focus ring, at least 3:1)
  - `--catch` and `--catch-d` (soft amber for catch-up and the "not quite" option)
  - `--on-<subject>`, `--on-<activity>` and `--on-gold` (text colours)
  - size, type, corner and motion tokens

  Why: components don't use raw values.

- Sizes are in rem through `--px = 1rem/18`. Text size is set on `html` as font-size 112.5% (Big) or 125% (Bigger). Why: spec pixel sizes are exact at Big, everything scales at Bigger, and the browser's own font setting is respected.
- Theme selectors: Meadow day is the `:root` default; Meadow and Ocean night use `[data-world][data-theme=dark]`; Space ignores `data-theme` and is always dark. Why: §15.4.
- The "Start here!" tag and go buttons follow the world's go colour: green in Meadow, pink in Ocean and yellow in Space. Why: §15.4's go column.
- Selected segments, tabs and day bubbles use a tinted `--tab-on` pill with a `--go` border, never small text on a go fill. Why: contrast.
- Below 600px the Space planet sits at about 46vh on the right edge. Why: the greeting bubble covers the top-right corner.

### UI and app shell

- Component CSS is ported from the prototype into `src/components/ui.css` and `src/features/features.css`, inside `@layer components`. Why: Tailwind utilities can still override it.
- Tailwind maps the tokens with `@theme inline` (`bg-surface`, `text-ink`, `rounded-card`, `font-display` and so on). Why: utilities follow world and theme changes.
- No class name clashes with a Tailwind utility; for example ProgressRing uses `.pring`. Why: Tailwind's `.ring` drew a black box.
- Subject colours come from tokens by subject id (`subjectVars`), and subjects without a token fall back to their `subjects.json` hex. Activity slots use `slot.colour` (`tokenVars`), and test stones use gold. Why: the token colours are contrast-checked.
- `colours.ts` keeps a fixed set of token names. A side effect is that for the 7 subjects that have tokens, a parent-edited hex is ignored. Why: §15.5 says subject colours never change.
- The Phase 0 "now" highlight is the pure, tested `src/features/today/todayModel.ts` `buildToday()`. The Phase 1 timetable engine replaces it. Why: Phase 0 needed a Today screen without building Phase 1.
- Trail: study slots (lesson, homework_lesson, revise, fixit, test, review) are stones; activities and offline tasks are rest stops; breaks are left off. A "🌙 Sleep time" marker comes from the timetable bedtime. Why: the trail stays uncluttered, as in the prototype.
- The gold walked path is drawn from the start of the trail to the Now stone. Why: NOTES.md asks for it, even though nothing is done yet in Phase 0.
- Trail layout is measured in `useLayoutEffect` and written straight to the DOM. It re-runs on resize, when fonts load and when the text size changes. Why: no setState loops, and the react-hooks v7 lint rules pass.
- Trail stones pop in one after another (55ms apart), only when motion is allowed. Why: delight without breaking reduced motion.
- `initSettings()` applies the localStorage copy of world, night and text before React mounts, follows `prefers-color-scheme` for Auto, then loads settings from Dexie. Dexie is the source of truth. `main.tsx` waits up to 600ms. Why: no flash of the wrong theme.
- `<meta name="theme-color">` is set from the computed `--go`, with a hex fallback for each world. Why: §15.0, and jsdom has no computed styles.
- The dev and QA look override `?world=&night=&text=` follows the same rule as `?now=` and is never saved. Why: `scripts/screenshot.ts` uses it.
- The clock is injected through `src/state/clock.ts` (`ClockContext`, `useClock()`), and tests pass `fixedClock`. Why: screens are testable at any time.
- The zustand `useContent` store starts from a synchronous `loadContent()`, and `refresh()` merges the Dexie overrides back in. Why: the first render is never empty.
- Fonts are imported from @fontsource in `main.tsx` (Fredoka 500/600, Nunito 700/800). Why: they work offline and make no external requests (§12).
- Routes are built with `createBrowserRouter` in 3 layout groups: KidLayout (decor and tab bar), FocusLayout (no tab bar) and ParentLayout (plain). The `*` NotFound route sits inside KidLayout. `/kit` exists only when fake time is allowed. Why: §15.1.
- The TabBar's active pill slides between tabs with a framer-motion `layoutId`, and NavLink sets `aria-current="page"`. Why: smooth, with accessible state.
- BottomSheet is a portal:
  - The `plain` tone has a scrim, `aria-modal`, a focus trap and Escape to close.
  - The ok and hint tones have no scrim, so the chosen option stays visible.
  - The primary button gets focus when the sheet opens, and focus returns to the opener when it closes.

  Why: §15.2 rule 5.

- The Screen wrapper fades and slides in, and focuses the screen's `h1` after in-app navigation. Why: screen-reader users hear the new screen.
- Confetti on the sample answer is only a demo. The app must limit confetti to 100% scores, badges and finishing a test (§15.9), and the star pop to a correct first try. Why: so the prototype isn't copied too literally.
- `KID_NAME` is in `src/features/copy.ts`. The 13 badges' names and emoji are in `src/features/progress/badges.ts`. Why: these are app rules, not parent content (§0.4).
- In Phase 0 the streak and stars chips show 0, and the level shows 1 Explorer. The exam chip shows "📅 Soon" while exam dates are `REPLACE_ME`, and "Day N" counts from `plan.startDate`. Why: rewards arrive in Phase 3.
- The Grown-ups button opens a "Grown-ups only" sheet, where OK is the default. "I'm a grown-up" goes to the `/parent` placeholder. Why: there is no PIN until Phase 6.
- KitScreen (`/kit`, dev only) builds all its samples from the content bundle. Why: §0.4 applies even to demo screens.
- The regular icons have transparent corners. The maskable icon has a sky background, with the stone inside the 40% safe zone. Why: PWA icon rules.

### Tooling

- TS5101 was fixed by removing `baseUrl` and using relative `paths` (`./src/*`, `./content/*`). Why: this is what TS 6 recommends, instead of `ignoreDeprecations`.
- `vitest.config.ts` imports `./vite.config.ts` with its extension, and tsconfig.node sets `allowImportingTsExtensions`. Why: it is ready for Vite's native config loader, and safe because the config is noEmit.
- Test workers run with `--no-experimental-webstorage` when Node supports it. Why: Node 25's global localStorage would hide jsdom's.
- The e2e tests cover Today in light and dark (emulated colour scheme, axe clean) and check that no request leaves the app's origin (§12). Why: these are the Phase 0 acceptance criteria and the privacy rule.
- `.prettierignore` lists `docs/SPEC.md`, the content JSON, the fixtures, `playwright-report` and `test-results`. Why: the spec is the user's document, and the JSON keeps the spec's compact layout.
- `docs/design/check-tokens.mjs --sync` keeps the prototype's token block identical to tokens.css. Why: there is one source of tokens.
- No npm dependencies were added in Phase 0.
- The project Claude Code skills are in `.claude/skills/`: build-phase, import-chapter, kid-ui, engine-module, explainer-visual and content-edit. Why: later sessions don't have to re-derive the same context.

## 2026-10-30 · Phase C (Chemistry Ch 3 import) and Today catch-up

- Chemistry Ch 3 was imported from pp.58–62 only, in 4 × 45-min lessons, with the parent's OK. The opening pages, p.57 and Exercise 3.1 were not photographed. Why: the parent chose "go ahead now".
- The chapter title "Matter" and `book: REPLACE_ME` are placeholders. Why: the title page was missing, and the parent chose placeholders.
- ParticleBox props were extended (container, objects, heaped, compress, spread, highlight, compare, row, glow, viscous). They are documented in the explainer-visual skill. Why: so the book's own investigations could be shown.
- A past study slot is a catch-up until bedtime: amber stone, a "This one's waiting for you 🙂" sheet, and the Up now card offers it when nothing matches the clock. A missed test is not a catch-up. Why: §5.2. The parent asked that past lessons stay startable.
- Content tests no longer pin the exact lists of explainers and approved chapters. Why: every import and approval would break them.

## 2026-10-30 · Phase 2 (Lessons & videos), started early at the parent's request

### Engine

- The `true_false` response is `boolean | null`, where null means "not chosen yet". Why: `emptyResponse` must never grade as an answer.
- Text matching lowercases, trims, collapses spaces and drops one trailing full stop. Numbers parse with units ("12.4 cm") and tolerance, plus 1e-9 slack. Why: §8.2, so marking is forgiving.
- A unit counts as not correct only when `q.unit` is set, she typed a unit, and the two differ. Why: leaving the unit out is fine for an 11-year-old.
- Partial marks: match keys on the left item, order is scored by position, label keys on the hotspot id. `marksFor` rounds to 0.5. Why: §8.2.
- `LessonTemplate.minutes` is the time actually left. mini and check_only happen only with homework. The final-lesson shrink and homework stack. Why: §5.3–5.4.
- The lesson's own content wins for cards and practice. The template decides check count, eye break and video limits. Why: content is never dropped silently.
- Queue order: chapters in `plan.chapterOrder` first, then other approved chapters by `order`. Drafts and `taughtAlready` chapters are excluded. Why: §9.2, §13A.

### Explainers and video

- Narration plays one sentence at a time, with the caption moving on at each sentence's end. The speed handling is in the narrator (×0.95). If a voice never ends, the scene is released after 2× the estimate + 5 s. Why: §7.4, and so it never hangs.
- The timeline is a pure reducer (`src/explainers/timeline.ts`), and the hook ticks every 200 ms. Why: every timing rule can be tested.
- Captions sit under the picture (1.25rem, on by default). A checkpoint question takes the place of the picture inside the frame, and full screen is left first. Why: on phones the question would not fit over the video, and sheets are portalled.
- Checkpoints skipped by seeking ahead are asked after the last scene. A missing checkpoint question is skipped. Why: "watched" needs every checkpoint answered, and she must never be trapped.
- YouTube runs with `controls=0` and a shield over the iframe. The IFrame API loads only for real approved IDs. Why: §12, no stray links or requests.
- When full screen isn't available (iPad Safari), the player uses a CSS full-window layout. Why: the iPad allows full screen only on `<video>`.
- ParticleBox has 48 fixed particle slots that glide between layouts, and particle counts are conserved when pouring or melting. Why: smooth, and physically honest.

### Questions

- Options, match words, labels and order items are shuffled from the question id. Why: the order is the same after a reload.
- Keyboard and tap-tap work the same way. Dragging is mouse and touch only, starting after a 140 ms press. Why: dnd-kit's keyboard dragging clashes with Enter and Space, and the page must still scroll.
- "Try again" keeps typed text and right pairs, returns the not-quite ones, and clears a choice. Why: gentle, with no re-typing.
- Diagrams sit on a white panel with numbered spots and matching rows. Why: textbook drawings are made for paper, and text never overlaps the picture.
- The star pop shows on any first-try right answer and never under reduced motion. Self-check gets no star. Why: §15.9.

### Lesson flow

- Only today's slots play; other days get a friendly "This one's for another day 🙂". revise, test, review and multi-subject fix-it slots show "coming soon". A single-subject fix-it plays the next lesson. Why: §5.2; those flows are Phases 4–5.
- A slot resumes its own saved lesson. A lesson left unfinished in another slot starts fresh, and stays at the front of the queue. Why: §9.2, no content is ever lost.
- Mini and Check-only lessons log the slot as done but keep the lesson in the queue. Check-only uses the subject's last finished lesson. Why: §5.3.
- Next on Watch unlocks after the explainer ends with its checkpoints answered. "Explain it another way 🔄" is always there. Why: §7.2 "watched".
- Stars are +1 for finishing, +1 for a check of 80% or more, and +1 when all checkpoints were right. They are saved with `addStars()` in repos/rewards.ts. Levels and badges are Phase 3. Why: §10.
- The eye break comes after 20 minutes of screen time (homework and notebook don't count). It can be skipped once and returns 5 minutes later, and a 60-minute lesson also breaks halfway. Why: §7.7.
- Today reads the slot log: done stones are gold ✓ and never catch-ups, the progress line reads "N of M done", and the Up now card moves to the next slot that isn't done. Why: §5.1, §15.3.
- Open question for the parent: 30 minutes of homework on a 45-minute slot leaves 15 minutes, which gives Check only. Mini (20–29 minutes left) can't happen with the No/15/30/45 choices on today's slots. Why: it follows §5.3 literally.

## 2026-11-03 · Phase C (Maths Ch 5 "Fractions" import)

- Only pp.89–101 were imported. The parent said the earlier pages (intro, equivalent fractions, simplest form, Ex. 5A–5B) were done for the half-yearly exam, so Lesson 1 is a short refresher built from "Things to Remember" (p.101) and Ex. 5C. Why: the parent's call; no facts from the missing pages.
- The pages have no answer key, so answers were worked out with the book's own LCM method and checked with exact fraction arithmetic (a one-off generator), instead of marking ~130 questions needsReview. Why: the method is printed on pp.90–98, and the arithmetic can't be miscopied.
- Fraction answers are fill_blank text: `answer` is the book's final form (simplest, mixed when more than 1, e.g. "1 11/36") and `accept` holds the improper form ("47/36"), with or without the unit. Why: no grading-engine change is needed, and both forms are correct.
- The book's misprint on p.93 (Example 7: "<" signs and "8/5") is taught in its corrected form, with a gentle "printing slip" note on the card. Why: never teach a wrong order; tell her so the book doesn't confuse her.
- FractionBar was built now, not in Phase 7: the visual-registry test requires a component for every visual that content uses, and a fractions chapter without it would show "picture coming soon" everywhere. Its layout file is `fractionBarLayout.ts`. Why: `fractionBar.ts` and `FractionBar.tsx` are the same file on Windows' case-insensitive disk.

## 2026-11-04 · Phase C (Biology Ch 4 "Digestive System" import)

- The parent asked to build and approve in one step, so the lesson-split pause was skipped and the chapter was written with `status: "approved"`. The four uncertain answers are still flagged `needsReview` and listed in parentNotes. Why: the parent's explicit instruction; the flags keep the doubts visible.
- Ex. XIII Q6 is a short_answer, not the book's MCQ: only Sonu's observation is incorrect, and none of the printed options says so. Why: never make an option "right" that the pages contradict.
- DigestiveJourney was built now (a schematic: canal boxes from top to bottom, glands beside them, highlighted organs, a food dot), not the full body picture. Why: the registry test needs a component for every visual used, and a schematic can only show facts on the pages (it draws no blood vessels or bile ducts the book doesn't describe).
- lessonFlow.test.ts used `maths` as "a subject with no chapters"; now that maths is approved, it uses `english`. Why: the test's assumption went stale when the parent approved Fractions.
- 2026-11-04 · Phase 1 (Week view, early) — **Earlier days' lessons stay open to catch up** (parent request: "if they miss they can access it"). `resolveSlot` now plays any past date's lesson slot (`past: true`, eyebrow "Catch up from Monday"); only future days stay locked (§5.2). The Week view is a day picker for this week and last week: each day lists its study stones as ✅ Done (open again) · ⏳ Catch up (amber) · ▶️ Today · 🔒 locked · 🛠️ soon (tests/revise/review). Why: the queue already keeps a missed lesson at the front (§9.2), but she had no way back to a missed day's slot; "last week" keeps a missed Saturday/Sunday reachable on Monday. Progress and the ✅ log are saved under the original day's slot.
- 2026-11-05 · Phase C (History/Civics Ch 4) — One scan held four chapters: History Ch 4 "The First Cities" (pp.27–35) and Civics Ch 4 "Elements of a Democracy" (Civics pp.24–28) were imported and **approved automatically** at the parent's request. Geography Ch 6–7 photos were filed in `source/geography/` for a later import. Both chapters live in subject `history` (ids `his-first-cities`, `his-elements-of-democracy`; History first in `chapterOrder`). Why: subjects.json has one "History / Civics" subject.
- Civics Ex. III Q1 is a short_answer, not the book's MCQ: three of the four options are "direct" participation on pp.24–25. Why: never make an option "right" that the pages contradict (same rule as Biology Ex. XIII Q6).
- Civics p.27 is motion-blurred; its top paragraph was pieced together from the p.27 photo and the edge of the p.26 photo, and Ex. V Q2 is needsReview. Why: the exercises on the page were readable, so a re-photo was not worth blocking the import.
- Built `FlowChart` (boxes top to bottom, arrows for a sequence or none for a set; highlight by index) and used it for all 8 History/Civics explainers, instead of `TimelineScrubber` and `CityMap`. Why: one general visual fits timelines, the upper/lower town, causes of decline and the elements of democracy, and keeps the import small; CityMap/TimelineScrubber can come later.
- Week view now steps back week by week ("◀ Earlier", "Later ▶") to the week `plan.startDate` falls in, replacing This week / Last week; days before the start show "not started yet" and no catch-ups. Today shows "N lessons from earlier days are waiting → Open my week". Why: parent asked that old and previous days' work stay reachable on other days; before this, a day older than last week was unreachable, and pre-start days showed false catch-ups. New repo read `listSlotLogBetween(from, to)` loads the range in one query.
