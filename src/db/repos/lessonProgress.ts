import { db, type LessonProgressRecord, type LessonStatus } from '../db';

export type { LessonProgressRecord, LessonStatus };

export async function getLessonProgress(lessonId: string): Promise<LessonProgressRecord | undefined> {
  return db.lessonProgress.get(lessonId);
}

export async function listLessonProgress(): Promise<LessonProgressRecord[]> {
  return db.lessonProgress.toArray();
}

/**
 * Creates or updates a lesson's progress. `startedAt` is kept from the first save;
 * `updatedAt` is set to `at`.
 */
export async function saveLessonProgress(
  lessonId: string,
  patch: Partial<Omit<LessonProgressRecord, 'lessonId' | 'startedAt' | 'updatedAt'>>,
  at: number = Date.now(),
): Promise<LessonProgressRecord> {
  return db.transaction('rw', db.lessonProgress, async () => {
    const prev = await db.lessonProgress.get(lessonId);
    const rec: LessonProgressRecord = {
      status: 'in_progress',
      step: 0,
      ...prev,
      ...patch,
      lessonId,
      startedAt: prev?.startedAt ?? at,
      updatedAt: at,
    };
    await db.lessonProgress.put(rec);
    return rec;
  });
}
