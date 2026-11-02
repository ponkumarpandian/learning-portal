import { db, type TestRecord, type TestSectionState, type TestStatus } from '../db';

export type { TestRecord, TestSectionState, TestStatus };

export async function getTest(testId: string): Promise<TestRecord | undefined> {
  return db.tests.get(testId);
}

export async function listTests(): Promise<TestRecord[]> {
  return db.tests.toArray();
}

/** Inserts or replaces a test record; `updatedAt` defaults to now. */
export async function saveTest(
  t: Omit<TestRecord, 'updatedAt'> & { updatedAt?: number },
): Promise<TestRecord> {
  const rec: TestRecord = { ...t, updatedAt: t.updatedAt ?? Date.now() };
  await db.tests.put(rec);
  return rec;
}
