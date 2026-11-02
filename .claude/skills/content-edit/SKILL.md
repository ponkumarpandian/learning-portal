---
name: content-edit
description: Use when adding or changing anything in /content for Avantika's Adventure (subjects.json, timetable.json slots, plan.json exam dates and chapter order, test-blueprint.json, chapter lessons, cards, questions, videos and checkpoints, explainer files) or when a validate-content error or warning needs fixing. For importing a new chapter from textbook pages, use import-chapter instead.
---

# Editing `/content` safely (SPEC §13, §4, §7.6, App A–D)

Content is JSON that is bundled at build time and validated by Zod. **The source of truth for the shape is `src/content/schemas.ts`.** For a compact field table, see [schema-quickref.md](schema-quickref.md). Copy-paste examples that are known to pass are in [snippets.json](snippets.json), covering every slot kind, every video kind, a subject, a scene and questions.

## Where things live

| File                                             | Holds                                                                                | Notes                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `content/subjects.json`                          | `Subject[]`                                                                          | `id` is used everywhere. `sessionsPerWeek` is checked against the timetable          |
| `content/timetable.json`                         | bedtime, `schoolNights`, `days.mon…sun: Slot[]`                                      | **The only source of slots** (App A)                                                 |
| `content/plan.json`                              | `startDate`, `exams`, `revisionDays`, `chapterOrder`, `taughtAlready`, `examPattern` | `REPLACE_ME` dates until the parent gives them (§18)                                 |
| `content/test-blueprint.json`                    | the section structure, mixes, windows, bands                                         | Weekly tests (App D)                                                                 |
| `content/chapters/<subject>/<file>.json`         | one `Chapter` each                                                                   | The folder must match `subject`. The kid sees only `status: "approved"`              |
| `content/explainers/<id>.json`                   | one `Explainer` each                                                                 | Visuals: see `explainer-visual`                                                      |
| `content/media/images/`, `content/media/videos/` | diagrams, local MP4s                                                                 | Referenced as `media/images/x.png`. The validator doesn't check that the files exist |

Files elsewhere under `content/` are reported as "not part of the content model".

## Golden rules

- Edit JSON only. **Never** copy content into components (§0.4). The app reads it through `loadContent()` / `useBundle()`.
- Real syllabus content comes from the textbooks only (`import-chapter`). Don't add facts to existing chapters from general knowledge.
- Content JSON is Prettier-ignored and keeps the spec's compact one-line-per-item style. Match the existing formatting.
- Ids use lowercase letters and dashes, and are **unique across all content**. That includes subjects, chapters, lessons, every question and explainers.
- **Always run** `npm run validate-content` after an edit, and fix every error. `npm test` runs the same checks, so CI fails on bad content.
- To check a folder other than `content/`, use `npm run validate-content -- --dir <path>`.

## Timetable edits

- Each slot is `{start, end, kind, …}` in 24h `HH:MM`, IST, and `start < end`. Slots on a day must not **overlap** (error). List them in time order (warning).
- Fields each kind needs (schema errors):
  - `lesson` / `homework_lesson`: a single `subject`
  - `revise` / `fixit` / `review`: `subject` or `subjects`
  - `test`: `testId` (`sat` or `sun`) and `subjects`. There must be **exactly 2** test slots, one `sat` and one `sun`
  - `activity` / `break` / `offline_task`: a `label` and no subject. Set `colour` to one of `tuition`, `lang`, `dance`, `sport` or `fun` (the colour token)
- **Session-count rule:** for each subject, count the slots that have a single `subject` and kind `lesson`, `homework_lesson`, `revise` or `fixit`. The count must equal `sessionsPerWeek` in subjects.json, or it is an **error**. A subject without `sessionsPerWeek` gets a warning that its count is not checked. Multi-subject (`subjects`) slots don't count. If you move a session, the count stays the same. If you add or remove one, update `sessionsPerWeek` too.
- A test slot's start should equal `test-blueprint.json` `windows.<id>.opens` (e.g. `"sat 15:30"`). Otherwise you get a warning.
- The app never adds slots by itself (§12). Extra catch-up slots are the parent's decision.

## Videos (§7.6, §12)

- There are 3 kinds: `explainer` (`explainerId`), `youtube` (`youtubeId`, `title`, optional `start`/`end` in seconds, and `checkpoints`) and `mp4` (`src` under `media/videos/`, `title`, `checkpoints`).
- Each lesson has one `role: "primary"`, which plays first, and an optional `"alternate"`, which plays for "explain it another way". Two primaries or two alternates is an **error**. A real (non-sample) chapter may not use a `sample: true` explainer (**error**, §13A).
- `youtubeId` is exactly 11 characters, or `"REPLACE_ME"`. **Only** the IDs listed in content can play. The player uses `https://www.youtube-nocookie.com/embed/{id}?enablejsapi=1&rel=0&playsinline=1&start=&end=&cc_load_policy=1`, and the app's own overlay covers the end screen. Never add search, links or other domains.
- With `REPLACE_ME`, a missing ID or no internet, the lesson's explainer plays if there is one. Otherwise the learn cards show with "Video not available right now — let's learn with cards! 🃏". The validator warns about `REPLACE_ME`.
- Always set `end` on YouTube clips (warning). Keep each segment to 8 minutes or less, and the primary videos in a lesson to 15 minutes or less (warnings).
- **Checkpoint:** `{ "at": s, "questionId": "…", "rewindTo": s }`, with `rewindTo ≤ at` and `at` inside `start…end`. Use at most 3 per video (a schema error above that), and aim for 1–3. `questionId` must point to a question in the **same chapter** (questionBank, practice or check), or in the questions of an explainer the lesson uses.
- Claude never picks YouTube videos. Suggest search words in `parentNotes`, and the parent chooses.

## Plan and blueprint edits

- `exams.mode` is `"single"` with `date`, or `"per_subject"` with `dates` (`subjectId → date`). Dates are `YYYY-MM-DD` or `REPLACE_ME`.
- `chapterOrder.<subject>` lists chapter ids in teaching order. Every id must exist and belong to that subject. A chapter that isn't listed gives a warning, because it won't be scheduled.
- Blueprint: the structure's `count × marksEach` must add up to `sectionMarks`. `sourceMix` and `difficultyMix` must each add up to 1. `bands` must be ordered from the highest `min` down to `min: 0`.

## Parent overrides (Phase 6 Content Manager)

At runtime, `loadContent(overrides)` merges `ContentOverride` records (`src/db/repos/contentOverrides.ts`):

- `chapter` and `explainer` overrides replace by `targetId ?? data.id`
- `timetable`, `plan` and `subjects` overrides replace the whole object

An override that fails Zod, or adds integrity errors, is **skipped** with a warning in `bundle.warnings`. The kid's view never crashes. To fold the parent's edits back into the files, take their data from the backup export, write it to the JSON file, and validate.

## Reading validator output

Each message looks like `file › json.path: message`.

- **Errors** (exit 1) must be fixed.
- **Warnings** you can expect on the samples: `REPLACE_ME` youtube/exam dates, and the SAMPLE "no source" summary.

Common fixes:

- `unknown field "x" — is it a typo?`: the schemas are strict. Check the spelling against the quick reference.
- `doesn't match any question`: a checkpoint or `variantOf` id is wrong, or the question is in another chapter.
- `has N single-subject study slot(s) a week`: the session-count rule above.
