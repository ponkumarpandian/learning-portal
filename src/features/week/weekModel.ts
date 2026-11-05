/**
 * View model for Week (§5.2, §15.1). Pure: plain data in, plain data out.
 *
 * She can open the lessons of any earlier day, so a missed day is never lost (parent request,
 * DECISIONS 2026-11-04). Today's lessons live on Today's trail. Future days stay locked (§5.2).
 */
import { addDays, format, parseISO, startOfISOWeek } from 'date-fns';
import type { ContentBundle, Slot, Subject } from '@/content';
import { WEEKDAYS, type Weekday } from '@/engine/clock';
import { isPlayable } from '../lesson/lessonFlow';
import { isStone } from '../today/todayModel';

export type WeekPage = 'this' | 'last';
export type When = 'past' | 'today' | 'future';

export interface WeekDay {
  dateKey: string;
  weekday: Weekday;
  when: When;
  /** the subjects studied that day, for the coloured dots */
  subjectIds: string[];
}

const KEY = 'yyyy-MM-dd';

/** The 7 days (Mon–Sun) of this week or last week, around today's IST date key. */
export function weekDays(b: Pick<ContentBundle, 'timetable'>, todayKey: string, page: WeekPage): WeekDay[] {
  const monday = addDays(startOfISOWeek(parseISO(todayKey)), page === 'last' ? -7 : 0);
  return WEEKDAYS.map((weekday, i) => {
    const dateKey = format(addDays(monday, i), KEY);
    const subjectIds = [
      ...new Set(
        (b.timetable.days[weekday] ?? []).flatMap((s) => (s.subject ? [s.subject] : (s.subjects ?? []))),
      ),
    ];
    const when: When = dateKey < todayKey ? 'past' : dateKey === todayKey ? 'today' : 'future';
    return { dateKey, weekday, when, subjectIds };
  });
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

/** A day's study stones (no activities or breaks), each with what a tap on it does. */
export function dayLessons(
  b: Pick<ContentBundle, 'timetable' | 'subjects'>,
  day: Pick<WeekDay, 'weekday' | 'when'>,
  done: ReadonlySet<number>,
): DayLesson[] {
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
