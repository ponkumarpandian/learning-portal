import { addDays, format, parseISO, startOfISOWeek } from 'date-fns';
import { useMemo } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { TaraSays } from '@/components/SpeechBubble';
import { subjectVars, type ColourVars } from '@/components/colours';
import { Screen } from '@/components/layout/Screen';
import { WEEKDAYS, zonedParts } from '@/engine/clock';
import { useClock } from '@/state/clock';
import { useBundle } from '@/state/content';

const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' } as const;

/** Week (§15.1). Phase 0 placeholder: the 7 day bubbles with subject dots from the timetable. */
export function WeekScreen() {
  const clock = useClock();
  const bundle = useBundle();
  const parts = useMemo(() => zonedParts(clock.now()), [clock]);
  const monday = startOfISOWeek(parseISO(parts.dateKey));
  const subjects = new Map(bundle.subjects.map((s) => [s.id, s]));

  return (
    <Screen labelledBy="week-h">
      <TaraSays small>
        <h1 className="greet" id="week-h" tabIndex={-1}>
          Your week{' '}📅
        </h1>
        <p>
          {format(monday, 'd')}–{format(addDays(monday, 6), 'd MMMM')} · every day has its own adventure.
        </p>
      </TaraSays>

      <ul className="days" role="list" aria-label="Days of the week">
        {WEEKDAYS.map((w, i) => {
          const ids = [
            ...new Set(
              (bundle.timetable.days[w] ?? []).flatMap((s) => (s.subject ? [s.subject] : (s.subjects ?? []))),
            ),
          ];
          const isToday = w === parts.weekday;
          return (
            <li key={w} className={isToday ? 'day today' : 'day'} aria-current={isToday ? 'date' : undefined}>
              <span className="d-name">{isToday ? 'Today' : SHORT[w]}</span>
              <b className="d-num">{format(addDays(monday, i), 'd')}</b>
              <span className="sr-only">, {ids.length} subjects</span>
              <span className="dots" aria-hidden="true">
                {ids.map((id) => (
                  <i key={id} style={{ '--c': subjectVars(subjects.get(id))['--s'] } as ColourVars} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>

      <EmptyState
        title="Your week map is on its way!"
        body="Soon you can tap a day to see every lesson, activity and break in big friendly rows."
        mood="cheer"
      />
    </Screen>
  );
}
