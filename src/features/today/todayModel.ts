/**
 * View model for Today. It reads the timetable for today's weekday and highlights the study slot that
 * contains "now". A study slot whose time has passed (before bedtime) is a catch-up (§5.2): it stays
 * startable. Slots logged as done today (slotLog, passed in by the screen) show the gold ✓ stone, are
 * never catch-ups, and the Up now card moves on to the next slot that is not done.
 * The bedtime block and locks are the Phase 1 timetable engine (src/engine/timetable.ts).
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { STUDY_KINDS, toMinutes, type ContentBundle, type Slot, type Subject } from '@/content';
import type { ZonedParts } from '@/engine/clock';

/** Slots studied in the app (stones). Activities and offline tasks are rest stops; breaks are off the trail. */
const STONE_KINDS = new Set<Slot['kind']>([...STUDY_KINDS, 'test', 'review']);

export type TodayEntry =
  | {
      type: 'stone';
      index: number;
      slot: Slot;
      subject?: Subject;
      name: string;
      emoji: string;
      isNow: boolean;
      /** logged as done today (slotLog) → the gold ✓ stone */
      isDone: boolean;
      /** study slot whose end time has passed, still before bedtime → amber "Catch up", startable (§5.2) */
      isCatchUp: boolean;
    }
  | { type: 'rest'; index: number; slot: Slot; name: string; emoji: string };

export interface TodayView {
  entries: TodayEntry[];
  /** study slots (lesson, homework_lesson, revise, fixit) */
  lessonCount: number;
  /** study slots logged as done today */
  doneCount: number;
  /** the not-done study slot containing now, else the next not-done study slot today */
  upNow?: { entry: Extract<TodayEntry, { type: 'stone' }>; isNow: boolean };
  /** past study slots still waiting today, in timetable order (§5.2) */
  catchUps: Extract<TodayEntry, { type: 'stone' }>[];
  /** the activity happening right now (Up now card says "Enjoy …!") */
  activityNow?: Extract<TodayEntry, { type: 'rest' }>;
  /** the first non-break slot after upNow / the current activity */
  next?: TodayEntry;
  bedtime: string;
  dayNumber?: number;
  daysToExams?: number;
}

export function isStone(slot: Slot): boolean {
  return STONE_KINDS.has(slot.kind);
}

/** "17:30" → "5:30" (12-hour without am/pm, as in the prototype). */
export function fmtTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}
export const fmtRange = (s: Pick<Slot, 'start' | 'end'>) => `${fmtTime(s.start)}–${fmtTime(s.end)}`;
export const slotMinutes = (s: Pick<Slot, 'start' | 'end'>) => toMinutes(s.end) - toMinutes(s.start);

/** "Bharatanatyam class" → "Bharatanatyam" (short label for the trail pill). */
export const shortLabel = (label: string) => label.replace(/\s+class$/i, '');

function examDays(b: ContentBundle, dateKey: string): number | undefined {
  const { exams } = b.plan;
  const dates = exams.mode === 'single' ? [exams.date] : Object.values(exams.dates ?? {});
  const real = dates.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const left = real
    .map((d) => differenceInCalendarDays(parseISO(d), parseISO(dateKey)))
    .filter((n) => n >= 0);
  return left.length ? Math.min(...left) : undefined;
}

/**
 * @param done slot indices logged as done today (from slotLog)
 */
export function buildToday(
  b: ContentBundle,
  parts: ZonedParts,
  done: ReadonlySet<number> = new Set(),
): TodayView {
  const slots = b.timetable.days[parts.weekday] ?? [];
  const now = toMinutes(parts.hhmm);
  const subjects = new Map(b.subjects.map((s) => [s.id, s]));
  const schoolNight = b.timetable.schoolNights.includes(parts.weekday);
  const bedtime = schoolNight ? b.timetable.bedtime.schoolNights : b.timetable.bedtime.weekendNights;
  const beforeBedtime = now < toMinutes(bedtime);

  const entries: TodayEntry[] = [];
  slots.forEach((slot, index) => {
    if (slot.kind === 'break') return;
    const inSlot = toMinutes(slot.start) <= now && now < toMinutes(slot.end);
    if (isStone(slot)) {
      const subject = slot.subject ? subjects.get(slot.subject) : undefined;
      entries.push({
        type: 'stone',
        index,
        slot,
        subject,
        name: subject?.name ?? slot.label ?? 'Study time',
        emoji: subject?.emoji ?? slot.emoji ?? '⭐',
        isNow: inSlot,
        isDone: done.has(index),
        isCatchUp:
          !done.has(index) && STUDY_KINDS.includes(slot.kind) && toMinutes(slot.end) <= now && beforeBedtime,
      });
    } else {
      entries.push({
        type: 'rest',
        index,
        slot,
        name: shortLabel(slot.label ?? ''),
        emoji: slot.emoji ?? '🎈',
      });
    }
  });

  const stones = entries.filter((e): e is Extract<TodayEntry, { type: 'stone' }> => e.type === 'stone');
  const nowStone = stones.find((e) => e.isNow && !e.isDone);
  const nextStone = stones.find((e) => !e.isDone && toMinutes(e.slot.start) > now);
  const activityNow = entries.find(
    (e): e is Extract<TodayEntry, { type: 'rest' }> =>
      e.type === 'rest' && toMinutes(e.slot.start) <= now && now < toMinutes(e.slot.end),
  );
  const upNow = nowStone
    ? { entry: nowStone, isNow: true }
    : nextStone
      ? { entry: nextStone, isNow: false }
      : undefined;
  const after = upNow?.entry ?? activityNow;
  const next = after
    ? entries.find((e) => e.index > after.index && !(e.type === 'stone' && e.isDone))
    : undefined;

  const day = differenceInCalendarDays(parseISO(parts.dateKey), parseISO(b.plan.startDate)) + 1;

  return {
    entries,
    lessonCount: slots.filter((s) => STUDY_KINDS.includes(s.kind)).length,
    doneCount: slots.filter((s, i) => STUDY_KINDS.includes(s.kind) && done.has(i)).length,
    upNow,
    catchUps: stones.filter((e) => e.isCatchUp),
    activityNow,
    next,
    bedtime,
    dayNumber: day >= 1 ? day : undefined,
    daysToExams: examDays(b, parts.dateKey),
  };
}

/** Greeting by IST time of day (§5.1, Appendix E). */
const NBSP = String.fromCharCode(0xa0);

export function greeting(hour: number, name: string): string {
  // non-breaking space keeps the emoji on the same line as the last word
  if (hour < 12) return `Good morning, ${name}!${NBSP}☀️`;
  if (hour < 17) return `Good afternoon, ${name}!${NBSP}🌤️`;
  return `Good evening, ${name}!${NBSP}🌙`;
}

const WEEKDAY_NAMES: Record<ZonedParts['weekday'], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
export const weekdayName = (w: ZonedParts['weekday']) => WEEKDAY_NAMES[w];
