import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { ChunkyButton, ChunkyLink } from '@/components/ChunkyButton';
import { ProgressBar } from '@/components/ProgressBar';
import { TaraSays } from '@/components/SpeechBubble';
import { Tara } from '@/components/Tara';
import { Trail, type TrailItem } from '@/components/Trail';
import { subjectVars, tokenVars, type ColourVars } from '@/components/colours';
import { Screen } from '@/components/layout/Screen';
import { getRewards, listSlotLogForDate } from '@/db/repos';
import { zonedParts } from '@/engine/clock';
import { useClock } from '@/state/clock';
import { useBundle } from '@/state/content';
import { useSettings } from '@/state/settingsStore';
import { KID_NAME } from '../copy';
import { useDoneByDay } from '../week/useDoneByDay';
import { pastDays, waitingAcross } from '../week/weekModel';
import {
  buildToday,
  fmtRange,
  fmtTime,
  greeting,
  slotMinutes,
  weekdayName,
  type TodayEntry,
} from './todayModel';

type Sheet = {
  icon: ReactNode;
  title: string;
  body: string;
  primary: string;
  /** what the primary button does (default: close the sheet) */
  onPrimary?: () => void;
  /** optional soft second button that closes the sheet */
  secondary?: string;
  /** what the second button does after closing the sheet */
  onSecondary?: () => void;
} | null;

function entryVars(e: TodayEntry, subjectsById: Map<string, { id: string; colour: string }>): ColourVars {
  if (e.type === 'rest') return tokenVars(e.slot.colour ?? 'fun');
  if (e.slot.kind === 'test') return tokenVars('gold');
  const id = e.slot.subject ?? e.slot.subjects?.[0];
  return subjectVars(id ? subjectsById.get(id) : undefined);
}

const NONE: ReadonlySet<number> = new Set();

/** Today's logged slots and the star count, loaded from the repos (async; starts empty). */
function useTodayLog(dateKey: string): { done: ReadonlySet<number>; stars: number } {
  const [state, setState] = useState<{ key: string; done: ReadonlySet<number>; stars: number }>({
    key: '',
    done: NONE,
    stars: 0,
  });
  useEffect(() => {
    let live = true;
    Promise.all([listSlotLogForDate(dateKey), getRewards()])
      .then(([log, rewards]) => {
        if (!live) return;
        const done = new Set(log.filter((r) => r.status === 'done').map((r) => r.slotIndex));
        setState({ key: dateKey, done, stars: rewards.stars });
      })
      .catch(() => {
        /* storage blocked: show the plain trail */
      });
    return () => {
      live = false;
    };
  }, [dateKey]);
  return state.key === dateKey ? state : { done: NONE, stars: state.stars };
}

/**
 * Today (§5.1, §15.1, §15.3): greeting by IST time of day, chips, the Up now card and Today's trail
 * built from content/timetable.json. The stone whose time window contains now glows; past study slots
 * are amber catch-ups that can still be started until bedtime (§5.2); slots done today (slotLog) are
 * gold ✓ stones and the Up now card moves on to the next one.
 */
