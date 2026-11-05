/**
 * View model for Week (§5.2, §15.1). Pure: plain data in, plain data out.
 *
 * She can open the lessons of any earlier day since the plan started, so a missed day is never lost
 * (parent request, DECISIONS 2026-11-04 and 2026-11-05). Today's lessons live on Today's trail.
 * Future days stay locked (§5.2). Days before `plan.startDate` had nothing assigned, so they show no
 * catch-ups.
 */
import { addDays, differenceInCalendarWeeks, format, parseISO, startOfISOWeek } from 'date-fns';
import type { ContentBundle, Slot, Subject } from '@/content';
import { WEEKDAYS, type Weekday } from '@/engine/clock';
import { isPlayable } from '../lesson/lessonFlow';
import { isStone } from '../today/todayModel';

export type When = 'past' | 'today' | 'future';

export interface WeekDay {
  dateKey: string;
  weekday: Weekday;
  when: When;
  /** before plan.startDate: nothing was assigned yet */
  beforeStart: boolean;
  /** the subjects studied that day, for the coloured dots */
  subjectIds: string[];
}

const KEY = 'yyyy-MM-dd';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const startKey = (b: Pick<ContentBundle, 'plan'>) =>
  DATE_RE.test(b.plan.startDate) ? b.plan.startDate : undefined;

function dayOf(
  b: Pick<ContentBundle, 'timetable' | 'plan'>,
  todayKey: string,
  dateKey: string,
  weekday: Weekday,
): WeekDay {
  const subjectIds = [
    ...new Set(
      (b.timetable.days[weekday] ?? []).flatMap((s) => (s.subject ? [s.subject] : (s.subjects ?? []))),
    ),
  ];
  const when: When = dateKey < todayKey ? 'past' : dateKey === todayKey ? 'today' : 'future';
  const start = startKey(b);
  return { dateKey, weekday, when, beforeStart: !!start && dateKey < start, subjectIds };
}

/**
 * The 7 days (Mon–Sun) of a week around today's IST date key.
 * @param offset 0 = this week, -1 = last week, -2 = the week before…
 */
export function weekDays(
  b: Pick<ContentBundle, 'timetable' | 'plan'>,
  todayKey: string,
  offset = 0,
): WeekDay[] {
  const monday = addDays(startOfISOWeek(parseISO(todayKey)), offset * 7);
  return WEEKDAYS.map((weekday, i) => dayOf(b, todayKey, format(addDays(monday, i), KEY), weekday));
}

/** How far back the Week view goes: the week the plan started in (0 in that week; -1 if no start date). */
export function earliestWeek(b: Pick<ContentBundle, 'plan'>, todayKey: string): number {
  const start = startKey(b);
  if (!start) return -1;
  const weeks = differenceInCalendarWeeks(parseISO(todayKey), parseISO(start), { weekStartsOn: 1 });
  return weeks > 0 ? -weeks : 0;
}

/** "This week", "Last week", "2 weeks ago"… */
export const weekName = (offset: number) =>
  offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${-offset} weeks ago`;

/** Every day from the plan start (or the first day of the earliest week) up to yesterday, oldest first. */
export function pastDays(b: Pick<ContentBundle, 'timetable' | 'plan'>, todayKey: string): WeekDay[] {
  const out: WeekDay[] = [];
  for (let w = earliestWeek(b, todayKey); w <= 0; w++)
    out.push(...weekDays(b, todayKey, w).filter((d) => d.when === 'past' && !d.beforeStart));
  return out;
}

/**
 * - done: logged as done that day (open it again)
 * - catchup: an earlier day's lesson not done yet (amber, startable)
 * - today: on today's trail
 * - locked: a future day (§5.2)
 * - soon: a test, revise or review slot (those screens arrive in later phases)
 */
export type DayLessonState = 'done' | 'catchup' | 'today' | 'locked' | 'soon';

export interface DayLesson {
  index: number;
  slot: Slot;
  subject?: Subject;
  name: string;
  emoji: string;
  state: DayLessonState;
}

/** A day's study stones (no activities or breaks), each with what a tap on it does. None before the start. */
export function dayLessons(
  b: Pick<ContentBundle, 'timetable' | 'subjects'>,
  day: Pick<WeekDay, 'weekday' | 'when'> & { beforeStart?: boolean },
  done: ReadonlySet<number>,
): DayLesson[] {
  if (day.beforeStart) return [];
  const subjects = new Map(b.subjects.map((s) => [s.id, s]));
  const out: DayLesson[] = [];
  (b.timetable.days[day.weekday] ?? []).forEach((slot, index) => {
    if (!isStone(slot)) return;
    const subject = slot.subject ? subjects.get(slot.subject) : undefined;
    const state: DayLessonState =
      day.when === 'future'
        ? 'locked'
        : done.has(index)
          ? 'done'
          : !isPlayable(slot)
            ? 'soon'
            : day.when === 'today'
              ? 'today'
              : 'catchup';
    out.push({
      index,
      slot,
      subject,
      name: subject?.name ?? slot.label ?? 'Study time',
      emoji: subject?.emoji ?? slot.emoji ?? '⭐',
      state,
    });
  });
  return out;
}

/** How many of a day's lessons are still waiting to be caught up on. */
export const catchUpCount = (lessons: readonly DayLesson[]) =>
  lessons.filter((l) => l.state === 'catchup').length;

const NONE: ReadonlySet<number> = new Set();

/** Lessons waiting to be caught up on, across these days. */
export const waitingAcross = (
  b: Pick<ContentBundle, 'timetable' | 'subjects'>,
  days: readonly WeekDay[],
  doneByDay: ReadonlyMap<string, ReadonlySet<number>>,
) =>
  days.reduce(
    (n, d) => n + (d.when === 'past' ? catchUpCount(dayLessons(b, d, doneByDay.get(d.dateKey) ?? NONE)) : 0),
    0,
  );
