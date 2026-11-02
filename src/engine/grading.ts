/**
 * Grading of every question type — SPEC §8.2.
 *
 * Pure: a validated `Question` plus the kid's `Response` in, a `GradeResult` out.
 *  - mcq / true_false / numeric: right or not (score 1 or 0).
 *  - fill_blank: ignores case and extra spaces, accepts `answer` or any `accept[]`; numbers allow
 *    `tolerance` and an optional unit.
 *  - match / order / label_diagram: partial marks (fraction of pairs / positions / labels right).
 *  - short_answer / think_write: self-check — she rates herself Got it / Partly / Missed (1 / 0.5 / 0).
 */
import type { Question } from '@/content';

export type Response =
  | { type: 'mcq'; choice: string } // the option text chosen
  /** `null` = not chosen yet (so `emptyResponse` can never grade as an answer) */
  | { type: 'true_false'; value: boolean | null }
  | { type: 'fill_blank'; text: string }
  | { type: 'numeric'; value: number | null; unit?: string }
  | { type: 'match'; pairs: Record<string, string> } // left item → chosen right item
  | { type: 'order'; sequence: string[] }
  | { type: 'label_diagram'; placed: Record<string, string> } // hotspot id → label placed there
  | { type: 'self_check'; text: string; rating?: 'got' | 'partly' | 'missed' }; // short_answer, think_write

export type ResponseType = Response['type'];
export type SelfCheckRating = NonNullable<Extract<Response, { type: 'self_check' }>['rating']>;

export interface PartResult {
  key: string;
  correct: boolean;
}

export interface GradeResult {
  /** 0..1 (partial marks for match/order/label_diagram; self-check 1/0.5/0) */
  score: number;
  /** score === 1 */
  correct: boolean;
  /** per pair / item / label */
  parts?: PartResult[];
  /** human text for the correction report */
  yourAnswer: string;
  /** human text for the correction report */
  correctAnswer: string;
}

/** §8.2: "Got it ✅ / Partly 🤏 / Missed ❌" = 100 / 50 / 0 %. */
export const SELF_CHECK_SCORE = { got: 1, partly: 0.5, missed: 0 } as const satisfies Record<
  SelfCheckRating,
  number
>;

/** Shown in the correction report when nothing was given. */
export const NO_ANSWER = '(no answer)';

/** Floating-point slack for numeric comparisons (0.1 + 0.2 vs 0.3). */
const EPS = 1e-9;

/** Which `Response` shape a question type takes. */
export function responseTypeFor(q: Question): ResponseType {
  switch (q.type) {
    case 'short_answer':
    case 'think_write':
      return 'self_check';
    default:
      return q.type;
  }
}

/** A blank response of the right shape (structured types start empty; the UI seeds any arrangement). */
export function emptyResponse(q: Question): Response {
  const type = responseTypeFor(q);
  switch (type) {
    case 'mcq':
      return { type, choice: '' };
    case 'true_false':
      return { type, value: null };
    case 'fill_blank':
      return { type, text: '' };
    case 'numeric':
      return { type, value: null };
    case 'match':
      return { type, pairs: {} };
    case 'order':
      return { type, sequence: [] };
    case 'label_diagram':
      return { type, placed: {} };
    case 'self_check':
      return { type, text: '' };
  }
}

/** Narrow a response to the shape this question expects (a mismatched shape counts as no answer). */
function as<T extends ResponseType>(
  q: Question,
  r: Response | undefined,
  type: T,
): Extract<Response, { type: T }> | undefined {
  if (!r || r.type !== type || responseTypeFor(q) !== type) return undefined;
  return r as Extract<Response, { type: T }>;
}

const filled = (s: string | undefined): s is string => typeof s === 'string' && s.trim() !== '';

