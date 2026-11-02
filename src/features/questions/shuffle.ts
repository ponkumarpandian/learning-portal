/**
 * Deterministic, per-question shuffles (§8.2 "options shuffled"): the same question id always gives the
 * same order, so a reload or a resumed lesson shows exactly what she saw before.
 */

/** FNV-1a 32-bit hash of a string. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded PRNG returning [0, 1). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seed derived from `seed` (e.g. the question id plus a purpose tag). */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const next = rng(hash(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * A shuffle that is never the original order (when there are at least 2 different items), so an
 * order question never starts already solved.
 */
export function shuffledAway<T>(items: readonly T[], seed: string): T[] {
  const out = seededShuffle(items, seed);
  const same = out.every((x, i) => x === items[i]);
  if (!same || items.length < 2) return out;
  return [...out.slice(1), out[0]!];
}
