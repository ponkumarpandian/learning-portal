/**
 * Content loader — SPEC §13.
 *
 * Content JSON under /content is bundled at build time (import.meta.glob, eager) and merged with the
 * parent's overrides from IndexedDB (the caller reads them via src/db/repos/contentOverrides.ts and
 * passes them in, so this stays synchronous).
 *
 * Override rules:
 *  - chapter / explainer: replace by id (targetId ?? data.id); unknown ids are added.
 *  - timetable / plan / subjects: replace the whole object.
 *  - each override is validated with Zod, then the merged content is checked for "integrity" problems
 *    (dangling ids, unknown subjects, overlapping slots…). An override that fails either check is
 *    skipped and a parent-facing message is pushed into `warnings`. Overrides never throw.
 */
import type { z } from 'zod';
import { collectIssues, formatIssue } from './validate';
import { rawFromFiles, type RawContent, type RawFile } from './raw';
import {
  ChapterSchema,
  ExplainerSchema,
  PlanSchema,
  SubjectsSchema,
  TestBlueprintSchema,
  TimetableSchema,
  type Chapter,
  type ContentOverride,
  type Explainer,
  type Plan,
  type Subject,
  type TestBlueprint,
  type Timetable,
} from './schemas';

export * from './schemas';

export interface ContentBundle {
  subjects: Subject[];
  timetable: Timetable;
  plan: Plan;
  blueprint: TestBlueprint;
  /** all chapters, drafts included — use approvedChapters() for anything the kid sees */
  chapters: Chapter[];
  explainers: Explainer[];
  /** parent-facing notes about skipped files/overrides (never shown to the kid) */
  warnings: string[];
}

const contentFiles = import.meta.glob<unknown>(['/content/**/*.json', '!/content/media/**'], {
  eager: true,
  import: 'default',
});

/** The bundled /content files in validator form (also used by tests). */
export function bundledRawContent(): RawContent {
  return rawFromFiles(contentFiles, '/content');
}

interface Labelled<T> {
  file: string;
  value: T;
}

interface Base {
  subjects: Labelled<Subject[]>;
  timetable: Labelled<Timetable>;
  plan: Labelled<Plan>;
  blueprint: Labelled<TestBlueprint>;
  chapters: Labelled<Chapter>[];
  explainers: Labelled<Explainer>[];
  warnings: string[];
}

let baseCache: Base | undefined;

