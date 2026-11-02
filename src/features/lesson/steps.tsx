/**
 * The full-screen step cards of a lesson (SPEC §5.3, §6). Each one is presentational: the runner
 * (LessonRunner.tsx) owns the state, the autosave and the moves between steps.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Card } from '@/components/Card';
import { ChunkyButton } from '@/components/ChunkyButton';
import { ProgressBar } from '@/components/ProgressBar';
import { ProgressRing } from '@/components/ProgressRing';
import { TaraSays } from '@/components/SpeechBubble';
import type { Flashcard, LearnCard, Question, Subject } from '@/content';
import { mediaUrl } from '@/features/questions';
import { HOMEWORK_CHOICES, type CheckScore, type QuestionRecord, type StarBreakdown } from './lessonFlow';
import { Confetti } from './Confetti';

/* ---------- shared bits ---------- */

export interface StepHeadProps {
  emoji: string;
  title: string;
  sub?: ReactNode;
  /** "2 of 6" dots */
  count?: { at: number; of: number };
}

/** The step's h2 (focused when the step changes) with an optional "n of m" row of dots. */
export function StepHead({ emoji, title, sub, count }: StepHeadProps) {
  return (
    <div className="lstep-head">
      <h2 id="lstep-h" className="lstep-h" tabIndex={-1}>
        <span className="lstep-emoji" aria-hidden="true">
          {emoji}
        </span>{' '}
        {title}
      </h2>
      {count && count.of > 1 && (
        <p className="lstep-count">
          <span className="sr-only">
            {count.at} of {count.of}
          </span>
          <span className="ldots" aria-hidden="true">
            {Array.from({ length: count.of }, (_, i) => (
              <i key={i} className={i < count.at - 1 ? 'is-done' : i === count.at - 1 ? 'is-now' : ''} />
            ))}
          </span>
          <span aria-hidden="true">
            {count.at} of {count.of}
          </span>
        </p>
      )}
      {sub && <p className="lstep-sub">{sub}</p>}
    </div>
  );
}

export interface StepNavProps {
  onBack?: () => void;
  next?: { label: string; onClick: () => void; disabled?: boolean; hint?: string };
}

/** Back (soft, small) + the one big Next. */
export function StepNav({ onBack, next }: StepNavProps) {
  if (!onBack && !next) return null;
  return (
    <div className="lnav">
      {next?.disabled && next.hint && <p className="lnav-hint">{next.hint}</p>}
      <div className={`lnav-row${onBack ? '' : ' is-single'}`}>
        {onBack && (
          <ChunkyButton variant="soft" className="lnav-back" onClick={onBack}>
            <span aria-hidden="true">◀</span> Back
          </ChunkyButton>
        )}
        {next && (
          <ChunkyButton arrow onClick={next.onClick} disabled={next.disabled}>
            {next.label}
          </ChunkyButton>
        )}
      </div>
    </div>
  );
}

/** A friendly one-line note card ("Video not available right now…"). */
export function Note({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <p className="lnote" role="status">
      <span aria-hidden="true">{emoji}</span> {children}
    </p>
  );
}

/* ---------- §5.3 homework first ---------- */

