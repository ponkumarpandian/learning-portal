/**
 * The app's single source of "now".
 *
 * Everything date/time related is evaluated in Asia/Kolkata (IST, UTC+05:30, no DST),
 * regardless of the device's own time zone. Feature code must never call `new Date()`
 * for scheduling decisions — it takes a `Clock` so tests (and the dev `?now=` override)
 * can pin the time.
 *
 * Pure module: no React, no DOM (window is only read as a default for `createAppClock`).
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const TZ = 'Asia/Kolkata';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** ISO day-of-week order (1 = Monday … 7 = Sunday). */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface ZonedParts {
  /** `YYYY-MM-DD` in IST */
  dateKey: string;
  /** `HH:MM` (24 h) in IST */
  hhmm: string;
  weekday: Weekday;
  hour: number;
  minute: number;
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

/** Breaks an instant into its Asia/Kolkata wall-clock parts. */
export function zonedParts(d: Date): ZonedParts {
  // 'i' = ISO day of week, 1 (Mon) … 7 (Sun)
  const s = formatInTimeZone(d, TZ, 'yyyy-MM-dd HH:mm i');
  const [dateKey = '', hhmm = '', iso = '1'] = s.split(' ');
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  const [hour, minute] = hhmm.split(':').map(Number) as [number, number];
  return {
    dateKey,
    hhmm,
    weekday: WEEKDAYS[Number(iso) - 1] as Weekday,
    hour,
    minute,
    year,
    month,
    day,
  };
}

// YYYY-MM-DD, optional THH:MM[:SS[.sss]], optional Z / ±HH:MM / ±HHMM
const INSTANT_RE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Parses an ISO instant (`2026-11-01T18:30:00Z`, `…+05:30`) or an IST wall time without
 * offset (`2026-11-02T16:20`, `2026-11-02`). Returns `null` for anything invalid,
 * including impossible dates such as `2026-02-31` or `25:00`.
 */
export function parseInstant(input: string): Date | null {
  const m = INSTANT_RE.exec(input.trim());
  if (!m) return null;
  const [, datePart, timePart, offset] = m;
  const d = offset ? new Date(input.trim()) : fromZonedTime(input.trim(), TZ);
  if (Number.isNaN(d.getTime())) return null;
  // Reject rolled-over values (e.g. Feb 31 → Mar 3) for wall-time input.
  if (!offset) {
    const p = zonedParts(d);
    if (p.dateKey !== datePart || (timePart !== undefined && p.hhmm !== timePart)) return null;
  }
  return d;
}

/** Converts an IST wall date/time (`2026-11-02`, `16:20`) to the instant it represents. */
export function fromWallTime(dateKey: string, hhmm = '00:00'): Date {
  const d = parseInstant(`${dateKey}T${hhmm}`);
  if (!d) throw new RangeError(`Invalid IST wall time: ${dateKey} ${hhmm}`);
  return d;
}

/**
 * A clock frozen at one instant. A string without an offset is Asia/Kolkata wall time.
 * Throws `RangeError` on invalid input (programmer error in tests).
 */
export function fixedClock(isoOrWallTime: string): Clock {
  const d = parseInstant(isoOrWallTime);
  if (!d) throw new RangeError(`Invalid time for fixedClock: "${isoOrWallTime}"`);
  const t = d.getTime();
  return { now: () => new Date(t) };
}

/** Fake time is allowed in dev builds, or in a build made with VITE_ALLOW_FAKE_CLOCK=1. */
export function defaultAllowFakeClock(): boolean {
  return Boolean(import.meta.env.DEV) || import.meta.env.VITE_ALLOW_FAKE_CLOCK === '1';
}

function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

/**
 * The clock the app runs on. Honours `?now=2026-11-02T16:20` (IST wall time or ISO instant)
 * only when `allow()` is true; otherwise, or when the value is invalid, returns `systemClock`.
 * The fake clock is frozen (does not tick) so screens are deterministic for e2e tests.
 */
export function createAppClock(
  search: string = currentSearch(),
  allow: () => boolean = defaultAllowFakeClock,
): Clock {
  if (!allow()) return systemClock;
  const raw = new URLSearchParams(search).get('now');
  if (!raw) return systemClock;
  // An unencoded "+05:30" arrives as " 05:30" after URL decoding.
  const d = parseInstant(raw.replace(' ', '+'));
  if (!d) return systemClock;
  const t = d.getTime();
  return { now: () => new Date(t) };
}
