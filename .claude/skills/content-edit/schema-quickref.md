# Schema quick reference

Every object is **strict**, so an unknown key is an error. `?` means optional. The real definitions are in `src/content/schemas.ts`. The extra rules marked **[V]** come from `src/content/validate.ts` (`npm run validate-content`).

## Subject (`subjects.json`, an array of at least 1)

`id` (kebab) · `name` · `emoji` · `colour` (`#rrggbb`) · `sessionsPerWeek?` (int) **[V]** must match the timetable (warning when absent)

## Timetable

`timezone: "Asia/Kolkata"` · `bedtime: {schoolNights, weekendNights}` (HH:MM) · `schoolNights: Weekday[]` · `days: {mon…sun: Slot[]}`

**Slot:** `start`, `end` (HH:MM, start < end) · `kind` · `subject?` · `subjects?` · `testId?` (`sat`\|`sun`) · `label?` · `focus?` · `emoji?` · `colour?`. The fields each kind needs are listed in SKILL.md. **[V]** no overlaps, exactly one `sat` test and one `sun` test, and session counts must match.

## Chapter

| Field                             | Type                                       | Notes                                                                                                       |
| --------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `id`, `subject`, `title`, `order` | string, string, string, number             |                                                                                                             |
| `sample?`                         | boolean                                    | seed content only, which relaxes the source rules                                                           |
| `status`                          | `draft` \| `approved`                      | the kid sees only `approved`                                                                                |
| `book?`                           | `{title, publisher, edition?, chapterNo?}` | **[V]** required unless `sample`                                                                            |
| `sourceDir?`, `parentNotes?`      | string, string[]                           | the notes are where the video search words go                                                               |
| `lessons`                         | Lesson[] (at least 1)                      |                                                                                                             |
| `questionBank`                    | Question[]                                 | **[V]** at least 10, with easy, medium and challenge; each needs a `lessonId`; aim for 4 or more per lesson |

## Lesson

`id` · `title` · `videos: Video[]` · `warmup?: Flashcard[]` (`{front, back, source?}`) · `cards: LearnCard[]` (at least 1) · `practice: Question[]` **[V]** each needs `hints` · `notebook` **[V]** not empty · `check: Question[]` **[V]** 3–6 · `keyRules: string[]` · `source?` **[V]** required unless sample

**LearnCard:** `title` · `body` · `emoji?` · `image?` · `example?` · `didYouKnow?` · `reveal?` · `source?`

**Source:** `{pages?: int[], notes?: string}`, with at least one of the two.

## Video (discriminated by `kind`)

- `{role, kind:"explainer", explainerId}`
- `{role, kind:"youtube", youtubeId (11 chars or REPLACE_ME), title, start?, end?, checkpoints (at most 3)}`
- `{role, kind:"mp4", src, title, checkpoints (at most 3)}`
- `role` is `primary` or `alternate`. **[V]** at most one of each per lesson; a non-sample chapter cannot use a `sample` explainer. A checkpoint is `{at, questionId, rewindTo ≤ at}`.

## Question

Common fields: `id` · `type` · `prompt` · `difficulty` (`easy|medium|challenge`) · `marks` (> 0) · `explanation` (the "Why" column) · `lessonId?` · `hints?` · `videoRef?` `{video: primary|alternate, at?, scene? (0-based)}` · `variantOf?` · `source?` · `fromBook?` · `bookRef?` **[V]** required when `fromBook` · `needsReview?`

| type                          | Required fields                                                   | Optional                        |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| `mcq`                         | `options` (2–4, all different), `answer` (one of the options)     |                                 |
| `true_false`                  | `answer: boolean`                                                 |                                 |
| `fill_blank`                  | `answer: string \| number`                                        | `accept[]`, `tolerance`, `unit` |
| `match`                       | `pairs: [[left, right], …]` (at least 2)                          |                                 |
| `order`                       | `sequence: [...]` (at least 2, in the right order)                |                                 |
| `label_diagram`               | `image`, `hotspots: [{id, x, y, label}]` (at least 1, unique ids) |                                 |
| `numeric`                     | `answer: number`                                                  | `tolerance`, `unit`             |
| `short_answer`, `think_write` | `modelAnswer`                                                     | `keywords[]`                    |

## Explainer

`id` · `subject` · `title` · `sample?` · `source?` · `scenes: Scene[]` (at least 1) · `questions: Question[]` (default `[]`)

**Scene:** `visual` (from `VISUAL_NAMES`) · `props: {}` · `narration` · `captions?` · `minDuration` (> 0 s) · `steps?: [{at, props}]` · `checkpoint?: {questionId}` · `source?`

## Plan

`startDate` · `exams: {mode: single|per_subject, date?, dates?}` · `revisionDays` (int) · `chapterOrder: {subject: chapterId[]}` · `taughtAlready: chapterId[]` · `examPattern: {default: ExamSection[], <subject>?: …}`. An ExamSection is `{section, title, types[], marks}`.

## TestBlueprint

`sectionMinutes` · `sectionMarks` · `structure: [{count, marksEach, types[]}]` · `sourceMix: {sinceLastTest, weakTopics, spacedReview}` · `difficultyMix: {easy, medium, challenge}` · `fallback` · `windows: {sat|sun: {opens, closes}}` (each like `"sat 15:30"`) · `bands: [{min, label, emoji}]`

## ContentOverride (IndexedDB, not a file)

`{id, target: chapter|timetable|plan|subjects|explainer, targetId?, data, updatedAt}`