export function HomeworkAsk({
  subject,
  chosen,
  onChoose,
}: {
  subject: Subject;
  chosen?: number;
  onChoose: (minutes: number) => void;
}) {
  return (
    <div className="lstep">
      <StepHead emoji="📒" title={`Do you have school homework for ${subject.name} today?`} />
      <p className="lstep-lead">Homework comes first, in your notebook. Then we’ll learn something new!</p>
      <div className="hw-choices" role="group" aria-labelledby="lstep-h">
        {HOMEWORK_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            className={`hw-choice${chosen === m ? ' is-on' : ''}`}
            aria-pressed={chosen === m}
            onClick={() => onChoose(m)}
          >
            <span className="hw-emoji" aria-hidden="true">
              {m === 0 ? '🎉' : m === 15 ? '🌱' : m === 30 ? '🌿' : '🌳'}
            </span>
            <span className="hw-label">{m === 0 ? 'No homework' : `${m} min`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function HomeworkTimer({
  minutes,
  onDone,
  onBack,
}: {
  minutes: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const total = minutes * 60;
  const mins = Math.floor(seconds / 60);
  const over = seconds >= total;
  return (
    <div className="lstep">
      <StepHead emoji="✏️" title="Homework time" />
      <TaraSays small>
        <p>
          {over
            ? 'Take your time — tap the big button when you’re done 🙂'
            : 'Do your homework in your notebook. I’ll wait right here! 🐘'}
        </p>
      </TaraSays>
      <Card className="hw-timer">
        <ProgressBar value={Math.min(seconds, total)} max={total} label="Homework time" big />
        <p className="hw-time">
          {over ? `${minutes} minutes — lovely focus! 🌟` : `About ${mins} of ${minutes} minutes`}
        </p>
      </Card>
      <div className="lnav">
        <ChunkyButton onClick={onDone}>I’ve finished my homework ✅</ChunkyButton>
        <ChunkyButton variant="soft" onClick={onBack}>
          Change my answer
        </ChunkyButton>
      </div>
    </div>
  );
}

/* ---------- §6.1 warm-up flashcards ---------- */

export function WarmupStep({
  cards,
  results,
  onRate,
  nav,
}: {
  cards: Flashcard[];
  results: boolean[];
  onRate: (knew: boolean) => void;
  nav: StepNavProps;
}) {
  const at = results.length;
  const card = cards[at];
  const [shown, setShown] = useState<number | null>(null);
  const revealed = shown === at;
  const knew = results.filter(Boolean).length;

  return (
    <div className="lstep">
      <StepHead
        emoji="🔥"
        title="Warm-up"
        sub={card ? 'Do you remember this one? Think first, then tap to check.' : undefined}
        count={card ? { at: at + 1, of: cards.length } : undefined}
      />
      {card ? (
        <>
          <button
            type="button"
            className={`flash${revealed ? ' is-flipped' : ''}`}
            onClick={() => setShown(at)}
            aria-expanded={revealed}
          >
            <span className="flash-front">{card.front}</span>
            {revealed ? (
              <span className="flash-back">{card.back}</span>
            ) : (
              <span className="flash-tap">Tap to see the answer 👀</span>
            )}
          </button>
          {revealed && (
            <div className="flash-rate" role="group" aria-label="Did you know it?">
              <ChunkyButton variant="soft" onClick={() => onRate(true)}>
                I knew it 👍
              </ChunkyButton>
              <ChunkyButton variant="soft" onClick={() => onRate(false)}>
                Not yet 🤔
              </ChunkyButton>
            </div>
          )}
          {nav.onBack && <StepNav onBack={nav.onBack} />}
        </>
      ) : (
        <>
          <Card className="lsummary">
            <p className="lsummary-big" aria-hidden="true">
              🔥
            </p>
            <p>
              Warm-up done! You remembered {knew} of {cards.length}.
              {knew < cards.length ? ' The video will help with the rest.' : ' Brilliant memory! 🧠'}
            </p>
          </Card>
          <StepNav {...nav} />
        </>
      )}
    </div>
  );
}

/* ---------- §6.3 learn cards ---------- */

export function LearnStep({
  card,
  index,
  count,
  note,
  nav,
}: {
  card: LearnCard;
  index: number;
  count: number;
  note?: ReactNode;
  nav: StepNavProps;
}) {
  const [revealed, setRevealed] = useState<number | null>(null);
  const img = card.image ? mediaUrl(card.image) : undefined;
  return (
    <div className="lstep">
      {note}
      <StepHead emoji="🃏" title="Learn" count={{ at: index + 1, of: count }} />
      <Card as="article" className="lcard" aria-labelledby="lcard-title">
        <div className="lcard-top">
          {card.emoji && (
            <span className="lcard-emoji" aria-hidden="true">
              {card.emoji}
            </span>
          )}
          <h3 id="lcard-title" className="lcard-title">
            {card.title}
          </h3>
        </div>
        {img && <img className="lcard-img" src={img} alt="" />}
        <p className="lcard-body">{card.body}</p>
        {card.example && (
          <div className="lcard-box is-example">
            <p className="lcard-box-h">
              <span aria-hidden="true">💡</span> For example
            </p>
            <p>{card.example}</p>
          </div>
        )}
        {card.didYouKnow && (
          <div className="lcard-box is-dyk">
            <p className="lcard-box-h">Did you know? 🤩</p>
            <p>{card.didYouKnow}</p>
          </div>
        )}
        {card.reveal &&
          (revealed === index ? (
            <div className="lcard-box is-reveal" role="status">
              <p className="lcard-box-h">
                <span aria-hidden="true">👀</span> Here it is
              </p>
              <p>{card.reveal}</p>
            </div>
          ) : (
            <button type="button" className="lcard-reveal" onClick={() => setRevealed(index)}>
              Tap to reveal <span aria-hidden="true">👀</span>
            </button>
          ))}
      </Card>
      <StepNav {...nav} />
    </div>
  );
}

/* ---------- §6.5 notebook ---------- */

export function NotebookStep({ task, nav }: { task: string; nav: StepNavProps }) {
  return (
    <div className="lstep">
      <StepHead emoji="📓" title="Notebook time!" />
      <Card className="nbook">
        <p className="nbook-art" aria-hidden="true">
          📓✏️
        </p>
        <p className="nbook-task">{task}</p>
        <div className="kolam-rule" aria-hidden="true" />
        <p className="muted">Put the screen down and use your pencil ✏️ Tap Done when you’ve finished.</p>
      </Card>
      <StepNav {...nav} />
    </div>
  );
}

/* ---------- question step recap (when she comes back to a finished step) ---------- */

export function QuestionsRecap({
  questions,
  results,
  nav,
  what,
}: {
  questions: Question[];
  results: Record<string, QuestionRecord>;
  nav: StepNavProps;
  what: string;
}) {
  return (
    <>
      <Card className="lsummary">
        <p>
          You’ve answered all {questions.length} {what} ✅
        </p>
        <ol className="recap">
          {questions.map((q) => {
            const r = results[q.id];
            const right = r?.result.correct;
            return (
              <li key={q.id} className={right ? 'is-right' : 'is-tried'}>
                <span aria-hidden="true">{right ? '⭐' : '🌱'}</span>
                <span className="recap-q">{q.prompt}</span>
                <span className="sr-only">{right ? ', spot on' : ', one to practise'}</span>
              </li>
            );
          })}
        </ol>
      </Card>
      <StepNav {...nav} />
    </>
  );
}

/* ---------- §6.7 feedback ---------- */

export function ScoreCard({ score, mascot }: { score: CheckScore; mascot?: string }) {
  const full = score.max > 0 && score.score === score.max;
  const line = full
    ? 'Yes! ⭐ Every one spot on!'
    : score.fraction >= 0.8
      ? 'Brilliant thinking! 🧠'
      : score.fraction >= 0.5
        ? `Good work! ${score.score} of ${score.max} spot on ⭐`
        : 'This one’s a growing topic 🌱 You’ll get it!';
  return (
    <>
      {full && <Confetti />}
      <TaraSays mood="cheer" small>
        <p className="score-line">{line}</p>
        {mascot && <p className="muted">{mascot} is proud of you.</p>}
      </TaraSays>
      <Card className="score">
        <ProgressRing value={score.score} max={score.max} label="Lesson Check score" size={132} stroke={16}>
          <span className="score-num">
            {score.score}
            <small>/{score.max}</small>
          </span>
        </ProgressRing>
        <p className="score-pct">{Math.round(score.fraction * 100)}%</p>
      </Card>
    </>
  );
}

/* ---------- §6.8 key rules + stars ---------- */

const STAR_ROWS: { key: keyof Omit<StarBreakdown, 'total'>; emoji: string; label: string }[] = [
  { key: 'finish', emoji: '🏁', label: 'You finished the lesson' },
  { key: 'check', emoji: '🎯', label: 'Lesson Check 80% or more' },
  { key: 'checkpoints', emoji: '🎬', label: 'Every video question right' },
];

export function StarsCard({ stars }: { stars: StarBreakdown }) {
  const reduce = useReducedMotion();
  const rows = STAR_ROWS.filter((r) => stars[r.key] > 0);
  return (
    <Card className="stars" aria-labelledby="stars-h">
      <h3 id="stars-h" className="stars-h">
        You earned {stars.total} star{stars.total === 1 ? '' : 's'}!
      </h3>
      <p className="stars-row" aria-hidden="true">
        {Array.from({ length: stars.total }, (_, i) => (
          <motion.span
            key={i}
            className="star-big"
            initial={reduce ? false : { scale: 0, rotate: -40, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.25, type: 'spring', stiffness: 380, damping: 14 }}
          >
            ⭐
          </motion.span>
        ))}
      </p>
      <ul className="stars-list">
        {rows.map((r) => (
          <li key={r.key}>
            <span aria-hidden="true">{r.emoji}</span> {r.label}
            <b>+{stars[r.key]} ⭐</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function KeyRules({ rules }: { rules: string[] }) {
  if (!rules.length) return null;
  return (
    <Card className="rules" aria-labelledby="rules-h">
      <h3 id="rules-h" className="rules-h">
        <span aria-hidden="true">📌</span> Rules to remember
      </h3>
      <ol className="rules-list">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </Card>
  );
}
