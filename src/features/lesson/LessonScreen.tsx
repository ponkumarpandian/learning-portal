/**
 * /lesson/:date/:slot (SPEC §5.2, §6): resolves the timetable slot, picks (or resumes) its lesson and
 * hands it to the LessonRunner. Other days, not-yet-built slot kinds and an empty queue get a
 * friendly Tara message with "Back to my trail" — never a dead end.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ChunkyLink } from '@/components/ChunkyButton';
import { EmptyState } from '@/components/EmptyState';
import { FocusHeader } from '@/components/FocusHeader';
import { Tara } from '@/components/Tara';
import { subjectVars, tokenVars } from '@/components/colours';
import { Screen } from '@/components/layout/Screen';
import { listLessonProgress } from '@/db/repos';
import { fromWallTime, zonedParts } from '@/engine/clock';
import { useClock } from '@/state/clock';
import { useBundle } from '@/state/content';
import { catchUpFrom, fmtRange, fmtTime, weekdayName } from '../today/todayModel';
import { LessonRunner } from './LessonRunner';
import {
  pickLesson,
  planFlow,
  resolveSlot,
  restoreData,
  resumeIndex,
  type PickedLesson,
  type Position,
} from './lessonFlow';
import './lesson.css';

const back = (
  <ChunkyLink to="/" arrow>
    Back to my trail
  </ChunkyLink>
);

function Message({
  eyebrow,
  title,
  line,
  mood = 'happy',
}: {
  eyebrow: string;
  title: string;
  line: string;
  mood?: 'happy' | 'cheer' | 'sleepy';
}) {
  return (
    <Screen labelledBy="lesson-h">
      <FocusHeader eyebrow={eyebrow} title="Your lesson" titleId="lesson-h" />
      <EmptyState title={title} body={line} mood={mood} action={back} />
    </Screen>
  );
}

export function LessonScreen() {
  const { date = '', slot = '' } = useParams();
  const clock = useClock();
  const bundle = useBundle();
  const today = zonedParts(clock.now()).dateKey;
  const res = useMemo(() => resolveSlot(bundle, date, slot, today), [bundle, date, slot, today]);

  if (res.kind === 'invalid') {
    return (
      <Message
        eyebrow="⭐ Lesson"
        title="This stone isn’t on your trail 🙂"
        line="Let’s go back and pick one from today’s trail."
      />
    );
  }
  const name = res.subject?.name ?? res.slot.label ?? 'Your lesson';
  const eyebrow = `${res.subject?.emoji ?? res.slot.emoji ?? '⭐'} ${name} · ${fmtRange(res.slot)}`;

  if (res.kind === 'other_day') {
    const day = weekdayName(zonedParts(fromWallTime(date, '12:00')).weekday);
    return (
      <Message
        eyebrow={eyebrow}
        title="This one’s for another day 🙂"
        line={`${name} opens on ${day} at ${fmtTime(res.slot.start)}. Today’s trail has stones waiting for you!`}
      />
    );
  }
  if (res.kind === 'coming_soon') {
    return (
      <Message
        eyebrow={eyebrow}
        title="Coming in the next part of your adventure 🛠️"
        line="This kind of session opens soon. Your lessons are ready on today’s trail!"
        mood="cheer"
      />
    );
  }
  return <LessonLoader key={res.slotKey} {...res} date={date} />;
}

type Ready = { picked: PickedLesson; initial: Position } | { picked: undefined };

function LessonLoader({
  slot,
  subject,
  slotIndex,
  slotKey,
  past,
  date,
}: Extract<ReturnType<typeof resolveSlot>, { kind: 'lesson' }> & { date: string }) {
  const bundle = useBundle();
  const [ready, setReady] = useState<Ready | null>(null);

  useEffect(() => {
    let live = true;
    listLessonProgress()
      .catch(() => [])
      .then((progress) => {
        if (!live) return;
        const picked = pickLesson(bundle, subject.id, slotKey, progress);
        if (!picked) return setReady({ picked: undefined });
        const data = restoreData(picked.resume?.data, slotKey);
        const plan = planFlow({
          lesson: picked.lesson,
          slot,
          homeworkMinutes: data.homeworkMinutes,
          lastDone: picked.lastDone,
        });
        const stepIndex = picked.resume ? resumeIndex(plan, data, picked.resume.step) : 0;
        setReady({
          picked,
          initial: {
            stepIndex,
            data: { ...data, stepId: plan.steps[stepIndex], furthest: Math.max(data.furthest, stepIndex) },
          },
        });
      });
    return () => {
      live = false;
    };
  }, [bundle, subject.id, slotKey, slot]);

  const eyebrow = `${subject.emoji} ${subject.name} · ${past ? catchUpFrom(date) : fmtRange(slot)}`;
  if (!ready) {
    return (
      <Screen labelledBy="lesson-h">
        <div style={subjectVars(subject)}>
          <FocusHeader eyebrow={eyebrow} title="Getting your lesson ready…" titleId="lesson-h" />
        </div>
        <div className="lloading" role="status">
          <Tara size="small" label={null} />
          <p className="muted">Getting your lesson ready…</p>
        </div>
      </Screen>
    );
  }
  if (!ready.picked) {
    return (
      <Screen labelledBy="lesson-h">
        <div style={tokenVars('fun')}>
          <FocusHeader eyebrow={eyebrow} title={subject.name} titleId="lesson-h" />
        </div>
        <EmptyState
          title={`No new ${subject.name} lessons are ready yet — ask a grown-up to add the next chapter 📚`}
          mood="cheer"
          action={back}
        />
      </Screen>
    );
  }
  const { picked, initial } = ready;
  return (
    <LessonRunner
      lesson={picked.lesson}
      subject={subject}
      slot={slot}
      slotIndex={slotIndex}
      date={date}
      past={past}
      initial={initial}
      lastDone={picked.lastDone}
    />
  );
}
