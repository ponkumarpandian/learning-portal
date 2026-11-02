import { db, type MasteryHistoryEntry, type MasteryRecord } from '../db';

export type { MasteryHistoryEntry, MasteryRecord };

export async function getMastery(lessonId: string): Promise<MasteryRecord | undefined> {
  return db.mastery.get(lessonId);
}

export async function listMastery(): Promise<MasteryRecord[]> {
  return db.mastery.toArray();
}

/** Stores a mastery value computed by `engine/mastery` (Phase 3). */
export async function putMastery(
  m: Omit<MasteryRecord, 'updatedAt'> & { updatedAt?: number },
): Promise<MasteryRecord> {
  const rec: MasteryRecord = { ...m, updatedAt: m.updatedAt ?? Date.now() };
  await db.mastery.put(rec);
  return rec;
}
