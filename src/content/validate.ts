/**
 * Content validator — SPEC §13 "npm run validate-content must check", §7.7, §13A, Appendix A note.
 *
 * PURE: takes already-parsed JSON (RawContent) and returns human-readable messages that name the
 * file and the JSON path, e.g.
 *   content/chapters/physics/light.json › lessons[0].check: needs at least 3 questions (found 2)
 *
 * Issue kinds:
 *   schema     – the file doesn't match the Zod schema
 *   integrity  – something the kid's view would trip over (duplicate ids, dangling references, overlaps)
 *   authoring  – content-quality rules (counts, sources, mixes); these never block a parent override
 */
import type { z } from 'zod';
import type { RawContent, RawFile } from './raw';
import {
  ChapterSchema,
  DIFFICULTIES,
  ExplainerSchema,
  PlanSchema,
  REPLACE_ME,
  SLOT_COLOUR_TOKENS,
  STUDY_KINDS,
  SubjectsSchema,
  TestBlueprintSchema,
  TimetableSchema,
  WEEKDAYS,
  toMinutes,
  type Chapter,
  type Explainer,
  type Lesson,
  type Question,
  type Scene,
  type Slot,
  type Source,
  type Subject,
  type Video,
} from './schemas';

export type { RawContent, RawFile } from './raw';

export type IssueLevel = 'error' | 'warning';
export type IssueKind = 'schema' | 'integrity' | 'authoring';

export interface ContentIssue {
  level: IssueLevel;
  kind: IssueKind;
  file: string;
  /** JSON path like "lessons[0].check" ("" = the whole file) */
  path: string;
  message: string;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/* ---------- limits (§7.7, §13, Appendix F) ---------- */

export const LIMITS = {
  videoSegmentSeconds: 8 * 60,
  videoPerLessonSeconds: 15 * 60,
  minCheck: 3,
  maxCheck: 6,
  minQuestionBank: 10,
  minBankPerLesson: 4,
  maxCheckpoints: 3,
} as const;

/** Narration speed used to estimate explainer length (speechSynthesis at rate 0.95 ≈ 140 wpm). */
const WORDS_PER_SECOND = 2.3;

export function estimateSceneSeconds(scene: Pick<Scene, 'narration' | 'minDuration'>): number {
  const words = scene.narration.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(scene.minDuration, Math.ceil(words / WORDS_PER_SECOND));
}

export function estimateExplainerSeconds(ex: Pick<Explainer, 'scenes'>): number {
  return ex.scenes.reduce((sum, s) => sum + estimateSceneSeconds(s), 0);
}

/* ---------- formatting ---------- */

export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

export function formatIssue(i: Pick<ContentIssue, 'file' | 'path' | 'message'>): string {
  return i.path ? `${i.file} › ${i.path}: ${i.message}` : `${i.file}: ${i.message}`;
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return sec ? `${m} min ${sec} s` : `${m} min`;
};

class Issues {
  readonly list: ContentIssue[] = [];
  private add(
    level: IssueLevel,
    kind: IssueKind,
    file: string,
    path: readonly PropertyKey[],
    message: string,
  ) {
    this.list.push({ level, kind, file, path: formatPath(path), message });
  }
  err(kind: IssueKind, file: string, path: readonly PropertyKey[], message: string) {
    this.add('error', kind, file, path, message);
  }
  warn(kind: IssueKind, file: string, path: readonly PropertyKey[], message: string) {
    this.add('warning', kind, file, path, message);
  }
}

const article = (w: string) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);

/** Rephrases Zod's default wording into plainer English for the parent. */
export function friendlyZodMessage(message: string): string {
  const t = /^Invalid input: expected (\w+), received (\w+)$/.exec(message);
  if (t)
    return t[2] === 'undefined'
      ? `is required (${article(t[1]!)})`
      : `should be ${article(t[1]!)}, but found ${article(t[2]!)}`;
  const k = /^Unrecognized keys?: (.+)$/.exec(message);
  if (k) return `unknown field ${k[1]} — is it a typo?`;
  return message;
}