export function TodayScreen() {
  const clock = useClock();
  const bundle = useBundle();
  const textSize = useSettings((s) => s.settings.textSize);
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Sheet>(null);

  const parts = useMemo(() => zonedParts(clock.now()), [clock]);
  const log = useTodayLog(parts.dateKey);
  const view = useMemo(() => buildToday(bundle, parts, log.done), [bundle, parts, log.done]);
  const subjectsById = useMemo(() => new Map(bundle.subjects.map((s) => [s.id, s])), [bundle.subjects]);
  const earlier = useMemo(() => pastDays(bundle, parts.dateKey), [bundle, parts.dateKey]);
  const earlierLog = useDoneByDay(earlier[0]?.dateKey ?? parts.dateKey, earlier.at(-1)?.dateKey ?? '');
  const waitingEarlier = earlierLog ? waitingAcross(bundle, earlier, earlierLog) : 0;

  const start = (index: number) => navigate(`/lesson/${parts.dateKey}/${index}`);
  const nowIndex = view.upNow?.isNow ? view.upNow.entry.index : undefined;
  const upNowName = view.upNow?.entry.name;

  const onStone = (e: Extract<TodayEntry, { type: 'stone' }>) => {
    if (e.isDone) {
      return setSheet({
        icon: '⭐',
        title: `${e.name} is done! ✅`,
        body: 'You finished this one today. Your stars are safe.',
        primary: 'Back to my trail',
        secondary: 'Open it again',
        onSecondary: () => start(e.index),
      });
    }
    if (e.index === nowIndex) return start(e.index);
    if (e.isCatchUp) {
      return setSheet({
        icon: e.emoji,
        title: 'This one’s waiting for you 🙂',
        body: `${e.name} was at ${fmtRange(e.slot)}. Want to do it now?`,
        primary: `Start ${e.name} now`,
        onPrimary: () => start(e.index),
        secondary: 'Not now',
      });
    }
    setSheet({
      icon: <Tara size="fill" label={null} />,
      title: `${e.name} starts at ${fmtTime(e.slot.start)}.`,
      body:
        nowIndex !== undefined ? 'Finish the glowing stone first!' : 'You can start it from the Up now card.',
      primary: 'OK, got it',
    });
  };
  const onRest = (e: Extract<TodayEntry, { type: 'rest' }>) => {
    const later = view.entries.find((x) => x.type === 'stone' && x.index > e.index);
    setSheet({
      icon: e.emoji,
      title: e.slot.kind === 'activity' ? `Enjoy ${e.name}! ${e.emoji}` : `${e.name} ${e.emoji}`,
      body:
        e.slot.kind === 'offline_task'
          ? 'Do this one in your notebook, then tick it off.'
          : later
            ? `Your next lesson is at ${fmtTime(later.slot.start)}.`
            : 'Have fun!',
      primary: 'Back to my trail',
    });
  };

  const items: TrailItem[] = view.entries.map((e) =>
    e.type === 'stone'
      ? {
          type: 'stone',
          key: `s${e.index}`,
          name: e.name,
          emoji: e.emoji,
          time: fmtRange(e.slot),
          state: e.isDone ? 'done' : e.index === nowIndex ? 'now' : e.isCatchUp ? 'catchup' : 'later',
          vars: entryVars(e, subjectsById),
          onSelect: () => onStone(e),
        }
      : {
          type: 'rest',
          key: `r${e.index}`,
          label: e.name,
          emoji: e.emoji,
          time: fmtRange(e.slot),
          vars: entryVars(e, subjectsById),
          onSelect: () => onRest(e),
        },
  );
  items.push({
    type: 'rest',
    key: 'bed',
    label: 'Sleep time',
    emoji: '🌙',
    time: fmtTime(view.bedtime),
    end: true,
    onSelect: () =>
      setSheet({
        icon: <Tara size="fill" mood="sleepy" label={null} />,
        title: `Time to sleep at ${fmtTime(view.bedtime)} 🌙`,
        body: 'Your stars are safe. See you tomorrow.',
        primary: 'Back to my trail',
      }),
  });

  const n = view.lessonCount;
  const doneN = view.doneCount;
  const line =
    n === 0
      ? 'No lessons today — enjoy your day! 🌈'
      : doneN >= n
        ? `All ${n} lesson${n === 1 ? '' : 's'} done today — brilliant! 🎉`
        : doneN > 0
          ? `${doneN} done, ${n - doneN} to go — you’re doing great!`
          : `${n} lesson${n === 1 ? '' : 's'} today — you’ve got this!`;
  const eyebrow = [weekdayName(parts.weekday), view.dayNumber ? `Day ${view.dayNumber}` : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen labelledBy="today-h">
      <TaraSays>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="greet" id="today-h" tabIndex={-1}>
          {greeting(parts.hour, KID_NAME)}
        </h1>
        <p>{line}</p>
        {n > 0 && (
          <div className="prog-row">
            <ProgressBar value={doneN} max={n} label="Today's lessons" />
            <span>
              {doneN} of {n} done
            </span>
          </div>
        )}
      </TaraSays>

      <ChipRow>
        <Chip value="🔥 0" label="day streak" srLabel="0 day streak" />
        <Chip value={`⭐ ${log.stars}`} label="stars" srLabel={`${log.stars} stars`} />
        {view.daysToExams !== undefined ? (
          <Chip
            value={`📅 ${view.daysToExams}`}
            label="days to exams"
            srLabel={`${view.daysToExams} days to exams`}
          />
        ) : (
          <Chip value="📅 Soon" label="exam dates" srLabel="Exam dates coming soon" />
        )}
      </ChipRow>

      <UpNowCard
        view={view}
        vars={
          view.upNow
            ? entryVars(view.upNow.entry, subjectsById)
            : view.activityNow
              ? entryVars(view.activityNow, subjectsById)
              : tokenVars('fun')
        }
        catchUpVars={view.catchUps[0] ? entryVars(view.catchUps[0], subjectsById) : tokenVars('fun')}
        onStart={start}
        upNowName={upNowName}
      />

      {waitingEarlier > 0 && (
        <Card className="waiting" aria-labelledby="waiting-h">
          <h2 id="waiting-h">
            <span aria-hidden="true">📅</span> {waitingEarlier} lesson{waitingEarlier === 1 ? '' : 's'} from
            earlier days {waitingEarlier === 1 ? 'is' : 'are'} waiting
          </h2>
          <p className="muted">Missed a day? No worries. You can still do them from your week.</p>
          <ChunkyLink to="/week" variant="soft" arrow>
            Open my week
          </ChunkyLink>
        </Card>
      )}

      <section aria-labelledby="trail-h">
        <div className="sec-head">
          <h2 id="trail-h">Today’s trail</h2>
          <span className="muted">
            {n} lesson{n === 1 ? '' : 's'}
          </span>
        </div>
        <div className="trail-box">
          <Trail items={items} label="Today’s trail" relayoutKey={textSize} />
        </div>
      </section>

      <BottomSheet
        open={sheet !== null}
        icon={sheet?.icon ?? ''}
        title={sheet?.title ?? ''}
        body={sheet?.body}
        primary={{
          label: sheet?.primary ?? 'OK',
          onClick: () => {
            setSheet(null);
            sheet?.onPrimary?.();
          },
        }}
        secondary={
          sheet?.secondary
            ? {
                label: sheet.secondary,
                onClick: () => {
                  setSheet(null);
                  sheet.onSecondary?.();
                },
              }
            : undefined
        }
        onDismiss={() => setSheet(null)}
      />
    </Screen>
  );
}

