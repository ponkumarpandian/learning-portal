import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TaraSays } from '@/components/SpeechBubble';
import { subjectVars, tokenVars, type ColourVars } from '@/components/colours';
import { Screen } from '@/components/layout/Screen';
import { listSlotLogForDate } from '@/db/repos';
import { zonedParts } from '@/engine/clock';
import { useClock } from '@/state/clock';
import { useBundle } from '@/state/content';
import { fmtRange, fmtTime, weekdayName } from '../today/todayModel';
import { catchUpCount, dayLessons, weekDays, type DayLesson, type WeekDay, type WeekPage } from './weekModel';

const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' } as const;
const PAGES = [
  { value: 'this', label: 'This week' },
  { value: 'last', label: 'Last week' },
] as const;
const NONE: ReadonlySet<number> = new Set();

/** The slots logged as done on each of these days (async; starts empty, so nothing shows as done). */
function useDoneByDay(dateKeys: readonly string[]): ReadonlyMap<string, ReadonlySet<number>> {
  const joined = dateKeys.join(',');
  const [state, setState] = useState<{ key: string; map: ReadonlyMap<string, ReadonlySet<number>> }>({
    key: '',
    map: new Map(),
  });
  useEffect(() => {
    let live = true;
    const keys = joined.split(',');
    Promise.all(keys.map((k) => listSlotLogForDate(k)))
      .then((logs) => {
        if (!live) return;
        const map = new Map(
          logs.map((log, i) => [
            keys[i]!,
            new Set(log.filter((r) => r.status === 'done').map((r) => r.slotIndex)),
          ]),
        );
        setState({ key: joined, map });
      })
      .catch(() => {
        /* storage blocked: show the plain week */
      });
    return () => {
      live = false;
    };
  }, [joined]);
  return state.key === joined ? state.map : new Map();
}

type Sheet = { icon: ReactNode; title: string; body: string } | null;

/**
 * Week (§15.1, §5.2): the 7 day bubbles with subject dots, this week or last week. Tap a day to see its
 * lessons. An earlier day's missed lesson is an amber "Catch up" she can still start; today's are on
 * Today's trail; future days are locked.
 */