function parse<T>(
  schema: z.ZodType<T>,
  rf: RawFile | undefined,
  missingName: string,
  out: Issues,
): T | undefined {
  if (!rf) {
    out.err('schema', missingName, [], 'file is missing');
    return undefined;
  }
  const r = schema.safeParse(rf.data);
  if (!r.success) {
    for (const iss of r.error.issues) out.err('schema', rf.file, iss.path, issueMessage(iss, rf.data));
    return undefined;
  }
  return r.data;
}

function valueAt(data: unknown, path: readonly PropertyKey[]): { parent: boolean; value: unknown } {
  let cur: unknown = data;
  for (let i = 0; i < path.length; i++) {
    if (cur === null || typeof cur !== 'object') return { parent: false, value: undefined };
    cur = (cur as Record<PropertyKey, unknown>)[path[i]!];
  }
  return { parent: true, value: cur };
}

/** Zod issue → parent-friendly text; a field that is simply absent always reads "is required". */
function issueMessage(iss: z.core.$ZodIssue, data: unknown): string {
  const at = valueAt(data, iss.path);
  if (iss.path.length && at.parent && at.value === undefined) {
    if (iss.code === 'invalid_value')
      return `is required (one of ${iss.values.map((v) => JSON.stringify(v)).join(' | ')})`;
    if (iss.code === 'invalid_union') return 'is required';
  }
  return friendlyZodMessage(iss.message);
}

/** `id` of a file that failed its schema, when it still has a string id (to silence follow-on errors). */
function rawId(rf: RawFile): string | undefined {
  const d = rf.data as { id?: unknown } | null;
  return d && typeof d === 'object' && typeof d.id === 'string' ? d.id : undefined;
}

/* ---------- main ---------- */

interface QuestionRef {
  q: Question;
  file: string;
  path: PropertyKey[];
  /** lesson the question belongs to (practice/check lesson, or questionBank lessonId) */
  lesson?: Lesson;
}

