import { useEffect, useState } from 'react';
import { listSlotLogBetween } from '@/db/repos';

export type DoneByDay = ReadonlyMap<string, ReadonlySet<number>>;

/**
 * The slots logged as done on each day from `from` to `to` (IST date keys, both included).
 * Async: `undefined` until it has loaded (and if storage is blocked).
 * `reloadKey` re-reads after something changed.
 */
export function useDoneByDay(from: string, to: string, reloadKey = 0): DoneByDay | undefined {
  const key = `${from}|${to}|${reloadKey}`;
  const [state, setState] = useState<{ key: string; map: DoneByDay }>({ key: '', map: new Map() });
  useEffect(() => {
    let live = true;
    listSlotLogBetween(from, to)
      .then((rows) => {
        if (!live) return;
        const map = new Map<string, Set<number>>();
        for (const r of rows) {
          if (r.status !== 'done') continue;
          const set = map.get(r.date) ?? new Set<number>();
          set.add(r.slotIndex);
          map.set(r.date, set);
        }
        setState({ key, map });
      })
      .catch(() => {
        /* storage blocked: show the plain week */
      });
    return () => {
      live = false;
    };
  }, [from, to, key]);
  return state.key === key ? state.map : undefined;
}
