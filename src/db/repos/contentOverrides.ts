import type { ContentOverride } from '@/content/schemas';
import { db } from '../db';

export type { ContentOverride };

/** All overrides, oldest edit first (so later edits win when applied in order). */
export async function listOverrides(): Promise<ContentOverride[]> {
  const all = await db.contentOverrides.toArray();
  return all.sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function getOverride(id: string): Promise<ContentOverride | undefined> {
  return db.contentOverrides.get(id);
}

/**
 * Inserts or replaces an override. `updatedAt` defaults to now.
 * Data is stored as given; it is validated when content is loaded (invalid ones are ignored).
 */
export async function putOverride(
  o: Omit<ContentOverride, 'updatedAt'> & { updatedAt?: number },
): Promise<ContentOverride> {
  const rec = { ...o, updatedAt: o.updatedAt ?? Date.now() } as ContentOverride;
  await db.contentOverrides.put(rec);
  return rec;
}

export async function deleteOverride(id: string): Promise<void> {
  await db.contentOverrides.delete(id);
}
