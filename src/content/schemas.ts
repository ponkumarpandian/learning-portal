/**
 * Content model — SPEC §13 "Core types" (+ Appendix A, A2, C, D).
 *
 * Everything the parent might change lives in /content as JSON and is validated here with Zod 4.
 * Objects are strict (unknown keys are errors) so typos like "optons" are caught by validate-content.
 * Cross-file rules (unique ids, dangling references, timetable overlaps, …) live in ./validate.ts.
 *
 * Keep this file free of DOM / Vite / Node APIs: it is shared by the app and scripts/validate-content.ts.
 */
import { z } from 'zod';

/* ---------- small building blocks ---------- */

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const WeekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof WeekdaySchema>;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const HHMMSchema = z.string().regex(HHMM_RE, { error: 'must be a 24h time like "16:15"' });

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const DateKeySchema = z.string().regex(DATE_RE, { error: 'must be a date like "2026-11-02"' });

/** The literal the spec uses for "the parent hasn't filled this in yet". */
export const REPLACE_ME = 'REPLACE_ME';

const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, {
  error: 'ids use lowercase letters, digits and dashes, e.g. "phy-light-1"',
});
const SubjectIdSchema = IdSchema;
export type SubjectId = string;

const NonEmpty = z.string().trim().min(1, { error: 'must not be empty' });

/** "HH:MM" → minutes after midnight. Assumes a valid HH:MM string. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/* ---------- Subjects (Appendix A2 + §3 sessions per week) ---------- */

export const SubjectSchema = z.strictObject({
  id: SubjectIdSchema,
  name: NonEmpty,
  emoji: NonEmpty,
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'must be a hex colour like "#3f7bf6"' }),
  sessionsPerWeek: z.int().min(0).optional(),
});
export type Subject = z.infer<typeof SubjectSchema>;
export const SubjectsSchema = z.array(SubjectSchema).min(1);

/* ---------- Timetable (§4, Appendix A) ---------- */

export const SLOT_KINDS = [
  'lesson',
  'homework_lesson',
  'revise',
  'fixit',
  'test',
  'review',
  'activity',
  'break',
  'offline_task',
] as const;
export const SlotKindSchema = z.enum(SLOT_KINDS);
export type SlotKind = z.infer<typeof SlotKindSchema>;

/** Slot kinds that are study time inside the app (they use a subject queue). */
export const STUDY_KINDS: readonly SlotKind[] = ['lesson', 'homework_lesson', 'revise', 'fixit'];

/** Colour token names allowed on non-subject slots (§3). */
export const SLOT_COLOUR_TOKENS = ['tuition', 'lang', 'dance', 'sport', 'fun'] as const;

export const TEST_IDS = ['sat', 'sun'] as const;
export type TestId = (typeof TEST_IDS)[number];

export const SlotSchema = z
  .strictObject({
    start: HHMMSchema,
    end: HHMMSchema,
    kind: SlotKindSchema,
    subject: SubjectIdSchema.optional(),
    subjects: z.array(SubjectIdSchema).min(1).optional(),
    testId: z.enum(TEST_IDS).optional(),
    label: z.string().optional(),
    focus: z.string().optional(),
    emoji: z.string().optional(),
    colour: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (message: string, path: string[] = []) => ctx.addIssue({ code: 'custom', message, path });
    if (HHMM_RE.test(s.start) && HHMM_RE.test(s.end) && toMinutes(s.start) >= toMinutes(s.end)) {
      issue(`start (${s.start}) must be before end (${s.end})`, ['end']);
    }
    if (s.subject && s.subjects) issue('use either "subject" or "subjects", not both', ['subjects']);
    switch (s.kind) {
      case 'lesson':
      case 'homework_lesson':
        if (!s.subject) issue(`a "${s.kind}" slot needs a "subject"`, ['subject']);
        if (s.subjects) issue(`a "${s.kind}" slot takes a single "subject", not "subjects"`, ['subjects']);
        break;
      case 'revise':
      case 'fixit':
      case 'review':
        if (!s.subject && !s.subjects) issue(`a "${s.kind}" slot needs "subject" or "subjects"`, ['subject']);
        break;
      case 'test':
        if (!s.testId) issue('a "test" slot needs a "testId" ("sat" or "sun")', ['testId']);
        if (!s.subjects) issue('a "test" slot needs "subjects"', ['subjects']);
        break;
      case 'activity':
      case 'break':
      case 'offline_task':
        if (!s.label?.trim()) issue(`a "${s.kind}" slot needs a "label"`, ['label']);
        if (s.subject || s.subjects)
          issue(`a "${s.kind}" slot is not studied in the app, so it has no subject`, ['subject']);
        break;
    }
    if (s.testId && s.kind !== 'test') issue('"testId" is only for "test" slots', ['testId']);
  });