function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const iss = error.issues[0];
  if (!iss) return 'invalid';
  const path = iss.path
    .map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`))
    .join('')
    .replace(/^\./, '');
  return path ? `${path}: ${iss.message}` : iss.message;
}

function loadBase(): Base {
  if (baseCache) return baseCache;
  const raw = bundledRawContent();
  const warnings: string[] = [];

  // The four core files are build-time content: if they are broken the app cannot run, and
  // `npm run validate-content` / the test suite catch it before it ships.
  const core = <T>(schema: z.ZodType<T>, rf: RawFile | undefined, name: string): Labelled<T> => {
    if (!rf) throw new Error(`Content file content/${name} is missing`);
    const r = schema.safeParse(rf.data);
    if (!r.success)
      throw new Error(
        `Content file ${rf.file} is invalid — ${firstIssue(r.error)} (run npm run validate-content)`,
      );
    return { file: rf.file, value: r.data };
  };

  const chapters: Labelled<Chapter>[] = [];
  for (const rf of raw.chapters) {
    const r = ChapterSchema.safeParse(rf.data);
    if (r.success) chapters.push({ file: rf.file, value: r.data });
    else warnings.push(`Chapter file ${rf.file} was skipped — ${firstIssue(r.error)}`);
  }
  const explainers: Labelled<Explainer>[] = [];
  for (const rf of raw.explainers) {
    const r = ExplainerSchema.safeParse(rf.data);
    if (r.success) explainers.push({ file: rf.file, value: r.data });
    else warnings.push(`Explainer file ${rf.file} was skipped — ${firstIssue(r.error)}`);
  }

  baseCache = {
    subjects: core(SubjectsSchema, raw.subjects, 'subjects.json'),
    timetable: core(TimetableSchema, raw.timetable, 'timetable.json'),
    plan: core(PlanSchema, raw.plan, 'plan.json'),
    blueprint: core(TestBlueprintSchema, raw.blueprint, 'test-blueprint.json'),
    chapters,
    explainers,
    warnings,
  };
  return baseCache;
}

type State = Omit<Base, 'warnings'>;

function toRaw(s: State): RawContent {
  return {
    subjects: { file: s.subjects.file, data: s.subjects.value },
    timetable: { file: s.timetable.file, data: s.timetable.value },
    plan: { file: s.plan.file, data: s.plan.value },
    blueprint: { file: s.blueprint.file, data: s.blueprint.value },
    chapters: s.chapters.map((c) => ({ file: c.file, data: c.value })),
    explainers: s.explainers.map((e) => ({ file: e.file, data: e.value })),
  };
}

function integrityErrors(s: State): Set<string> {
  return new Set(
    collectIssues(toRaw(s))
      .filter((i) => i.level === 'error' && i.kind !== 'authoring')
      .map(formatIssue),
  );
}

function replaceById<T extends { id: string }>(
  list: Labelled<T>[],
  id: string,
  value: T,
  overrideId: string,
): Labelled<T>[] {
  const idx = list.findIndex((x) => x.value.id === id);
  if (idx === -1) return [...list, { file: `override:${overrideId}`, value }];
  const next = [...list];
  next[idx] = { file: list[idx]!.file, value };
  return next;
}

function applyOverride(s: State, o: ContentOverride): { state: State } | { error: string } {
  const fail = (e: { issues: { path: PropertyKey[]; message: string }[] }) => ({ error: firstIssue(e) });
  switch (o.target) {
    case 'chapter': {
      const r = ChapterSchema.safeParse(o.data);
      if (!r.success) return fail(r.error);
      return { state: { ...s, chapters: replaceById(s.chapters, o.targetId ?? r.data.id, r.data, o.id) } };
    }
    case 'explainer': {
      const r = ExplainerSchema.safeParse(o.data);
      if (!r.success) return fail(r.error);
      return {
        state: { ...s, explainers: replaceById(s.explainers, o.targetId ?? r.data.id, r.data, o.id) },
      };
    }
    case 'timetable': {
      const r = TimetableSchema.safeParse(o.data);
      if (!r.success) return fail(r.error);
      return { state: { ...s, timetable: { file: s.timetable.file, value: r.data } } };
    }
    case 'plan': {
      const r = PlanSchema.safeParse(o.data);
      if (!r.success) return fail(r.error);
      return { state: { ...s, plan: { file: s.plan.file, value: r.data } } };
    }
    case 'subjects': {
      const r = SubjectsSchema.safeParse(o.data);
      if (!r.success) return fail(r.error);
      return { state: { ...s, subjects: { file: s.subjects.file, value: r.data } } };
    }
    default:
      return { error: `unknown target "${String((o as { target: unknown }).target)}"` };
  }
}

/**
 * Bundled content merged with the parent's overrides. Synchronous; never throws because of overrides.
 * Overrides are applied oldest-first (by updatedAt) so the latest edit wins.
 */
export function loadContent(overrides: ContentOverride[] = []): ContentBundle {
  const base = loadBase();
  const warnings = [...base.warnings];
  let state: State = base;

  if (overrides.length) {
    let known = integrityErrors(state);
    const ordered = [...overrides].sort((a, b) => (a?.updatedAt ?? 0) - (b?.updatedAt ?? 0));
    for (const o of ordered) {
      const label = `Parent change "${String(o?.id ?? '?')}" (${String(o?.target ?? '?')})`;
      try {
        if (!o || typeof o !== 'object') {
          warnings.push(`${label} was ignored — it is not a valid change record`);
          continue;
        }
        const res = applyOverride(state, o);
        if ('error' in res) {
          warnings.push(`${label} was ignored — ${res.error}`);
          continue;
        }
        const after = integrityErrors(res.state);
        const added = [...after].filter((e) => !known.has(e));
        if (added.length) {
          warnings.push(
            `${label} was ignored — ${added[0]}${added.length > 1 ? ` (+${added.length - 1} more)` : ''}`,
          );
          continue;
        }
        state = res.state;
        known = after;
      } catch (e) {
        warnings.push(`${label} was ignored — ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return {
    subjects: state.subjects.value,
    timetable: state.timetable.value,
    plan: state.plan.value,
    blueprint: state.blueprint.value,
    chapters: state.chapters.map((c) => c.value),
    explainers: state.explainers.map((e) => e.value),
    warnings,
  };
}

/** Only parent-approved chapters reach the kid (§13A). */
export function approvedChapters(b: Pick<ContentBundle, 'chapters'>): Chapter[] {
  return b.chapters.filter((c) => c.status === 'approved');
}

export function getSubject(b: Pick<ContentBundle, 'subjects'>, id: string): Subject | undefined {
  return b.subjects.find((s) => s.id === id);
}

export function getChapter(b: Pick<ContentBundle, 'chapters'>, id: string): Chapter | undefined {
  return b.chapters.find((c) => c.id === id);
}

export function getExplainer(b: Pick<ContentBundle, 'explainers'>, id: string): Explainer | undefined {
  return b.explainers.find((e) => e.id === id);
}
