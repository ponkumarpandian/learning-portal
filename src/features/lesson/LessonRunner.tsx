/**
 * One lesson, step by step (SPEC §5.3, §6, §7.7, §10): owns the flow position, autosaves after every
 * step and every answer, records attempts, gives the stars and logs the slot as done at the end.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Caterpillar } from '@/components/Caterpillar';
import { ChunkyButton, ChunkyLink } from '@/components/ChunkyButton';
import { Card } from '@/components/Card';
import { FocusHeader } from '@/components/FocusHeader';
import { Tara } from '@/components/Tara';
import { subjectVars } from '@/components/colours';
import { Screen } from '@/components/layout/Screen';
import {
  STUDY_KINDS,
  approvedChapters,
  type ContentBundle,
  type Lesson,
  type Question,
  type Slot,
  type Subject,
  type VideoRef,
} from '@/content';
import { addAttempt, addStars, saveLessonProgress, setSlotStatus, type AttemptSource } from '@/db/repos';
import { zonedParts } from '@/engine/clock';
import { AskQuestion, CorrectionReport, type AskOutcome } from '@/features/questions';
import { LessonVideo, VIDEO_UNAVAILABLE } from '@/features/video';
import { useClock } from '@/state/clock';
import { useBundle } from '@/state/content';
import { useMascotName } from '@/state/settingsStore';
import { catchUpFrom, fmtRange, fmtTime } from '../today/todayModel';
import {
  EYE_BREAK_SEC,
  answerHomework,
  canGoBack,
  canGoNext,
  caterpillarFor,
  checkScore,
  completesLesson,
  currentQuestion,
  eyeBreakDue,
  freshEyes,
  goBack,
  goNext,
  lessonAfter,
  planFlow,
  recordAnswer,
  rewatchFor,
  skippedEyeBreak,
  starsFor,
  stepComplete,
  tickEyes,
  tookEyeBreak,
  type EyeState,
  type FlowPlan,
  type LessonData,
  type Position,
  type Rewatch,
  type StepId,
} from './lessonFlow';
import {
  HomeworkAsk,
  HomeworkTimer,
  KeyRules,
  LearnStep,
  NotebookStep,
  Note,
  QuestionsRecap,
  ScoreCard,
  StarsCard,
  StepHead,
  StepNav,
  WarmupStep,
  type StepNavProps,
} from './steps';

export interface LessonRunnerProps {
  lesson: Lesson;
  subject: Subject;
  slot: Slot;
  slotIndex: number;
  date: string;
  /** a slot from an earlier day (catch-up from the Week view) */
  past?: boolean;
  initial: Position;
  lastDone?: Lesson;
}

/** What the Next button says, by the step it opens. */
const NEXT_LABEL: Record<StepId, string> = {
  homework_ask: 'Next',
  homework_timer: 'Next',
  warmup: 'Next: warm-up',
  watch: 'Next: watch the video',
  learn: 'Next: learn cards',
  try: 'Next: try it',
  notebook: 'Next: notebook task',
  check: 'Next: Lesson Check',
  feedback: 'See my score',
  stars: 'Next: my stars',
};

const similarIn = (b: Pick<ContentBundle, 'chapters'>, id: string): Question | undefined =>
  approvedChapters(b)
    .flatMap((c) => c.questionBank)
    .find((q) => q.variantOf === id);