interface UpNowProps {
  view: ReturnType<typeof buildToday>;
  vars: ColourVars;
  /** colours for the catch-up card (the waiting lesson's subject) */
  catchUpVars: ColourVars;
  upNowName?: string;
  onStart: (index: number) => void;
}

function UpNowCard({ view, vars, catchUpVars, onStart, upNowName }: UpNowProps) {
  const { upNow, activityNow, next, bedtime } = view;
  const nextLine = next && (
    <>
      <div className="kolam-rule" aria-hidden="true" />
      <p className="next">
        <span>
          Next: <span aria-hidden="true">{next.emoji}</span> {next.name} at {fmtTime(next.slot.start)}
        </span>
      </p>
    </>
  );

  if (activityNow && !upNow?.isNow) {
    return (
      <Card className="upnow" style={vars} aria-labelledby="upnow-h">
        <div className="upnow-head">
          <div className="subj-badge is-activity" aria-hidden="true">
            {activityNow.emoji}
          </div>
          <div>
            <p className="eyebrow">Right now · {fmtRange(activityNow.slot)}</p>
            <h2 className="upnow-title" id="upnow-h">
              Enjoy {activityNow.name}! {activityNow.emoji}
            </h2>
            {upNow && <p className="upnow-sub">Your next lesson is at {fmtTime(upNow.entry.slot.start)}.</p>}
          </div>
        </div>
        {upNow && (
          <ChunkyButton variant="soft" arrow onClick={() => onStart(upNow.entry.index)}>
            Start {upNowName} early
          </ChunkyButton>
        )}
      </Card>
    );
  }

  const waiting = view.catchUps[0];
  if (waiting && !upNow?.isNow) {
    return (
      <Card className="upnow" style={catchUpVars} aria-labelledby="upnow-h">
        <div className="upnow-head">
          <div className="subj-badge" aria-hidden="true">
            {waiting.emoji}
          </div>
          <div>
            <p className="eyebrow">Catch up · {fmtRange(waiting.slot)}</p>
            <h2 className="upnow-title" id="upnow-h">
              {waiting.name}
            </h2>
            <p className="upnow-sub">This one’s waiting for you 🙂 Want to do it now?</p>
          </div>
        </div>
        <ChunkyButton arrow onClick={() => onStart(waiting.index)}>
          Start {waiting.name}
        </ChunkyButton>
        {upNow && (
          <>
            <div className="kolam-rule" aria-hidden="true" />
            <p className="next">
              <span>
                Next: <span aria-hidden="true">{upNow.entry.emoji}</span> {upNow.entry.name} at{' '}
                {fmtTime(upNow.entry.slot.start)}
              </span>
            </p>
          </>
        )}
      </Card>
    );
  }

  if (!upNow) {
    return (
      <Card className="upnow" style={vars} aria-labelledby="upnow-h">
        <div className="upnow-head">
          <div className="subj-badge is-activity" aria-hidden="true">
            🎉
          </div>
          <div>
            <p className="eyebrow">Today</p>
            <h2 className="upnow-title" id="upnow-h">
              All done for today!
            </h2>
            <p className="upnow-sub">Sleep time is at {fmtTime(bedtime)}. Your stars are safe.</p>
          </div>
        </div>
      </Card>
    );
  }

  const { entry, isNow } = upNow;
  const detail =
    entry.slot.focus ?? (entry.slot.subjects ? `${entry.slot.subjects.length} subjects` : undefined);
  return (
    <Card className="upnow" style={vars} aria-labelledby="upnow-h">
      <div className="upnow-head">
        <div className="subj-badge" aria-hidden="true">
          {entry.emoji}
        </div>
        <div>
          <p className="eyebrow">
            {isNow ? 'Up now' : 'Coming up'} · {fmtRange(entry.slot)}
          </p>
          <h2 className="upnow-title" id="upnow-h">
            {entry.name}
          </h2>
          <p className="upnow-sub">
            {detail ? `${detail[0]?.toUpperCase()}${detail.slice(1)} · ` : ''}
            {slotMinutes(entry.slot)} min
          </p>
        </div>
      </div>
      <ChunkyButton arrow onClick={() => onStart(entry.index)}>
        Start {entry.name}
      </ChunkyButton>
      {nextLine}
    </Card>
  );
}