/** Is the "Check my answer" button ready? Every pair/label filled; a rating chosen for self-check. */
export function isAnswered(q: Question, r: Response | undefined): boolean {
  if (!r || r.type !== responseTypeFor(q)) return false;
  switch (r.type) {
    case 'mcq':
      return filled(r.choice);
    case 'true_false':
      return typeof r.value === 'boolean';
    case 'fill_blank':
      return filled(r.text);
    case 'numeric':
      return typeof r.value === 'number' && Number.isFinite(r.value);
    case 'match':
      return (q.pairs ?? []).every(([left]) => filled(r.pairs[left]));
    case 'order':
      return isPermutation(r.sequence, q.sequence ?? []);
    case 'label_diagram':
      return (q.hotspots ?? []).every((h) => filled(r.placed[h.id]));
    case 'self_check':
      return r.rating !== undefined;
  }
}

function isPermutation(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

/** Lower-case, trim, collapse inner spaces, drop one trailing full stop. */
export function normalizeText(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/\.$/, '').trim().toLowerCase();
}

function normalizeUnit(u: string | undefined): string {
  return (u ?? '').replace(/\s+/g, '').replace(/\.$/, '').toLowerCase();
}

const NUMBER_RE = /^([+-]?(?:\d[\d,]*(?:\.\d*)?|\.\d+))\s*(.*)$/;

/** "12.5 cm" → { value: 12.5, unit: 'cm' }; "1,000" → 1000. Undefined when it isn't a number. */
export function parseNumberWithUnit(text: string): { value: number; unit: string } | undefined {
  const m = NUMBER_RE.exec(text.trim());
  if (!m) return undefined;
  const value = Number(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(value)) return undefined;
  return { value, unit: m[2]!.trim() };
}

/** Within tolerance, and the unit (when both the question and the answer give one) agrees. */
function numberMatches(q: Question, expected: number, value: number, unit: string | undefined): boolean {
  if (Math.abs(value - expected) > (q.tolerance ?? 0) + EPS) return false;
  const given = normalizeUnit(unit);
  if (q.unit && given && given !== normalizeUnit(q.unit)) return false;
  return true;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const p = parseNumberWithUnit(v);
    if (p && p.unit === '') return p.value;
  }
  return undefined;
}

function fillBlankCorrect(q: Question, text: string): boolean {
  const candidates: unknown[] = [q.answer, ...(q.accept ?? [])];
  const typed = normalizeText(text);
  if (typed === '') return false;
  const num = parseNumberWithUnit(text);
  return candidates.some((c) => {
    if (typeof c === 'string' && normalizeText(c) === typed) return true;
    const expected = asNumber(c);
    return expected !== undefined && num !== undefined && numberMatches(q, expected, num.value, num.unit);
  });
}

function formatAnswer(a: Question['answer']): string {
  if (a === undefined) return '';
  if (Array.isArray(a)) return a.join(', ');
  return String(a);
}

function withUnit(value: string, unit: string | undefined): string {
  return unit ? `${value} ${unit}` : value;
}

/** The right answer as text for the correction report. */
export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case 'true_false':
      return q.answer === true ? 'True' : 'False';
    case 'fill_blank':
    case 'numeric':
      return withUnit(formatAnswer(q.answer), q.unit);
    case 'match':
      return (q.pairs ?? []).map(([l, r]) => `${l} → ${r}`).join(' · ');
    case 'order':
      return (q.sequence ?? []).join(' → ');
    case 'label_diagram':
      return (q.hotspots ?? []).map((h) => h.label).join(', ');
    case 'short_answer':
    case 'think_write':
      return q.modelAnswer ?? '';
    case 'mcq':
      return formatAnswer(q.answer);
  }
}

const orNone = (s: string): string => (s.trim() === '' ? NO_ANSWER : s);

