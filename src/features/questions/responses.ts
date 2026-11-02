import type { Question } from '@/content';
import { emptyResponse, type GradeResult, type Response } from '@/engine/grading';
import { seededShuffle, shuffledAway } from './shuffle';

/** The mcq options in their stable, per-question shuffled order. */
export const mcqOptions = (q: Question): string[] => seededShuffle(q.options ?? [], `${q.id}:options`);

/** The right-hand items of a match question, shuffled per question. */
export const matchChoices = (q: Question): string[] =>
  seededShuffle(
    (q.pairs ?? []).map(([, r]) => r),
    `${q.id}:match`,
  );

/** The hotspot labels of a label_diagram question, shuffled per question. */
export const labelChoices = (q: Question): string[] =>
  seededShuffle(
    (q.hotspots ?? []).map((h) => h.label),
    `${q.id}:labels`,
  );

/** The starting order of an order question: shuffled, and never already solved. */
export const orderStart = (q: Question): string[] => shuffledAway(q.sequence ?? [], `${q.id}:order`);

/** True when `seq` holds exactly the items of the question's sequence (any order). */
export function isPermutation(q: Question, seq: readonly string[] | undefined): seq is string[] {
  const want = q.sequence ?? [];
  if (!seq || seq.length !== want.length) return false;
  const a = [...seq].sort();
  const b = [...want].sort();
  return a.every((x, i) => x === b[i]);
}

/**
 * The response a fresh question starts with. Same as the engine's emptyResponse(), except an order
 * question starts in its shuffled order (the list on screen IS her answer, even before she moves one).
 */
export function startResponse(q: Question): Response {
  if (q.type === 'order') return { type: 'order', sequence: orderStart(q) };
  return emptyResponse(q);
}

/** The correct right item for each left item of a match question. */
export const matchKey = (q: Question): Record<string, string> =>
  Object.fromEntries((q.pairs ?? []).map(([l, r]) => [l, r]));

/** The correct label for each hotspot id of a label_diagram question. */
export const labelKey = (q: Question): Record<string, string> =>
  Object.fromEntries((q.hotspots ?? []).map((h) => [h.id, h.label]));

/**
 * Was one part right? Uses the engine's per-part result when it has that key, otherwise compares
 * with the content directly (match/label/order values are exact strings from the question).
 */
export function partCorrect(result: GradeResult | undefined, key: string, fallback: boolean): boolean {
  const p = result?.parts?.find((x) => x.key === key);
  return p ? p.correct : fallback;
}

/**
 * What "Try again" keeps: typed text stays (she edits it), placed pairs/labels that were right stay,
 * the not-quite ones go back to the word bank, a chosen option is cleared.
 */
export function retryResponse(q: Question, r: Response): Response {
  switch (r.type) {
    case 'mcq':
    case 'true_false':
      return emptyResponse(q);
    case 'match': {
      const key = matchKey(q);
      return {
        type: 'match',
        pairs: Object.fromEntries(Object.entries(r.pairs).filter(([l, v]) => key[l] === v)),
      };
    }
    case 'label_diagram': {
      const key = labelKey(q);
      return {
        type: 'label_diagram',
        placed: Object.fromEntries(Object.entries(r.placed).filter(([id, v]) => key[id] === v)),
      };
    }
    case 'self_check':
      return { type: 'self_check', text: r.text };
    default:
      return r;
  }
}