export function collectIssues(raw: RawContent): ContentIssue[] {
  const out = new Issues();
  const root = raw.root ?? 'content';

  for (const f of raw.unknown ?? []) {
    out.warn('authoring', f, [], 'this file is not part of the content model (§13) and is ignored');
  }

  const subjects = parse(SubjectsSchema, raw.subjects, `${root}/subjects.json`, out);
  const timetable = parse(TimetableSchema, raw.timetable, `${root}/timetable.json`, out);
  const plan = parse(PlanSchema, raw.plan, `${root}/plan.json`, out);
  const blueprint = parse(TestBlueprintSchema, raw.blueprint, `${root}/test-blueprint.json`, out);

  // ids of chapter/explainer files that failed their schema: references to them are not reported
  // again as "doesn't match any file" — the schema errors above already say what to fix.
  const brokenIds = new Set<string>();
  const chapters: { file: string; ch: Chapter }[] = [];
  for (const rf of raw.chapters) {
    const ch = parse(ChapterSchema, rf, rf.file, out);
    if (ch) chapters.push({ file: rf.file, ch });
    else if (rawId(rf)) brokenIds.add(rawId(rf)!);
  }
  const explainers: { file: string; ex: Explainer }[] = [];
  for (const rf of raw.explainers) {
    const ex = parse(ExplainerSchema, rf, rf.file, out);
    if (ex) explainers.push({ file: rf.file, ex });
    else if (rawId(rf)) brokenIds.add(rawId(rf)!);
  }

  /* --- ids: unique across ALL content (subjects, chapters, lessons, questions, explainers) --- */
  const ids = new Map<string, string>();
  const claim = (id: string, file: string, path: PropertyKey[]) => {
    const prev = ids.get(id);
    if (prev) out.err('integrity', file, path, `duplicate id "${id}" (already used at ${prev})`);
    else ids.set(id, formatIssue({ file, path: formatPath(path), message: '' }).replace(/: $/, ''));
  };

  const subjectById = new Map<string, Subject>();
  subjects?.forEach((s, i) => {
    claim(s.id, raw.subjects!.file, [i, 'id']);
    subjectById.set(s.id, s);
  });
  const checkSubject = (id: string, file: string, path: PropertyKey[]) => {
    if (subjects && !subjectById.has(id)) {
      out.err('integrity', file, path, `unknown subject "${id}" (not in subjects.json)`);
    }
  };

  const questions = new Map<string, QuestionRef>();
  const indexQuestion = (ref: QuestionRef) => {
    claim(ref.q.id, ref.file, [...ref.path, 'id']);
    if (!questions.has(ref.q.id)) questions.set(ref.q.id, ref);
  };

  const explainerById = new Map<string, Explainer>();
  for (const { file, ex } of explainers) {
    claim(ex.id, file, ['id']);
    if (!explainerById.has(ex.id)) explainerById.set(ex.id, ex);
    ex.questions.forEach((q, i) => indexQuestion({ q, file, path: ['questions', i] }));
  }

  const chapterById = new Map<string, Chapter>();
  for (const { file, ch } of chapters) {
    claim(ch.id, file, ['id']);
    if (!chapterById.has(ch.id)) chapterById.set(ch.id, ch);
    ch.lessons.forEach((l, li) => {
      claim(l.id, file, ['lessons', li, 'id']);
      l.practice.forEach((q, i) =>
        indexQuestion({ q, file, path: ['lessons', li, 'practice', i], lesson: l }),
      );
      l.check.forEach((q, i) => indexQuestion({ q, file, path: ['lessons', li, 'check', i], lesson: l }));
    });
    ch.questionBank.forEach((q, i) => {
      const lesson = ch.lessons.find((l) => l.id === q.lessonId);
      indexQuestion({ q, file, path: ['questionBank', i], lesson });
    });
  }

  /* --- chapters --- */
  for (const { file, ch } of chapters) checkChapter(file, ch);

  function checkChapter(file: string, ch: Chapter) {
    const sample = ch.sample === true;
    const missingSource: PropertyKey[][] = [];
    const needSource = (src: Source | undefined, path: PropertyKey[]) => {
      if (!src) missingSource.push(path);
    };

    checkSubject(ch.subject, file, ['subject']);
    const folder = /\/chapters\/([^/]+)\//.exec(file)?.[1];
    if (folder && folder !== ch.subject) {
      out.warn(
        'authoring',
        file,
        ['subject'],
        `chapter subject "${ch.subject}" doesn't match its folder "chapters/${folder}/"`,
      );
    }
    if (!ch.book) {
      if (sample) missingSource.push(['book']);
      else
        out.err(
          'authoring',
          file,
          ['book'],
          'a real (non-sample) chapter needs "book": { title, publisher } (§13A)',
        );
    }

    const chapterQuestionIds = new Set<string>([
      ...ch.questionBank.map((q) => q.id),
      ...ch.lessons.flatMap((l) => [...l.practice, ...l.check].map((q) => q.id)),
    ]);

    ch.lessons.forEach((l, li) => {
      const lp: PropertyKey[] = ['lessons', li];
      if (l.check.length < LIMITS.minCheck) {
        out.err(
          'authoring',
          file,
          [...lp, 'check'],
          `needs at least ${LIMITS.minCheck} questions (found ${l.check.length})`,
        );
      } else if (l.check.length > LIMITS.maxCheck) {
        out.warn(
          'authoring',
          file,
          [...lp, 'check'],
          `has ${l.check.length} questions; a Lesson Check is ${LIMITS.minCheck}–${LIMITS.maxCheck}`,
        );
      }
      if (!l.notebook.trim()) {
        out.err(
          'authoring',
          file,
          [...lp, 'notebook'],
          'needs a notebook task (offline work for her notebook, §6 step 5)',
        );
      }
      l.practice.forEach((q, pi) => {
        if (!q.hints?.length)
          out.err(
            'authoring',
            file,
            [...lp, 'practice', pi, 'hints'],
            `practice question "${q.id}" needs at least 1 hint`,
          );
      });
      checkLessonVideos(file, l, lp, chapterQuestionIds, sample);

      needSource(l.source, [...lp, 'source']);
      l.cards.forEach((c, ci) => needSource(c.source, [...lp, 'cards', ci, 'source']));
      l.warmup?.forEach((c, ci) => needSource(c.source, [...lp, 'warmup', ci, 'source']));
      l.practice.forEach((q, i) => needSource(q.source, [...lp, 'practice', i, 'source']));
      l.check.forEach((q, i) => needSource(q.source, [...lp, 'check', i, 'source']));
    });

    const lessonIds = new Set(ch.lessons.map((l) => l.id));
    ch.questionBank.forEach((q, i) => {
      const qp: PropertyKey[] = ['questionBank', i];
      if (!q.lessonId) {
        out.err(
          'integrity',
          file,
          [...qp, 'lessonId'],
          `question "${q.id}" needs "lessonId" (used for mastery and weak topics)`,
        );
      } else if (!lessonIds.has(q.lessonId)) {
        out.err(
          'integrity',
          file,
          [...qp, 'lessonId'],
          `lessonId "${q.lessonId}" doesn't match any lesson in this chapter`,
        );
      }
      needSource(q.source, [...qp, 'source']);
    });

    // questionBank size + difficulty mix
    const bank = ch.questionBank;
    const byDiff = Object.fromEntries(
      DIFFICULTIES.map((d) => [d, bank.filter((q) => q.difficulty === d).length]),
    ) as Record<(typeof DIFFICULTIES)[number], number>;
    const mixOk = DIFFICULTIES.every((d) => byDiff[d] > 0);
    if (bank.length < LIMITS.minQuestionBank || !mixOk) {
      const msg =
        `needs at least ${LIMITS.minQuestionBank} questions with a mix of easy, medium and challenge ` +
        `(found ${bank.length}: ${byDiff.easy} easy, ${byDiff.medium} medium, ${byDiff.challenge} challenge)`;
      if (sample) out.warn('authoring', file, ['questionBank'], `${msg} — OK for a SAMPLE chapter`);
      else out.err('authoring', file, ['questionBank'], msg);
    }
    ch.lessons.forEach((l, li) => {
      const n = bank.filter((q) => q.lessonId === l.id).length;
      if (n < LIMITS.minBankPerLesson) {
        out.warn(
          'authoring',
          file,
          ['lessons', li],
          `lesson "${l.id}" has ${n} questionBank questions; aim for at least ${LIMITS.minBankPerLesson} (Appendix F)`,
        );
      }
    });

    // per-question rules for every chapter question
    const all: { q: Question; path: PropertyKey[]; lesson?: Lesson }[] = [
      ...ch.lessons.flatMap((l, li) => [
        ...l.practice.map((q, i) => ({
          q,
          path: ['lessons', li, 'practice', i] as PropertyKey[],
          lesson: l,
        })),
        ...l.check.map((q, i) => ({ q, path: ['lessons', li, 'check', i] as PropertyKey[], lesson: l })),
      ]),
      ...bank.map((q, i) => ({
        q,
        path: ['questionBank', i] as PropertyKey[],
        lesson: ch.lessons.find((l) => l.id === q.lessonId),
      })),
    ];
    let needsReview = 0;
    for (const { q, path, lesson } of all) {
      if (q.fromBook && !q.bookRef?.trim()) {
        out.err(
          'authoring',
          file,
          [...path, 'bookRef'],
          `book question "${q.id}" needs "bookRef" (the book's numbering, e.g. "Ex. B Q4")`,
        );
      }
      if (q.needsReview) needsReview++;
      checkVariant(file, q, path);
      if (q.videoRef && lesson) checkVideoRef(file, q, path, lesson);
    }
    if (needsReview) {
      out.warn(
        'authoring',
        file,
        [],
        `${needsReview} question(s) are marked needsReview — the parent must check them before approving`,
      );
    }

    if (missingSource.length) {
      if (sample) {
        out.warn(
          'authoring',
          file,
          [],
          `SAMPLE chapter: ${missingSource.length} item(s) have no "source"/"book" — fine for samples, but real chapters need page numbers on every lesson, card and question (§13A)`,
        );
      } else {
        for (const p of missingSource) {
          if (p[0] === 'book') continue; // already reported
          out.err('authoring', file, p, 'needs a "source" with book page numbers or a notes file (§13A)');
        }
      }
    }
  }

  function checkLessonVideos(
    file: string,
    l: Lesson,
    lp: PropertyKey[],
    chapterQuestionIds: Set<string>,
    sampleChapter: boolean,
  ) {
    for (const role of ['primary', 'alternate'] as const) {
      const n = l.videos.filter((v) => v.role === role).length;
      if (n > 1) {
        out.err(
          'integrity',
          file,
          [...lp, 'videos'],
          `has ${n} "${role}" videos; a lesson has one primary and at most one alternate (§7.1)`,
        );
      }
    }
    if (!l.videos.some((v) => v.role === 'primary')) {
      out.warn(
        'authoring',
        file,
        [...lp, 'videos'],
        'has no "primary" video — the lesson will start with learn cards',
      );
    }
    const explainerQuestionIds = new Set<string>(
      l.videos.flatMap((v) =>
        v.kind === 'explainer' ? (explainerById.get(v.explainerId)?.questions.map((q) => q.id) ?? []) : [],
      ),
    );
    let primarySeconds = 0;
    l.videos.forEach((v, vi) => {
      const vp: PropertyKey[] = [...lp, 'videos', vi];
      const secs = videoSeconds(v);
      if (v.role === 'primary' && secs) primarySeconds += secs;
      if (secs && secs > LIMITS.videoSegmentSeconds) {
        out.warn(
          'authoring',
          file,
          vp,
          `video is about ${fmtTime(secs)} long; keep each segment ≤ 8 min (§7.7)`,
        );
      }
      if (v.kind === 'explainer') {
        const ex = explainerById.get(v.explainerId);
        if (!ex && !brokenIds.has(v.explainerId)) {
          out.err(
            'integrity',
            file,
            [...vp, 'explainerId'],
            `explainerId "${v.explainerId}" doesn't match any explainer in explainers/`,
          );
        } else if (ex?.sample === true && !sampleChapter) {
          out.err(
            'authoring',
            file,
            [...vp, 'explainerId'],
            `real chapter uses SAMPLE explainer "${ex.id}"; import a sourced explainer (§13A)`,
          );
        }
        return;
      }
      if (v.kind === 'youtube') {
        if (v.youtubeId === REPLACE_ME) {
          out.warn(
            'authoring',
            file,
            [...vp, 'youtubeId'],
            'youtubeId is still "REPLACE_ME" — the explainer or learn cards will play instead until the parent adds a video',
          );
        } else if (v.end === undefined) {
          out.warn('authoring', file, [...vp, 'end'], 'set "end" so the clip stops on time (≤ 8 min, §7.7)');
        }
      }
      if (v.checkpoints.length === 0) {
        out.warn(
          'authoring',
          file,
          [...vp, 'checkpoints'],
          'has no checkpoints; each video should have 1–3 (§7.3)',
        );
      }
      v.checkpoints.forEach((c, ci) => {
        if (!chapterQuestionIds.has(c.questionId) && !explainerQuestionIds.has(c.questionId)) {
          out.err(
            'integrity',
            file,
            [...vp, 'checkpoints', ci, 'questionId'],
            `questionId "${c.questionId}" doesn't match any question in this chapter`,
          );
        }
      });
    });
    if (primarySeconds > LIMITS.videoPerLessonSeconds) {
      out.warn(
        'authoring',
        file,
        [...lp, 'videos'],
        `about ${fmtTime(primarySeconds)} of video in one lesson; keep it ≤ 15 min (§7.7)`,
      );
    }
  }

  function videoSeconds(v: Video): number | undefined {
    if (v.kind === 'explainer') {
      const ex = explainerById.get(v.explainerId);
      return ex ? estimateExplainerSeconds(ex) : undefined;
    }
    if (v.kind === 'youtube' && v.end !== undefined) return v.end - (v.start ?? 0);
    return undefined; // mp4 length is unknown until it plays
  }

  function checkVariant(file: string, q: Question, path: PropertyKey[]) {
    if (!q.variantOf) return;
    if (q.variantOf === q.id)
      out.err('integrity', file, [...path, 'variantOf'], 'a question cannot be a variant of itself');
    else if (!questions.has(q.variantOf)) {
      out.err(
        'integrity',
        file,
        [...path, 'variantOf'],
        `variantOf "${q.variantOf}" doesn't match any question`,
      );
    }
  }

  function checkVideoRef(file: string, q: Question, path: PropertyKey[], lesson: Lesson) {
    const ref = q.videoRef!;
    const rp = [...path, 'videoRef'];
    const video = lesson.videos.find((v) => v.role === ref.video);
    if (!video) {
      out.err(
        'integrity',
        file,
        [...rp, 'video'],
        `points to the "${ref.video}" video of lesson "${lesson.id}", but that lesson has none`,
      );
      return;
    }
    if (ref.scene !== undefined) {
      if (video.kind !== 'explainer') {
        out.err(
          'integrity',
          file,
          [...rp, 'scene'],
          `"scene" only works with an explainer video, but the ${ref.video} video is ${video.kind}`,
        );
      } else {
        const ex = explainerById.get(video.explainerId);
        if (ex && ref.scene >= ex.scenes.length) {
          out.err(
            'integrity',
            file,
            [...rp, 'scene'],
            `scene ${ref.scene} doesn't exist — explainer "${ex.id}" has scenes 0–${ex.scenes.length - 1}`,
          );
        }
      }
    }
    if (ref.at !== undefined && video.kind === 'youtube') {
      const start = video.start ?? 0;
      if (ref.at < start || (video.end !== undefined && ref.at > video.end)) {
        out.err(
          'integrity',
          file,
          [...rp, 'at'],
          `at ${ref.at}s is outside the clip (${start}–${video.end ?? '…'}s)`,
        );
      }
    }
  }

  /* --- explainers --- */
  for (const { file, ex } of explainers) {
    const sample = ex.sample === true;
    checkSubject(ex.subject, file, ['subject']);
    const own = new Set(ex.questions.map((q) => q.id));
    let checkpoints = 0;
    let missing = 0;
    ex.scenes.forEach((s, si) => {
      if (s.checkpoint) {
        checkpoints++;
        if (!own.has(s.checkpoint.questionId) && !questions.has(s.checkpoint.questionId)) {
          out.err(
            'integrity',
            file,
            ['scenes', si, 'checkpoint', 'questionId'],
            `questionId "${s.checkpoint.questionId}" doesn't match any question (add it to this explainer's "questions")`,
          );
        }
      }
      if (!s.source && !ex.source) {
        if (sample) missing++;
        else
          out.err(
            'authoring',
            file,
            ['scenes', si, 'source'],
            'needs a "source" with book page numbers or a notes file (§13A)',
          );
      }
    });
    ex.questions.forEach((q, qi) => {
      if (q.videoRef)
        out.warn(
          'authoring',
          file,
          ['questions', qi, 'videoRef'],
          'videoRef is ignored on explainer questions',
        );
      checkVariant(file, q, ['questions', qi]);
      if (!q.source && !ex.source) {
        if (sample) missing++;
        else
          out.err(
            'authoring',
            file,
            ['questions', qi, 'source'],
            'needs a "source" with book page numbers or a notes file (§13A)',
          );
      }
    });
    if (checkpoints === 0)
      out.warn(
        'authoring',
        file,
        ['scenes'],
        'has no checkpoint questions; each video should have 1–3 (§7.3)',
      );
    if (checkpoints > LIMITS.maxCheckpoints) {
      out.warn(
        'authoring',
        file,
        ['scenes'],
        `has ${checkpoints} checkpoints; keep it to ${LIMITS.maxCheckpoints} or fewer (§7.3)`,
      );
    }
    const secs = estimateExplainerSeconds(ex);
    if (secs > LIMITS.videoSegmentSeconds) {
      out.warn(
        'authoring',
        file,
        [],
        `explainer runs about ${fmtTime(secs)}; keep each segment ≤ 8 min (§7.7)`,
      );
    }
    if (sample && missing) {
      out.warn(
        'authoring',
        file,
        [],
        `SAMPLE explainer: ${missing} scene(s)/question(s) have no "source" — fine for samples, required for real ones (§13A)`,
      );
    }
  }

  /* --- timetable --- */
  if (timetable) checkTimetable(raw.timetable!.file);

  function checkTimetable(file: string) {
    const tt = timetable!;
    const tests: { day: string; idx: number; slot: Slot }[] = [];
    const sessions = new Map<string, number>();

    for (const day of WEEKDAYS) {
      const slots = tt.days[day];
      slots.forEach((s, i) => {
        const sp: PropertyKey[] = ['days', day, i];
        if (s.subject) checkSubject(s.subject, file, [...sp, 'subject']);
        s.subjects?.forEach((id, j) => checkSubject(id, file, [...sp, 'subjects', j]));
        if (
          s.colour &&
          !(SLOT_COLOUR_TOKENS as readonly string[]).includes(s.colour) &&
          !subjectById.has(s.colour)
        ) {
          out.warn(
            'authoring',
            file,
            [...sp, 'colour'],
            `"${s.colour}" is not a known colour token (${SLOT_COLOUR_TOKENS.join(', ')} or a subject id)`,
          );
        }
        if (s.kind === 'test') tests.push({ day, idx: i, slot: s });
        if (s.subject && STUDY_KINDS.includes(s.kind))
          sessions.set(s.subject, (sessions.get(s.subject) ?? 0) + 1);
        if (i > 0 && toMinutes(s.start) < toMinutes(slots[i - 1]!.start)) {
          out.warn('authoring', file, [...sp, 'start'], 'slots should be listed in time order');
        }
      });

      const sorted = slots
        .map((slot, idx) => ({ slot, idx }))
        .sort((a, b) => toMinutes(a.slot.start) - toMinutes(b.slot.start));
      let prev: { slot: Slot; idx: number } | undefined;
      for (const cur of sorted) {
        if (prev && toMinutes(cur.slot.start) < toMinutes(prev.slot.end)) {
          out.err(
            'integrity',
            file,
            ['days', day, cur.idx],
            `slot ${cur.slot.start}–${cur.slot.end} overlaps slot ${prev.slot.start}–${prev.slot.end} (days.${day}[${prev.idx}])`,
          );
        }
        if (!prev || toMinutes(cur.slot.end) > toMinutes(prev.slot.end)) prev = cur;
      }
    }

    const testIds = tests.map((t) => t.slot.testId).sort();
    if (tests.length !== 2 || testIds[0] !== 'sat' || testIds[1] !== 'sun') {
      const found = tests.length
        ? tests.map((t) => `days.${t.day}[${t.idx}] testId "${t.slot.testId ?? '?'}"`).join(', ')
        : 'none';
      out.err(
        'integrity',
        file,
        ['days'],
        `needs exactly 2 test slots, one with testId "sat" and one with testId "sun" (found: ${found})`,
      );
    }
    if (blueprint) {
      for (const t of tests) {
        const w = t.slot.testId ? blueprint.windows[t.slot.testId] : undefined;
        if (w && w.opens !== `${t.day} ${t.slot.start}`) {
          out.warn(
            'authoring',
            file,
            ['days', t.day, t.idx],
            `test starts at "${t.day} ${t.slot.start}" but test-blueprint.json windows.${t.slot.testId}.opens is "${w.opens}"`,
          );
        }
      }
    }

    // Appendix A note: weekly session counts must match subjects[].sessionsPerWeek
    subjects?.forEach((s, i) => {
      if (s.sessionsPerWeek === undefined) {
        out.warn(
          'authoring',
          raw.subjects!.file,
          [i, 'sessionsPerWeek'],
          `weekly session count not checked for "${s.id}" (add "sessionsPerWeek" to check the timetable against it)`,
        );
        return;
      }
      const n = sessions.get(s.id) ?? 0;
      if (n !== s.sessionsPerWeek) {
        out.err(
          'authoring',
          file,
          ['days'],
          `${s.name} ("${s.id}") has ${n} single-subject study slot(s) a week, but subjects.json sessionsPerWeek is ${s.sessionsPerWeek}`,
        );
      }
    });
  }

  /* --- plan --- */
  if (plan) {
    const file = raw.plan!.file;
    const placeholders: string[] = [];
    if (plan.exams.mode === 'single' && plan.exams.date) {
      if (plan.exams.date === REPLACE_ME) placeholders.push('all subjects');
      else if (plan.exams.date < plan.startDate)
        out.err(
          'authoring',
          file,
          ['exams', 'date'],
          `exam date ${plan.exams.date} is before startDate ${plan.startDate}`,
        );
    }
    if (plan.exams.mode === 'per_subject' && plan.exams.dates) {
      for (const [sid, date] of Object.entries(plan.exams.dates)) {
        checkSubject(sid, file, ['exams', 'dates', sid]);
        if (date === REPLACE_ME) placeholders.push(sid);
        else if (date < plan.startDate)
          out.err(
            'authoring',
            file,
            ['exams', 'dates', sid],
            `exam date ${date} is before startDate ${plan.startDate}`,
          );
      }
      for (const s of subjects ?? []) {
        if (!(s.id in plan.exams.dates))
          out.warn('authoring', file, ['exams', 'dates'], `no exam date for "${s.id}"`);
      }
    }
    if (placeholders.length) {
      out.warn(
        'authoring',
        file,
        ['exams'],
        `exam dates are still "REPLACE_ME" for: ${placeholders.join(', ')} — the parent fills these in (§9.1, §18)`,
      );
    }

    const listed = new Set<string>();
    for (const [sid, list] of Object.entries(plan.chapterOrder)) {
      checkSubject(sid, file, ['chapterOrder', sid]);
      list.forEach((cid, i) => {
        const p: PropertyKey[] = ['chapterOrder', sid, i];
        if (listed.has(cid)) out.err('integrity', file, p, `chapter "${cid}" is listed more than once`);
        listed.add(cid);
        const ch = chapterById.get(cid);
        if (!ch) {
          if (!brokenIds.has(cid))
            out.err('integrity', file, p, `chapter "${cid}" doesn't match any chapter file`);
        } else if (ch.subject !== sid)
          out.err('integrity', file, p, `chapter "${cid}" belongs to "${ch.subject}", not "${sid}"`);
      });
    }
    plan.taughtAlready.forEach((cid, i) => {
      if (!chapterById.has(cid) && !brokenIds.has(cid))
        out.err('integrity', file, ['taughtAlready', i], `chapter "${cid}" doesn't match any chapter file`);
    });
    for (const key of Object.keys(plan.examPattern)) {
      if (key !== 'default') checkSubject(key, file, ['examPattern', key]);
    }
    for (const { file: cf, ch } of chapters) {
      if (!listed.has(ch.id))
        out.warn(
          'authoring',
          cf,
          ['id'],
          `chapter "${ch.id}" isn't in plan.json chapterOrder.${ch.subject}, so it won't be scheduled`,
        );
    }
  }

  /* --- test blueprint --- */
  if (blueprint) {
    const file = raw.blueprint!.file;
    const total = blueprint.structure.reduce((sum, r) => sum + r.count * r.marksEach, 0);
    if (total !== blueprint.sectionMarks) {
      out.err(
        'authoring',
        file,
        ['structure'],
        `adds up to ${total} marks but sectionMarks is ${blueprint.sectionMarks}`,
      );
    }
    const near1 = (n: number) => Math.abs(n - 1) < 1e-6;
    const sm = blueprint.sourceMix;
    if (!near1(sm.sinceLastTest + sm.weakTopics + sm.spacedReview))
      out.err('authoring', file, ['sourceMix'], 'shares must add up to 1');
    const dm = blueprint.difficultyMix;
    if (!near1(dm.easy + dm.medium + dm.challenge))
      out.err('authoring', file, ['difficultyMix'], 'shares must add up to 1');
    const mins = blueprint.bands.map((b) => b.min);
    if (!mins.includes(0))
      out.err('authoring', file, ['bands'], 'needs a band with "min": 0 so every score gets a band');
    if (mins.some((m, i) => i > 0 && m >= mins[i - 1]!))
      out.err('authoring', file, ['bands'], 'bands must be listed from the highest "min" to the lowest');
  }

  return out.list;
}

export function validateContent(raw: RawContent): ValidationResult {
  const issues = collectIssues(raw);
  return {
    errors: issues.filter((i) => i.level === 'error').map(formatIssue),
    warnings: issues.filter((i) => i.level === 'warning').map(formatIssue),
  };
}