export function WeekScreen() {
  const clock = useClock();
  const bundle = useBundle();
  const todayKey = useMemo(() => zonedParts(clock.now()).dateKey, [clock]);
  const [page, setPage] = useState<WeekPage>('this');
  const days = useMemo(() => weekDays(bundle, todayKey, page), [bundle, todayKey, page]);
  const [picked, setPicked] = useState<string>(todayKey);
  const [sheet, setSheet] = useState<Sheet>(null);
  const doneByDay = useDoneByDay(useMemo(() => days.map((d) => d.dateKey), [days]));
  const subjects = useMemo(() => new Map(bundle.subjects.map((s) => [s.id, s])), [bundle.subjects]);

  const selected = days.find((d) => d.dateKey === picked) ?? days.find((d) => d.when === 'today') ?? days[6]!;
  const lessonsOf = (d: WeekDay) => dayLessons(bundle, d, doneByDay.get(d.dateKey) ?? NONE);
  const lessons = lessonsOf(selected);
  const missedThisPage = days.reduce((n, d) => n + (d.when === 'past' ? catchUpCount(lessonsOf(d)) : 0), 0);

  const changePage = (p: WeekPage) => {
    setPage(p);
    // this week opens on today; last week opens on its Sunday (the day just gone)
    setPicked(p === 'this' ? todayKey : (weekDays(bundle, todayKey, p)[6]?.dateKey ?? todayKey));
  };

  const first = days[0]!.dateKey;
  const last = days[6]!.dateKey;
  const heading = (
    <>
      {format(parseISO(first), 'd')}–{format(parseISO(last), 'd MMMM')}
    </>
  );

  return (
    <Screen labelledBy="week-h">
      <TaraSays small>
        <h1 className="greet" id="week-h" tabIndex={-1}>
          Your week 📅
        </h1>
        <p>
          {heading} ·{' '}
          {missedThisPage > 0
            ? `${missedThisPage} lesson${missedThisPage === 1 ? '' : 's'} waiting to catch up 🙂`
            : 'every day has its own adventure.'}
        </p>
      </TaraSays>

      <SegmentedControl label="Which week?" options={PAGES} value={page} onChange={changePage} />

      <ul className="days" role="list" aria-label="Days of the week">
        {days.map((d) => {
          const isToday = d.when === 'today';
          const isPicked = d.dateKey === selected.dateKey;
          const waiting = d.when === 'past' ? catchUpCount(lessonsOf(d)) : 0;
          const cls = ['day', isToday && 'today', isPicked && 'picked', d.when === 'future' && 'later']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={d.dateKey}>
              <button
                type="button"
                className={cls}
                aria-pressed={isPicked}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => setPicked(d.dateKey)}
              >
                <span className="d-name">{isToday ? 'Today' : SHORT[d.weekday]}</span>
                <b className="d-num">{format(parseISO(d.dateKey), 'd')}</b>
                <span className="sr-only">
                  , {weekdayName(d.weekday)}
                  {waiting > 0 ? `, ${waiting} to catch up` : ''}
                  {d.when === 'future' ? ', locked' : ''}
                </span>
                <span className="dots" aria-hidden="true">
                  {d.subjectIds.map((id) => (
                    <i key={id} style={{ '--c': subjectVars(subjects.get(id))['--s'] } as ColourVars} />
                  ))}
                </span>
                {waiting > 0 && (
                  <span className="d-wait" aria-hidden="true">
                    {waiting}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <DayCard
        day={selected}
        lessons={lessons}
        onLocked={(l) =>
          setSheet({
            icon: '🔒',
            title: `${l.name} opens on ${weekdayName(selected.weekday)} 🙂`,
            body: `It starts at ${fmtTime(l.slot.start)}. Today’s trail has stones waiting for you!`,
          })
        }
        onSoon={(l) =>
          setSheet({
            icon: l.emoji,
            title: 'Coming in the next part of your adventure 🛠️',
            body: `${l.name} sessions open in the app soon.`,
          })
        }
      />

      <BottomSheet
        open={sheet !== null}
        icon={sheet?.icon ?? ''}
        title={sheet?.title ?? ''}
        body={sheet?.body}
        primary={{ label: 'OK, got it', onClick: () => setSheet(null) }}
        onDismiss={() => setSheet(null)}
      />
    </Screen>
  );
}

function DayCard({
  day,
  lessons,
  onLocked,
  onSoon,
}: {
  day: WeekDay;
  lessons: DayLesson[];
  onLocked: (l: DayLesson) => void;
  onSoon: (l: DayLesson) => void;
}) {
  const waiting = catchUpCount(lessons);
  const done = lessons.filter((l) => l.state === 'done').length;
  const title = `${day.when === 'today' ? 'Today · ' : ''}${weekdayName(day.weekday)} ${format(parseISO(day.dateKey), 'd MMMM')}`;
  const line =
    lessons.length === 0
      ? 'No lessons on this day — enjoy it! 🌈'
      : day.when === 'future'
        ? `🔒 This day opens on ${weekdayName(day.weekday)}.`
        : day.when === 'today'
          ? done === lessons.length
            ? 'All done today — brilliant! 🎉'
            : 'These are on today’s trail.'
          : waiting > 0
            ? `${waiting} lesson${waiting === 1 ? '' : 's'} waiting for you. You can still do ${waiting === 1 ? 'it' : 'them'} now 🙂`
            : done > 0
              ? 'All caught up — brilliant! 🎉'
              : 'Nothing to catch up here.';

  return (
    <Card className="wday" aria-labelledby="wday-h">
      <h2 id="wday-h">{title}</h2>
      <p className="muted">{line}</p>
      {lessons.length > 0 && (
        <ul className="wrows" role="list">
          {lessons.map((l) => {
            const vars = l.slot.kind === 'test' ? tokenVars('gold') : subjectVars(l.subject);
            const time = fmtRange(l.slot);
            const body = (
              <>
                <span className="wrow-badge" aria-hidden="true">
                  {l.emoji}
                </span>
                <span className="wrow-text">
                  <b>{l.name}</b>
                  <span className="muted">{time}</span>
                </span>
                <span className="wrow-state">{STATE_LABEL[l.state]}</span>
              </>
            );
            const cls = `wrow is-${l.state}`;
            const name = `${l.name}, ${time}, ${STATE_SR[l.state]}`;
            if (l.state === 'catchup' || l.state === 'done')
              return (
                <li key={l.index} style={vars}>
                  <Link className={cls} to={`/lesson/${day.dateKey}/${l.index}`} aria-label={name}>
                    {body}
                  </Link>
                </li>
              );
            if (l.state === 'today')
              return (
                <li key={l.index} style={vars}>
                  <Link className={cls} to="/" aria-label={name}>
                    {body}
                  </Link>
                </li>
              );
            return (
              <li key={l.index} style={vars}>
                <button
                  type="button"
                  className={cls}
                  aria-label={name}
                  onClick={() => (l.state === 'locked' ? onLocked(l) : onSoon(l))}
                >
                  {body}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const STATE_LABEL: Record<DayLesson['state'], string> = {
  catchup: '⏳ Catch up',
  done: '✅ Done',
  today: '▶️ Today',
  locked: '🔒',
  soon: '🛠️ Soon',
};
const STATE_SR: Record<DayLesson['state'], string> = {
  catchup: 'catch up now',
  done: 'done, open it again',
  today: 'on today’s trail',
  locked: 'locked until that day',
  soon: 'coming soon',
};
