import { db, type AttemptRecord, type AttemptSource } from '../db';

export type { AttemptRecord, AttemptSource };

export type NewAttempt = Omit<AttemptRecord, 'id' | 'at'> & { at?: number };

/** Appends an attempt and returns it with its new id. Throws if score is outside 0..1. */
export async function addAttempt(a: NewAttempt): Promise<AttemptRecord> {
  if (!(a.score >= 0 && a.score <= 1)) throw new RangeError(`score must be 0..1, got ${a.score}`);
  const rec = { ...a, at: a.at ?? Date.now() };
  const id = await db.attempts.add(rec);
  return { ...rec, id };
}

export interface AttemptFilter {
  lessonId?: string;
  testId?: string;
  source?: AttemptSource;
  /** epoch ms, inclusive */
  since?: number;
}

/** Attempts matching every given filter, oldest first. */
export async function listAttempts(f: AttemptFilter = {}): Promise<AttemptRecord[]> {
  const base =
    f.lessonId !== undefined
      ? db.attempts.where('lessonId').equals(f.lessonId)
      : f.testId !== undefined
        ? db.attempts.where('testId').equals(f.testId)
        : db.attempts.toCollection();
  const rows = await base
    .filter(
      (r) =>
        (f.testId === undefined || r.testId === f.testId) &&
        (f.source === undefined || r.source === f.source) &&
        (f.since === undefined || r.at >= f.since),
    )
    .toArray();
  return rows.sort((a, b) => a.at - b.at || a.id - b.id);
}