export function LessonRunner({
  lesson,
  subject,
  slot,
  slotIndex,
  date,
  past = false,
  initial,
  lastDone,
}: LessonRunnerProps) {
  const clock = useClock();
  const bundle = useBundle();
  const mascot = useMascotName();
  const reduce = useReducedMotion();
  const vars = subjectVars(subject);

  const [pos, setPos] = useState<Position>(initial);
  const [dir, setDir] = useState<1 | -1>(1);
  const [rewatch, setRewatch] = useState<(Rewatch & { back: 'question' | 'results' }) | null>(null);
  const [similar, setSimilar] = useState<Question | null>(null);
  const nonce = useRef(0);

  const plan: FlowPlan = useMemo(
    () => planFlow({ lesson, slot, homeworkMinutes: pos.data.homeworkMinutes, lastDone }),
    [lesson, slot, pos.data.homeworkMinutes, lastDone],
  );
  const step: StepId = plan.steps[pos.stepIndex] ?? 'stars';
  const data = pos.data;
  const at = () => clock.now().getTime();

  /* ---------- autosave (in order, never blocking her) ---------- */
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const persist = useCallback(
    (next: Position, p: FlowPlan) => {
      const done = next.data.finished && completesLesson(p);
      const when = clock.now().getTime();
      saving.current = saving.current
        .then(() =>
          saveLessonProgress(
            lesson.id,
            {
              step: next.stepIndex,
              status: done ? 'done' : 'in_progress',
              data: next.data,
              ...(done ? { completedAt: when } : {}),
            },
            when,
          ),
        )
        .catch(() => undefined);
    },
    [clock, lesson.id],
  );

  const attempt = (
    source: AttemptSource,
    questionId: string,
    response: unknown,
    score: number,
    lessonId = lesson.id,
  ) => void addAttempt({ source, lessonId, questionId, response, score, at: at() }).catch(() => undefined);

  const planOf = (d: LessonData) => planFlow({ lesson, slot, homeworkMinutes: d.homeworkMinutes, lastDone });

  /** Move to a new position: finish the lesson the first time she reaches the stars. */
  const commit = (next: Position, d: 1 | -1 = 1) => {
    const prev = pos;
    const p = planOf(next.data);
    let final = next;
    if (p.steps[next.stepIndex] === 'stars' && !next.data.finished) {
      const stars = starsFor(p, next.data);
      final = { ...next, data: { ...next.data, finished: true, stars } };
      const when = at();
      void addStars(stars.total, when).catch(() => undefined);
      void setSlotStatus(date, slotIndex, 'done', when).catch(() => undefined);
    }
    if (final.stepIndex !== prev.stepIndex || final.data.cardIndex !== prev.data.cardIndex) setDir(d);
    setPos(final);
    persist(final, p);
  };

  const next = () => {
    const cur = pos;
    commit(goNext(cur, lesson, planOf(cur.data)), 1);
  };
  const back = () => {
    const cur = pos;
    commit(goBack(cur, lesson, planOf(cur.data)), -1);
  };
  const update = (patch: Partial<LessonData>) => {
    const cur = pos;
    commit({ ...cur, data: { ...cur.data, ...patch } });
  };

  /* ---------- focus the new step's heading (not on first paint: Screen focuses the h1) ---------- */
  const viewKey = `${step}-${step === 'learn' ? data.cardIndex : ''}-${rewatch ? 'rw' : ''}-${similar?.id ?? ''}`;
  const shownView = useRef(viewKey);
  useEffect(() => {
    if (shownView.current === viewKey) return;
    shownView.current = viewKey;
    const h = document.getElementById('lstep-h');
    h?.focus({ preventScroll: true });
    document
      .getElementById('lesson-top')
      ?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [viewKey, reduce]);

  /* ---------- eye breaks (§7.7): screen time only, never during offline homework ---------- */
  const eyes = useRef<EyeState>(freshEyes());
  const [eyePrompt, setEyePrompt] = useState<{ canSkip: boolean } | null>(null);
  const [resting, setResting] = useState<number | null>(null);
  const offScreen = step === 'homework_ask' || step === 'homework_timer' || step === 'notebook';
  const template = plan.template;
  useEffect(() => {
    if (offScreen || eyePrompt || resting !== null) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      eyes.current = tickEyes(eyes.current, 1);
      const due = eyeBreakDue(eyes.current, template);
      if (due) setEyePrompt(due);
    }, 1000);
    return () => window.clearInterval(id);
  }, [offScreen, eyePrompt, resting, template]);
  useEffect(() => {
    if (resting === null || resting <= 0) return;
    const id = window.setTimeout(() => setResting((s) => (s === null ? s : s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resting]);

  /* ---------- the caterpillar ---------- */
  const cat = caterpillarFor(plan.steps, step);

  /* ---------- nav ---------- */
  const nextStep = plan.steps[pos.stepIndex + 1];
  const nav = (over?: Partial<NonNullable<StepNavProps['next']>>): StepNavProps => ({
    onBack: canGoBack(pos, plan) ? back : undefined,
    next: {
      label:
        step === 'learn' && data.cardIndex < lesson.cards.length - 1
          ? 'Next card'
          : nextStep
            ? NEXT_LABEL[nextStep]
            : 'Next',
      onClick: next,
      disabled: !canGoNext(pos, lesson, plan),
      ...over,
    },
  });
  const backOnly: StepNavProps = { onBack: canGoBack(pos, plan) ? back : undefined };

  /* ---------- answers ---------- */
  const onAnswer = (kind: 'practice' | 'check') => (o: AskOutcome) => {
    const rec = { response: o.response, result: o.result, tries: o.tries, revealed: o.revealed };
    attempt(
      kind === 'check' ? 'lesson_check' : 'practice',
      o.questionId,
      o.response,
      o.result.score,
      kind === 'check' ? plan.checkLesson.id : lesson.id,
    );
    const cur = pos;
    const p = planOf(cur.data);
    const d = recordAnswer(cur.data, kind, o.questionId, rec);
    const moved: Position = { ...cur, data: d };
    commit(currentQuestion(kind, d, lesson, p) ? moved : goNext(moved, lesson, p));
  };

  const watchAgain = (ref: VideoRef | undefined, backTo: 'question' | 'results') => {
    nonce.current += 1;
    setRewatch({ ...rewatchFor(ref, nonce.current), back: backTo });
  };

  const onCheckpoint = (o: AskOutcome) => {
    attempt('checkpoint', o.questionId, o.response, o.result.score);
    const cp = pos.data.checkpoints;
    if (o.questionId in cp) return;
    update({ checkpoints: { ...cp, [o.questionId]: o.result.correct && !o.revealed } });
  };

  const onWatched = (info: { checkpointsAllCorrect: boolean }) => {
    const cur = pos.data;
    if (cur.watched && cur.checkpointsAllCorrect !== undefined) return;
    update({ watched: true, checkpointsAllCorrect: cur.checkpointsAllCorrect ?? info.checkpointsAllCorrect });
  };

  const onUnavailable = () => {
    const cur = pos;
    if (cur.data.unavailable) return;
    const p = planOf(cur.data);
    const moved = { ...cur, data: { ...cur.data, unavailable: true } };
    commit(p.steps[cur.stepIndex] === 'watch' ? goNext(moved, lesson, p) : moved);
  };

  /* ---------- the step body ---------- */
  const unavailableNote =
    data.unavailable && plan.steps[pos.stepIndex - 1] === 'watch' ? (
      <Note emoji="🃏">
        {step === 'learn'
          ? VIDEO_UNAVAILABLE
          : 'Video not available right now — let’s go to the questions! ✅'}
      </Note>
    ) : null;

  let body: ReactNode = null;
  switch (step) {
    case 'homework_ask':
      body = (
        <HomeworkAsk
          subject={subject}
          chosen={data.homeworkMinutes}
          onChoose={(m) => commit(answerHomework(pos.data, m, { lesson, slot, lastDone }))}
        />
      );
      break;
    case 'homework_timer':
      body = <HomeworkTimer minutes={data.homeworkMinutes ?? 0} onDone={next} onBack={back} />;
      break;
    case 'warmup':
      body = (
        <WarmupStep
          cards={lesson.warmup ?? []}
          results={data.flashcards}
          onRate={(knew) => {
            const cards = pos.data.flashcards;
            attempt('warmup', `${lesson.id}-warmup-${cards.length + 1}`, { knew }, knew ? 1 : 0);
            update({ flashcards: [...cards, knew] });
          }}
          nav={nav()}
        />
      );
      break;
    case 'watch': {
      const ready = stepComplete('watch', data, lesson, plan) || pos.stepIndex < data.furthest;
      body = (
        <div className="lstep">
          <StepHead
            emoji="🎬"
            title="Watch"
            sub={data.unavailable ? undefined : 'Watch and answer the ⭐ questions inside the video.'}
          />
          <LessonVideo
            lesson={lesson}
            subjectId={subject.id}
            onWatched={onWatched}
            onUnavailable={onUnavailable}
            onCheckpointOutcome={onCheckpoint}
            endAction={nextStep ? { label: NEXT_LABEL[nextStep], onClick: next } : undefined}
          />
          <StepNav {...nav({ disabled: !ready, hint: 'Watch to the end to unlock Next ⭐' })} />
        </div>
      );
      break;
    }
    case 'learn': {
      const card = lesson.cards[data.cardIndex] ?? lesson.cards[0]!;
      body = (
        <LearnStep
          key={data.cardIndex}
          card={card}
          index={data.cardIndex}
          count={lesson.cards.length}
          note={data.cardIndex === 0 ? unavailableNote : null}
          nav={nav()}
        />
      );
      break;
    }
    case 'try':
    case 'check': {
      const kind = step === 'try' ? 'practice' : 'check';
      const qs = kind === 'practice' ? lesson.practice : plan.checkQuestions;
      const results = kind === 'practice' ? data.practiceResults : data.checkResults;
      const q = currentQuestion(kind, data, lesson, plan);
      const n = qs.filter((x) => results[x.id] !== undefined).length;
      body = (
        <div className="lstep">
          {step === 'check' && unavailableNote}
          <StepHead
            emoji={step === 'try' ? '✋' : '✅'}
            title={step === 'try' ? 'Try it' : 'Lesson Check'}
            sub={
              q
                ? step === 'try'
                  ? 'Have a go — clues are here if you need them 💡'
                  : 'No clues this time — you’ve got this! 💪'
                : undefined
            }
            count={q ? { at: n + 1, of: qs.length } : undefined}
          />
          {q ? (
            <>
              <AskQuestion
                question={q}
                mode={kind}
                subjectId={subject.id}
                onDone={onAnswer(kind)}
                onWatchAgain={
                  kind === 'practice' && !data.unavailable
                    ? () => watchAgain(q.videoRef, 'question')
                    : undefined
                }
              />
              <StepNav {...backOnly} />
            </>
          ) : (
            <QuestionsRecap
              questions={qs}
              results={results}
              what={kind === 'practice' ? 'practice questions' : 'check questions'}
              nav={nav()}
            />
          )}
        </div>
      );
      break;
    }
    case 'notebook':
      body = <NotebookStep task={lesson.notebook} nav={nav({ label: 'Done ✅' })} />;
      break;
    case 'feedback': {
      const score = checkScore(plan, data);
      const items = plan.checkQuestions.flatMap((cq) => {
        const r = data.checkResults[cq.id];
        return r ? [{ question: cq, result: r.result }] : [];
      });
      body = (
        <div className="lstep">
          <StepHead emoji="🎉" title="Your Lesson Check" />
          <ScoreCard score={score} mascot={mascot} />
          <CorrectionReport
            items={items}
            onWatch={data.unavailable ? undefined : (ref) => watchAgain(ref, 'results')}
            onTrySimilar={(cq) => {
              const v = similarIn(bundle, cq.id);
              if (v) setSimilar(v);
            }}
            hasSimilar={(cq) => similarIn(bundle, cq.id) !== undefined}
          />
          <StepNav {...nav()} />
        </div>
      );
      break;
    }
    case 'stars':
      body = (
        <StarsStep
          lesson={lesson}
          stars={data.stars ?? starsFor(plan, data)}
          upNext={upNextLine(bundle, subject, lesson, date, slotIndex, clock.now())}
          finishedLesson={completesLesson(plan)}
          onBack={canGoBack(pos, plan) ? back : undefined}
        />
      );
      break;
  }

  const stepKey = `${step}-${step === 'learn' ? data.cardIndex : ''}`;
  const overlay = rewatch ? (
    <div className="lstep">
      <StepHead emoji="▶️" title="Watch that bit again" sub="Then come back — it’ll click!" />
      <LessonVideo
        lesson={lesson}
        subjectId={subject.id}
        which={rewatch.which}
        seekTo={rewatch.seekTo}
        onWatched={onWatched}
        onUnavailable={() => setRewatch(null)}
        onCheckpointOutcome={onCheckpoint}
      />
      <div className="lnav">
        <ChunkyButton onClick={() => setRewatch(null)}>
          {rewatch.back === 'question' ? 'Back to my question ↩' : 'Back to my results ↩'}
        </ChunkyButton>
      </div>
    </div>
  ) : similar ? (
    <div className="lstep">
      <StepHead emoji="🔁" title="Try a similar one" sub="Same idea, new question. Clues are here 💡" />
      <AskQuestion
        question={similar}
        mode="practice"
        subjectId={subject.id}
        onDone={(o) => {
          attempt('practice', o.questionId, o.response, o.result.score);
          setSimilar(null);
        }}
      />
      <div className="lnav">
        <ChunkyButton variant="soft" onClick={() => setSimilar(null)}>
          Back to my results ↩
        </ChunkyButton>
      </div>
    </div>
  ) : null;

  return (
    <Screen labelledBy="lesson-h" className="lesson">
      <div id="lesson-top" className="lesson-top" style={vars}>
        <FocusHeader
          eyebrow={`${subject.emoji} ${subject.name} · ${past ? catchUpFrom(date) : fmtRange(slot)}`}
          title={lesson.title}
          titleId="lesson-h"
        />
        {cat.steps.length > 1 && <Caterpillar steps={cat.steps} current={cat.current} vars={vars} />}
      </div>

      <div style={vars}>
        {overlay}
        <motion.div
          key={stepKey}
          hidden={overlay !== null}
          initial={reduce ? false : { opacity: 0, x: dir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {body}
        </motion.div>
      </div>

      <BottomSheet
        open={eyePrompt !== null && resting === null}
        icon="👀"
        title="Eye break time!"
        body="Look at something far away for 20 seconds 👀"
        primary={{ label: 'Start my eye break', onClick: () => setResting(EYE_BREAK_SEC) }}
        secondary={
          eyePrompt?.canSkip
            ? {
                label: 'Skip this time',
                onClick: () => {
                  eyes.current = skippedEyeBreak(eyes.current, template);
                  setEyePrompt(null);
                },
              }
            : undefined
        }
        onDismiss={() => setResting(EYE_BREAK_SEC)}
      />
      <BottomSheet
        open={resting !== null}
        icon={<Tara size="fill" label={null} />}
        title={resting ? 'Look far away… 🌳' : 'Lovely! Fresh eyes ✨'}
        body={
          resting
            ? `${resting} second${resting === 1 ? '' : 's'} to go. Blink slowly, too.`
            : 'Ready to keep going?'
        }
        primary={{
          label: 'Back to my lesson',
          onClick: () => {
            eyes.current = tookEyeBreak(eyes.current, template);
            setResting(null);
            setEyePrompt(null);
          },
        }}
      />
    </Screen>
  );
}

/* ---------- §6.8 key rules + stars + up next ---------- */

function upNextLine(
  b: ContentBundle,
  subject: Subject,
  lesson: Lesson,
  date: string,
  slotIndex: number,
  now: Date,
): string[] {
  const weekday = zonedParts(now).weekday;
  const today = zonedParts(now).dateKey === date ? (b.timetable.days[weekday] ?? []) : [];
  const later = today.find((s, i) => i > slotIndex && STUDY_KINDS.includes(s.kind));
  const lines: string[] = [];
  if (later) {
    const id = later.subject ?? later.subjects?.[0];
    const s = id ? b.subjects.find((x) => x.id === id) : undefined;
    lines.push(
      `Up next today: ${s ? `${s.emoji} ${s.name}` : (later.label ?? 'your next lesson')} at ${fmtTime(later.start)}`,
    );
  }
  const after = lessonAfter(b, subject.id, lesson.id);
  if (after) lines.push(`Next time in ${subject.name}: ${after.title}`);
  if (!lines.length) lines.push('That’s all for today — enjoy your evening! 🌙');
  return lines;
}

function StarsStep({
  lesson,
  stars,
  upNext,
  finishedLesson,
  onBack,
}: {
  lesson: Lesson;
  stars: ReturnType<typeof starsFor>;
  upNext: string[];
  finishedLesson: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="lstep">
      <StepHead emoji="⭐" title={finishedLesson ? 'Lesson complete!' : 'Great work today!'} />
      <StarsCard stars={stars} />
      <KeyRules rules={lesson.keyRules} />
      <Card className="upnext" aria-label="Up next">
        {upNext.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </Card>
      <div className="lnav">
        <ChunkyLink to="/" arrow>
          Back to my trail
        </ChunkyLink>
        {onBack && (
          <ChunkyButton variant="soft" onClick={onBack}>
            <span aria-hidden="true">◀</span> Back
          </ChunkyButton>
        )}
      </div>
    </div>
  );
}
