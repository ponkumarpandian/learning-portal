import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  getSettings,
  readLookMirror,
  saveSettings,
  type Settings,
  type WorldId,
} from '@/db/repos/settings';
import { defaultAllowFakeClock } from '@/engine/clock';

/**
 * Kid settings (§15.4): persisted through the Dexie settings repo, applied to <html> as
 *   data-world="meadow|ocean|space"  data-theme="light|dark" (RESOLVED)  data-text="big|bigger"
 * and <meta name="theme-color"> follows the current --go.
 */

export type ResolvedTheme = 'light' | 'dark';

/** Theme the tokens use: Space is always dark; Auto follows the device. */
export function resolveTheme(s: Pick<Settings, 'world' | 'night'>, systemDark: boolean): ResolvedTheme {
  if (s.world === 'space') return 'dark';
  if (s.night === 'night') return 'dark';
  if (s.night === 'day') return 'light';
  return systemDark ? 'dark' : 'light';
}

/** Fallbacks for theme-color when computed styles are not available (tests, very old browsers). */
const GO: Record<WorldId, string> = { meadow: '#1f9d55', ocean: '#e8436f', space: '#ffc93c' };

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

/** Writes the data attributes + theme-color. Pure DOM; safe to call before React mounts. */
export function applyToDocument(
  s: Pick<Settings, 'world' | 'night' | 'textSize'>,
  systemDark: boolean,
): ResolvedTheme {
  const theme = resolveTheme(s, systemDark);
  if (typeof document === 'undefined') return theme;
  const html = document.documentElement;
  html.dataset.world = s.world;
  html.dataset.theme = theme;
  html.dataset.text = s.textSize;
  const go = getComputedStyle(html).getPropertyValue('--go').trim() || GO[s.world];
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = go;
  return theme;
}

const WORLDS: readonly WorldId[] = ['meadow', 'ocean', 'space'];
const NIGHTS: readonly Settings['night'][] = ['auto', 'day', 'night'];
const TEXTS: readonly Settings['textSize'][] = ['big', 'bigger'];
const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;

/**
 * Dev/QA-only look override from the URL (`?world=space&night=night&text=bigger`), honoured under the
 * same rule as the fake clock. Never persisted. Used by scripts/screenshot.ts.
 */
export function readLookOverride(
  search: string,
  allow: () => boolean = defaultAllowFakeClock,
): Partial<Settings> {
  if (!allow()) return {};
  const p = new URLSearchParams(search);
  const out: Partial<Settings> = {};
  const world = pick(WORLDS, p.get('world'));
  const night = pick(NIGHTS, p.get('night'));
  const textSize = pick(TEXTS, p.get('text'));
  if (world) out.world = world;
  if (night) out.night = night;
  if (textSize) out.textSize = textSize;
  return out;
}

interface SettingsState {
  settings: Settings;
  theme: ResolvedTheme;
  systemDark: boolean;
  hydrated: boolean;
  /** Loads from Dexie (+ dev URL override) and applies to the document. */
  hydrate: (search?: string) => Promise<void>;
  /** Optimistically applies, then persists. */
  update: (patch: Partial<Settings>) => Promise<void>;
  setSystemDark: (dark: boolean) => void;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  theme: 'light',
  systemDark: false,
  hydrated: false,

  hydrate: async (search = typeof window === 'undefined' ? '' : window.location.search) => {
    const systemDark = systemPrefersDark();
    let stored: Settings;
    try {
      stored = await getSettings();
    } catch {
      stored = { ...DEFAULT_SETTINGS };
    }
    const settings = { ...stored, ...readLookOverride(search) };
    const theme = applyToDocument(settings, systemDark);
    set({ settings, theme, systemDark, hydrated: true });
  },

  update: async (patch) => {
    const settings = { ...get().settings, ...patch };
    const theme = applyToDocument(settings, get().systemDark);
    set({ settings, theme });
    try {
      await saveSettings(patch);
    } catch {
      /* storage blocked: keep the in-memory choice for this visit */
    }
  },

  setSystemDark: (systemDark) => {
    const theme = applyToDocument(get().settings, systemDark);
    set({ systemDark, theme });
  },
}));

/** The mascot's name (Settings.mascotName, §10); every kid line that names her uses this. */
export const useMascotName = (): string =>
  useSettings((s) => s.settings.mascotName.trim() || DEFAULT_SETTINGS.mascotName);

let listening = false;

/**
 * Applies the mirrored look synchronously (no flash), starts following the device's dark mode for
 * night = Auto, then hydrates from Dexie. Call once before rendering.
 */
export function initSettings(): Promise<void> {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const early = { ...DEFAULT_SETTINGS, ...readLookMirror(), ...readLookOverride(search) };
  const systemDark = systemPrefersDark();
  useSettings.setState({ settings: early, systemDark, theme: applyToDocument(early, systemDark) });
  if (!listening && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    listening = true;
    window
      .matchMedia(DARK_QUERY)
      .addEventListener('change', (e) => useSettings.getState().setSystemDark(e.matches));
  }
  return useSettings.getState().hydrate(search);
}
