import { db, type RewardsRecord } from '../db';

export type Rewards = Omit<RewardsRecord, 'id' | 'updatedAt'>;

export const DEFAULT_REWARDS: Readonly<Rewards> = Object.freeze({
  stars: 0,
  level: 1,
  badges: [],
  streak: 0,
  bestStreak: 0,
  shields: 0,
});

const ID = 'me' as const;

function fromRecord(rec: RewardsRecord | undefined): Rewards {
  const { id: _id, updatedAt: _u, ...rest } = rec ?? { id: ID, updatedAt: 0 };
  void _id;
  void _u;
  return { ...DEFAULT_REWARDS, badges: [...DEFAULT_REWARDS.badges], ...rest };
}

export async function getRewards(): Promise<Rewards> {
  return fromRecord(await db.rewards.get(ID));
}

/** Merges `patch` into the stored rewards (rules live in `engine/rewards`, Phase 3). */
export async function saveRewards(patch: Partial<Rewards>, at: number = Date.now()): Promise<Rewards> {
  return db.transaction('rw', db.rewards, async () => {
    const next = { ...fromRecord(await db.rewards.get(ID)), ...patch };
    await db.rewards.put({ ...next, id: ID, updatedAt: at });
    return next;
  });
}

/**
 * Adds stars in one transaction (so two quick awards never lose one). Levels and badges are the
 * Phase 3 rewards engine's job; this only moves the star count.
 */
export async function addStars(n: number, at: number = Date.now()): Promise<Rewards> {
  if (!(Number.isFinite(n) && n >= 0)) throw new RangeError(`stars to add must be ≥ 0, got ${n}`);
  return db.transaction('rw', db.rewards, async () => {
    const prev = fromRecord(await db.rewards.get(ID));
    const next = { ...prev, stars: prev.stars + n };
    await db.rewards.put({ ...next, id: ID, updatedAt: at });
    return next;
  });
}
