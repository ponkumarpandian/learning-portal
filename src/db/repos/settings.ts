import { db } from '../db';

export type WorldId = 'meadow' | 'ocean' | 'space';

export type Settings = {
  world: WorldId;
  night: 'auto' | 'day' | 'night';
  textSize: 'big' | 'bigger';
  sound: boolean;
  vibration: boolean;
  narration: boolean;
  mascotName: string;
  /** Hash of the parent PIN; absent until the parent sets one */
  pinHash?: string;
  onboarded: boolean;
  /** `HH:MM` bedtime on school nights (Sun–Thu); absent means the 21:45 default (§5.2) */
  bedtimeSchoolNights?: string;
};

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  world: 'meadow',
  night: 'auto',
  textSize: 'big',
  sound: false,
  vibration: false,
  narration: true,
  mascotName: 'Tara',
  onboarded: false,
});

const ID = 'app' as const;

/* ---------- first-paint look mirror ----------
 * world / night / textSize are copied to localStorage so main.tsx can paint the right colours before
 * Dexie opens. Dexie stays the source of truth: every getSettings()/saveSettings() rewrites the copy,
 * and the Phase 6 wipe must call clearLookMirror(). Nothing outside this repo touches the key. */

export type LookSettings = Pick<Settings, 'world' | 'night' | 'textSize'>;

const MIRROR_KEY = 'aa-look';
const WORLDS: readonly WorldId[] = ['meadow', 'ocean', 'space'];
const NIGHTS: readonly Settings['night'][] = ['auto', 'day', 'night'];
const TEXTS: readonly Settings['textSize'][] = ['big', 'bigger'];
const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;

/** The last saved look, synchronously (empty when absent, invalid or storage is blocked). */
export function readLookMirror(): Partial<LookSettings> {
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<LookSettings> = {};
    const world = pick(WORLDS, v.world);
    const night = pick(NIGHTS, v.night);
    const textSize = pick(TEXTS, v.textSize);
    if (world) out.world = world;
    if (night) out.night = night;
    if (textSize) out.textSize = textSize;
    return out;
  } catch {
    return {};
  }
}

function writeLookMirror(s: LookSettings): void {
  try {
    window.localStorage.setItem(
      MIRROR_KEY,
      JSON.stringify({ world: s.world, night: s.night, textSize: s.textSize }),
    );
  } catch {
    /* private mode / blocked storage: the mirror is only a first-paint convenience */
  }
}

/** Removes the first-paint copy (the Phase 6 wipe calls this with the table clears). */
export function clearLookMirror(): void {
  try {
    window.localStorage.removeItem(MIRROR_KEY);
  } catch {
    /* nothing to clear */
  }
}

function clean(s: Settings): Settings {
  const out = { ...s } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as Settings;
}

function fromRecord(rec: ({ id?: string } & Partial<Settings>) | undefined): Settings {
  const { id: _id, ...rest } = rec ?? {};
  void _id;
  return clean({ ...DEFAULT_SETTINGS, ...rest });
}

/** Stored settings merged over the defaults (so newly added settings get their default). */
export async function getSettings(): Promise<Settings> {
  const s = fromRecord(await db.settings.get(ID));
  writeLookMirror(s);
  return s;
}

/**
 * Merges `patch` into the stored settings and returns the result.
 * Passing `undefined` for an optional key (e.g. `pinHash`) removes it.
 */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return db
    .transaction('rw', db.settings, async () => {
      const next = clean({ ...fromRecord(await db.settings.get(ID)), ...patch });
      await db.settings.put({ ...next, id: ID });
      return next;
    })
    .then((next) => {
      writeLookMirror(next);
      return next;
    });
}