export type Slot = z.infer<typeof SlotSchema>;

const DaySlots = z.array(SlotSchema);

export const TimetableSchema = z.strictObject({
  timezone: z.literal('Asia/Kolkata'),
  bedtime: z.strictObject({ schoolNights: HHMMSchema, weekendNights: HHMMSchema }),
  /** Nights before a school day (Sun–Thu) — the school-night bedtime applies. */
  schoolNights: z.array(WeekdaySchema),
  days: z.strictObject({
    mon: DaySlots,
    tue: DaySlots,
    wed: DaySlots,
    thu: DaySlots,
    fri: DaySlots,
    sat: DaySlots,
    sun: DaySlots,
  }),
});
export type Timetable = z.infer<typeof TimetableSchema>;

/* ---------- Sources (§13A) ---------- */

export const SourceSchema = z
  .strictObject({
    pages: z.array(z.int().positive()).min(1).optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .refine((s) => s.pages !== undefined || s.notes !== undefined, {
    error: 'a source needs "pages" (book page numbers) or "notes" (a notes/worksheet file name)',
  });
export type Source = z.infer<typeof SourceSchema>;

/* ---------- Questions (§8.2, §13) ---------- */

export const QUESTION_TYPES = [
  'mcq',
  'true_false',
  'fill_blank',
  'match',
  'order',
  'label_diagram',
  'numeric',
  'short_answer',
  'think_write',
] as const;
export const QuestionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const DIFFICULTIES = ['easy', 'medium', 'challenge'] as const;
export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const VideoRefSchema = z.strictObject({
  video: z.enum(['primary', 'alternate']),
  at: z.number().min(0).optional(),
  /** 0-based scene index inside an explainer video */
  scene: z.int().min(0).optional(),
});
export type VideoRef = z.infer<typeof VideoRefSchema>;

export const HotspotSchema = z.strictObject({
  id: NonEmpty,
  x: z.number(),
  y: z.number(),
  label: NonEmpty,
});

export const QuestionSchema = z
  .strictObject({
    id: IdSchema,
    type: QuestionTypeSchema,
    prompt: NonEmpty,
    difficulty: DifficultySchema,
    marks: z.number().positive(),
    /** required inside a chapter questionBank (checked by validate-content) */
    lessonId: IdSchema.optional(),
    explanation: NonEmpty,
    hints: z.array(NonEmpty).optional(),
    videoRef: VideoRefSchema.optional(),
    variantOf: IdSchema.optional(),
    // type-specific fields
    options: z.array(NonEmpty).optional(),
    answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
    accept: z.array(z.string()).optional(),
    tolerance: z.number().min(0).optional(),
    unit: z.string().optional(),
    pairs: z.array(z.tuple([NonEmpty, NonEmpty])).optional(),
    sequence: z.array(NonEmpty).optional(),
    image: z.string().optional(),
    hotspots: z.array(HotspotSchema).optional(),
    modelAnswer: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    // provenance (required for non-sample chapters, §13A)
    source: SourceSchema.optional(),
    fromBook: z.boolean().optional(),
    bookRef: z.string().optional(),
    needsReview: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
    switch (q.type) {
      case 'mcq': {
        if (!q.options || q.options.length < 2 || q.options.length > 4) {
          issue(`an mcq needs 2–4 "options" (found ${q.options?.length ?? 0})`, 'options');
        } else if (new Set(q.options).size !== q.options.length) {
          issue('mcq "options" must all be different', 'options');
        }
        if (typeof q.answer !== 'string')
          issue('an mcq needs a text "answer" that is one of the options', 'answer');
        else if (q.options && !q.options.includes(q.answer)) {
          issue(`mcq "answer" "${q.answer}" is not one of the options`, 'answer');
        }
        break;
      }
      case 'true_false':
        if (typeof q.answer !== 'boolean')
          issue('a true_false question needs "answer": true or false', 'answer');
        break;
      case 'fill_blank':
        if (typeof q.answer !== 'string' && typeof q.answer !== 'number') {
          issue('a fill_blank question needs a text or number "answer"', 'answer');
        } else if (typeof q.answer === 'string' && !q.answer.trim())
          issue('"answer" must not be empty', 'answer');
        break;
      case 'match':
        if (!q.pairs || q.pairs.length < 2)
          issue(`a match question needs at least 2 "pairs" (found ${q.pairs?.length ?? 0})`, 'pairs');
        break;
      case 'order':
        if (!q.sequence || q.sequence.length < 2) {
          issue(
            `an order question needs at least 2 items in "sequence" (found ${q.sequence?.length ?? 0})`,
            'sequence',
          );
        }
        break;
      case 'label_diagram':
        if (!q.image?.trim()) issue('a label_diagram question needs an "image"', 'image');
        if (!q.hotspots || q.hotspots.length < 1)
          issue('a label_diagram question needs at least 1 hotspot', 'hotspots');
        else if (new Set(q.hotspots.map((h) => h.id)).size !== q.hotspots.length)
          issue('hotspot ids must be unique', 'hotspots');
        break;
      case 'numeric':
        if (typeof q.answer !== 'number') issue('a numeric question needs a number "answer"', 'answer');
        break;
      case 'short_answer':
      case 'think_write':
        if (!q.modelAnswer?.trim()) issue(`a ${q.type} question needs a "modelAnswer"`, 'modelAnswer');
        break;
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

/* ---------- Videos (§7) ---------- */

export const CheckpointSchema = z
  .strictObject({
    at: z.number().min(0),
    questionId: IdSchema,
    rewindTo: z.number().min(0),
  })
  .refine((c) => c.rewindTo <= c.at, { error: '"rewindTo" must not be after "at"', path: ['rewindTo'] });
export type Checkpoint = z.infer<typeof CheckpointSchema>;

const VideoRole = z.enum(['primary', 'alternate']);

const ExplainerVideoSchema = z.strictObject({
  role: VideoRole,
  kind: z.literal('explainer'),
  explainerId: IdSchema,
});

const YoutubeVideoSchema = z
  .strictObject({
    role: VideoRole,
    kind: z.literal('youtube'),
    youtubeId: z.string().regex(/^([A-Za-z0-9_-]{11}|REPLACE_ME)$/, {
      error: 'must be an 11-character YouTube video id (or "REPLACE_ME")',
    }),
    title: NonEmpty,
    start: z.number().min(0).optional(),
    end: z.number().positive().optional(),
    checkpoints: z.array(CheckpointSchema).max(3, { error: 'a video has at most 3 checkpoints' }),
  })
  .superRefine((v, ctx) => {
    const start = v.start ?? 0;
    if (v.end !== undefined && v.end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: `"end" (${v.end}) must be after "start" (${start})`,
        path: ['end'],
      });
    }
    v.checkpoints.forEach((c, i) => {
      if (c.at < start || (v.end !== undefined && c.at > v.end)) {
        ctx.addIssue({
          code: 'custom',
          message: `checkpoint at ${c.at}s is outside the clip (${start}–${v.end ?? '…'}s)`,
          path: ['checkpoints', i, 'at'],
        });
      }
    });
  });

const Mp4VideoSchema = z.strictObject({
  role: VideoRole,
  kind: z.literal('mp4'),
  src: NonEmpty,
  title: NonEmpty,
  checkpoints: z.array(CheckpointSchema).max(3, { error: 'a video has at most 3 checkpoints' }),
});

export const VideoSchema = z.discriminatedUnion('kind', [
  ExplainerVideoSchema,
  YoutubeVideoSchema,
  Mp4VideoSchema,
]);
export type Video = z.infer<typeof VideoSchema>;

/* ---------- Cards & lessons ---------- */

export const FlashcardSchema = z.strictObject({
  front: NonEmpty,
  back: NonEmpty,
  source: SourceSchema.optional(),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const LearnCardSchema = z.strictObject({
  title: NonEmpty,
  body: NonEmpty,
  emoji: z.string().optional(),
  image: z.string().optional(),
  example: z.string().optional(),
  didYouKnow: z.string().optional(),
  reveal: z.string().optional(),
  source: SourceSchema.optional(),
});
export type LearnCard = z.infer<typeof LearnCardSchema>;

export const LessonSchema = z.strictObject({
  id: IdSchema,
  title: NonEmpty,
  videos: z.array(VideoSchema),
  warmup: z.array(FlashcardSchema).optional(),
  cards: z.array(LearnCardSchema).min(1, { error: 'a lesson needs at least 1 learn card' }),
  practice: z.array(QuestionSchema),
  notebook: z.string(),
  check: z.array(QuestionSchema),
  keyRules: z.array(NonEmpty),
  /** pages this lesson covers — required for non-sample chapters (validate-content) */
  source: SourceSchema.optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

/* ---------- Chapters ---------- */

export const BookSchema = z.strictObject({
  title: NonEmpty,
  publisher: NonEmpty,
  edition: z.string().optional(),
  chapterNo: z.int().positive().optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const ChapterSchema = z.strictObject({
  id: IdSchema,
  subject: SubjectIdSchema,
  title: NonEmpty,
  order: z.number(),
  sample: z.boolean().optional(),
  status: z.enum(['draft', 'approved']),
  book: BookSchema.optional(),
  sourceDir: z.string().optional(),
  parentNotes: z.array(z.string()).optional(),
  lessons: z.array(LessonSchema).min(1, { error: 'a chapter needs at least 1 lesson' }),
  questionBank: z.array(QuestionSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;

/* ---------- Explainers (§7.4, §7.5, Appendix C) ---------- */

/** Every visual component in the §7.5 registry. `scene.visual` must be one of these. */
export const VISUAL_NAMES = [
  'NumberLine',
  'FractionBar',
  'RatioMixer',
  'AngleTool',
  'GridArea',
  'MeasureRuler',
  'ForceArrows',
  'LeverSeesaw',
  'LightRay',
  'MagnetField',
  'ParticleBox',
  'SeparationLab',
  'ChangeSorter',
  'AirMix',
  'CellExplorer',
  'LeafFactory',
  'DigestiveJourney',
  'FlowerParts',
  'FoodChain',
  'TimelineScrubber',
  'CityMap',
  'FlowChart',
  'EarthMotion',
  'GlobeGrid',
  'LandformMorph',
  'MapReader',
  'TenseTimeline',
  'SentenceBuilder',
] as const;
export type VisualName = (typeof VISUAL_NAMES)[number];

const PropsSchema = z.record(z.string(), z.unknown());

export const SceneStepSchema = z.strictObject({
  /** seconds after the scene starts */
  at: z.number().min(0),
  props: PropsSchema,
});

export const SceneSchema = z.strictObject({
  visual: z.enum(VISUAL_NAMES, {
    error: 'must be a visual from the §7.5 registry (e.g. "LightRay", "ParticleBox")',
  }),
  props: PropsSchema,
  narration: NonEmpty,
  /** defaults to the narration */
  captions: z.string().optional(),
  /** seconds; the scene lasts max(narration, minDuration) */
  minDuration: z.number().positive(),
  steps: z.array(SceneStepSchema).optional(),
  checkpoint: z.strictObject({ questionId: IdSchema }).optional(),
  source: SourceSchema.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ExplainerSchema = z.strictObject({
  id: IdSchema,
  subject: SubjectIdSchema,
  title: NonEmpty,
  sample: z.boolean().optional(),
  source: SourceSchema.optional(),
  scenes: z.array(SceneSchema).min(1, { error: 'an explainer needs at least 1 scene' }),
  questions: z.array(QuestionSchema).default([]),
});
export type Explainer = z.infer<typeof ExplainerSchema>;

/* ---------- Plan & test blueprint (§9, §8.3, Appendix D) ---------- */

const DateOrPlaceholder = z.union([DateKeySchema, z.literal(REPLACE_ME)]);

export const ExamSectionSchema = z.strictObject({
  section: NonEmpty,
  title: NonEmpty,
  types: z.array(QuestionTypeSchema).min(1),
  marks: z.number().positive(),
});
export type ExamSection = z.infer<typeof ExamSectionSchema>;

export const PlanSchema = z.strictObject({
  startDate: DateKeySchema,
  exams: z
    .strictObject({
      mode: z.enum(['single', 'per_subject']),
      /** mode "single": one date for every subject */
      date: DateOrPlaceholder.optional(),
      /** mode "per_subject": subjectId → date */
      dates: z.record(z.string(), DateOrPlaceholder).optional(),
    })
    .superRefine((e, ctx) => {
      if (e.mode === 'single' && !e.date)
        ctx.addIssue({ code: 'custom', message: 'mode "single" needs "date"', path: ['date'] });
      if (e.mode === 'per_subject' && !e.dates) {
        ctx.addIssue({ code: 'custom', message: 'mode "per_subject" needs "dates"', path: ['dates'] });
      }
    }),
  revisionDays: z.int().min(0),
  /** subjectId → ordered chapter ids */
  chapterOrder: z.record(z.string(), z.array(IdSchema)),
  /** chapter ids already taught in school (go straight to revision) */
  taughtAlready: z.array(IdSchema),
  /** "default" plus optional per-subject patterns */
  examPattern: z.record(z.string(), z.array(ExamSectionSchema).min(1)).refine((p) => 'default' in p, {
    error: 'examPattern needs a "default" pattern',
  }),
});
export type Plan = z.infer<typeof PlanSchema>;

const Share = z.number().min(0).max(1);
const WINDOW_RE = /^(mon|tue|wed|thu|fri|sat|sun) ([01]\d|2[0-3]):[0-5]\d$/;
const WindowPoint = z.string().regex(WINDOW_RE, { error: 'must look like "sat 15:30"' });
const TestWindowSchema = z.strictObject({ opens: WindowPoint, closes: WindowPoint });

export const TestBlueprintSchema = z.strictObject({
  sectionMinutes: z.number().positive(),
  sectionMarks: z.number().positive(),
  structure: z
    .array(
      z.strictObject({
        count: z.int().positive(),
        marksEach: z.number().positive(),
        types: z.array(QuestionTypeSchema).min(1),
      }),
    )
    .min(1),
  sourceMix: z.strictObject({ sinceLastTest: Share, weakTopics: Share, spacedReview: Share }),
  difficultyMix: z.strictObject({ easy: Share, medium: Share, challenge: Share }),
  fallback: z.string(),
  windows: z.strictObject({ sat: TestWindowSchema, sun: TestWindowSchema }),
  bands: z
    .array(z.strictObject({ min: z.number().min(0).max(100), label: NonEmpty, emoji: NonEmpty }))
    .min(1),
});
export type TestBlueprint = z.infer<typeof TestBlueprintSchema>;

/* ---------- Parent content overrides (§11 Content Manager, stored in IndexedDB) ---------- */

export const OVERRIDE_TARGETS = ['chapter', 'timetable', 'plan', 'subjects', 'explainer'] as const;
export type OverrideTarget = (typeof OVERRIDE_TARGETS)[number];

export const ContentOverrideSchema = z.object({
  id: z.string().min(1),
  target: z.enum(OVERRIDE_TARGETS),
  /** chapter / explainer id being replaced; defaults to data.id */
  targetId: z.string().optional(),
  data: z.unknown(),
  updatedAt: z.number(),
});
export type ContentOverride = z.infer<typeof ContentOverrideSchema>;