function yourAnswerText(q: Question, r: Response | undefined): string {
  if (!r || r.type !== responseTypeFor(q)) return NO_ANSWER;
  switch (r.type) {
    case 'mcq':
      return orNone(r.choice);
    case 'true_false':
      return r.value === null ? NO_ANSWER : r.value ? 'True' : 'False';
    case 'fill_blank':
      return orNone(r.text.trim().replace(/\s+/g, ' '));
    case 'numeric':
      return r.value === null ? NO_ANSWER : withUnit(String(r.value), r.unit?.trim() || undefined);
    case 'match': {
      const pairs = q.pairs ?? [];
      if (!pairs.some(([l]) => filled(r.pairs[l]))) return NO_ANSWER;
      return pairs
        .map(([l]) => {
          const chosen = r.pairs[l];
          return `${l} → ${filled(chosen) ? chosen : '?'}`;
        })
        .join(' · ');
    }
    case 'order':
      return r.sequence.length === 0 ? NO_ANSWER : r.sequence.join(' → ');
    case 'label_diagram': {
      const spots = q.hotspots ?? [];
      if (!spots.some((h) => filled(r.placed[h.id]))) return NO_ANSWER;
      return spots
        .map((h) => {
          const placed = r.placed[h.id];
          return filled(placed) ? placed : '?';
        })
        .join(', ');
    }
    case 'self_check':
      return orNone(r.text.trim());
  }
}

function fraction(parts: PartResult[]): number {
  return parts.length === 0 ? 0 : parts.filter((p) => p.correct).length / parts.length;
}

function scoreAndParts(q: Question, r: Response): { score: number; parts?: PartResult[] } {
  const all = (ok: boolean) => ({ score: ok ? 1 : 0 });
  switch (q.type) {
    case 'mcq': {
      const m = as(q, r, 'mcq');
      return all(!!m && filled(m.choice) && m.choice.trim() === formatAnswer(q.answer).trim());
    }
    case 'true_false': {
      const t = as(q, r, 'true_false');
      return all(!!t && typeof t.value === 'boolean' && t.value === q.answer);
    }
    case 'fill_blank': {
      const f = as(q, r, 'fill_blank');
      return all(!!f && fillBlankCorrect(q, f.text));
    }
    case 'numeric': {
      const n = as(q, r, 'numeric');
      const expected = asNumber(q.answer);
      return all(
        !!n &&
          typeof n.value === 'number' &&
          Number.isFinite(n.value) &&
          expected !== undefined &&
          numberMatches(q, expected, n.value, n.unit),
      );
    }
    case 'match': {
      const m = as(q, r, 'match');
      const parts = (q.pairs ?? []).map(([left, right]) => {
        const chosen = m?.pairs[left];
        return { key: left, correct: filled(chosen) && normalizeText(chosen) === normalizeText(right) };
      });
      return { score: fraction(parts), parts };
    }
    case 'order': {
      const o = as(q, r, 'order');
      const parts = (q.sequence ?? []).map((item, i) => ({
        key: item,
        correct: !!o && o.sequence[i] === item,
      }));
      return { score: fraction(parts), parts };
    }
    case 'label_diagram': {
      const l = as(q, r, 'label_diagram');
      const parts = (q.hotspots ?? []).map((h) => {
        const placed = l?.placed[h.id];
        return { key: h.id, correct: filled(placed) && normalizeText(placed) === normalizeText(h.label) };
      });
      return { score: fraction(parts), parts };
    }
    case 'short_answer':
    case 'think_write': {
      const s = as(q, r, 'self_check');
      return { score: s?.rating ? SELF_CHECK_SCORE[s.rating] : 0 };
    }
  }
}

/** Mark one answer. A response of the wrong shape (or blank) scores 0 and reads "(no answer)". */
export function grade(q: Question, r: Response): GradeResult {
  const { score, parts } = scoreAndParts(q, r);
  return {
    score,
    correct: score === 1,
    ...(parts ? { parts } : {}),
    yourAnswer: yourAnswerText(q, r),
    correctAnswer: correctAnswerText(q),
  };
}

/** Marks earned: q.marks × score, rounded to the nearest 0.5. */
export function marksFor(q: Question, g: GradeResult): number {
  return Math.round(q.marks * g.score * 2 + EPS) / 2;
}
