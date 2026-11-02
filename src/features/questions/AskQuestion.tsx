import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { BottomSheet, type SheetAction } from '@/components/BottomSheet';
import { ChunkyButton } from '@/components/ChunkyButton';
import { Tara } from '@/components/Tara';
import { subjectVars } from '@/components/colours';
import { getSubject, type Question } from '@/content';
import { grade, isAnswered, type GradeResult, type Response, type SelfCheckRating } from '@/engine/grading';
import { useBundle } from '@/state/content';
import { useSettings } from '@/state/settingsStore';
import { buzz, chime } from './joy';
import { QuestionView } from './QuestionView';
import { retryResponse, startResponse } from './responses';
import './questions.css';

export type AskMode = 'practice' | 'check' | 'checkpoint';

export interface AskOutcome {
  questionId: string;
  response: Response;
  result: GradeResult;
  tries: number;
  /** the answer was shown after the hint ladder */
  revealed: boolean;
}

export interface AskQuestionProps {
  question: Question;
  mode: AskMode;
  subjectId?: string;
  /** called when she taps Continue */
  onDone: (o: AskOutcome) => void;
  /** practice: 2nd not-quite; checkpoint: 1st not-quite */
  onWatchAgain?: () => void;
  /** resume */
  initialResponse?: Response;
  /** checkpoint overlay inside the video frame */
  compact?: boolean;
}

const CLUE = 'Read the question again slowly — you’ve got this!';
const FOCUSABLE =
  'input:not([disabled]):not([readonly]), textarea:not([readonly]), button:not([disabled]):not([aria-disabled="true"])';

const RATINGS: { value: SelfCheckRating; label: string; emoji: string }[] = [
  { value: 'got', label: 'Got it', emoji: '✅' },
  { value: 'partly', label: 'Partly', emoji: '🤏' },
  { value: 'missed', label: 'Missed', emoji: '❌' },
];

const isSelfCheck = (q: Question) => q.type === 'short_answer' || q.type === 'think_write';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The model answer with every keyword that appears in it highlighted. */
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  const words = keywords.map((k) => k.trim()).filter(Boolean);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(
    `(${words
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join('|')})`,
    'gi',
  );
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="kw">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** "⭐ +1" rises and fades on a correct first try. Nothing at all under reduced motion. */
function StarPop({ show, onEnd }: { show: boolean; onEnd: () => void }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show && !reduce && (
        <motion.span
          key="pop"
          className="q-starpop"
          aria-hidden="true"
          initial={{ y: 0, scale: 0.6, opacity: 0 }}
          animate={{ y: [0, -30, -110], scale: [0.6, 1.35, 1], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.3, 1], ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={onEnd}
        >
          ⭐ +1
        </motion.span>
      )}
    </AnimatePresence>
  );
}

type Phase = 'answer' | 'feedback' | 'model';

function Ask({
  question: q,
  mode,
  subjectId,
  onDone,
  onWatchAgain,
  initialResponse,
  compact,
}: AskQuestionProps) {
  const bundle = useBundle();
  const settings = useSettings((s) => s.settings);
  const [response, setResponse] = useState<Response>(() => initialResponse ?? startResponse(q));
  const [phase, setPhase] = useState<Phase>('answer');
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<GradeResult>();
  const [pop, setPop] = useState(false);
  const [pad, setPad] = useState(0);
  const rootId = useId();
  const ratingName = useId();
  const selfCheck = isSelfCheck(q);
  const style = subjectId ? subjectVars(getSubject(bundle, subjectId)) : undefined;

  const correct = result?.correct ?? false;
  const reveal =
    phase === 'feedback' &&
    !correct &&
    (mode === 'check' || (mode === 'practice' && tries >= 3) || (mode === 'checkpoint' && tries >= 2));
  const revealed = reveal && mode !== 'check';

  // Never cover the question: pad below it by the sheet's height and scroll the marks into view.
  useEffect(() => {
    if (phase !== 'feedback') return;
    const raf = requestAnimationFrame(() => {
      const sheets = document.querySelectorAll<HTMLElement>('.sheet');
      const sheet = sheets[sheets.length - 1];
      if (!sheet) return;
      setPad(sheet.offsetHeight + 24);
      const card = document.getElementById(rootId)?.querySelector('.qv');
      if (!card || compact) return;
      const r = card.getBoundingClientRect();
      const limit = window.innerHeight - sheet.offsetHeight - 16;
      if (r.bottom > limit && typeof window.scrollBy === 'function') {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({
          top: Math.min(r.bottom - limit, r.top - 16),
          behavior: reduce ? 'auto' : 'smooth',
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, tries, compact, rootId]);

  const focusQuestion = () =>
    requestAnimationFrame(() => {
      document
        .getElementById(rootId)
        ?.querySelector<HTMLElement>(`.qv ${FOCUSABLE.split(', ').join(', .qv ')}`)
        ?.focus();
    });

  const finish = (r: GradeResult, how: { revealed: boolean; tries: number }) =>
    onDone({ questionId: q.id, response, result: r, tries: how.tries, revealed: how.revealed });

  const check = (e?: FormEvent) => {
    e?.preventDefault();
    if (phase !== 'answer' || selfCheck || !isAnswered(q, response)) return;
    const r = grade(q, response);
    const n = tries + 1;
    setResult(r);
    setTries(n);
    setPhase('feedback');
    if (r.correct) {
      if (n === 1) setPop(true);
      if (settings.sound) chime();
      if (settings.vibration) buzz();
    }
  };

  const tryAgain = () => {
    setResponse((r) => retryResponse(q, r));
    setResult(undefined);
    setPad(0);
    setPhase('answer');
    focusQuestion();
  };
  const watchAgain = () => {
    tryAgain();
    onWatchAgain?.();
  };

  /* ---------- the feedback sheet (§15.2.5, Appendix E) ---------- */
  let sheet: {
    tone: 'ok' | 'hint';
    title: string;
    body?: ReactNode;
    primary: SheetAction;
    secondary?: SheetAction;
  } | null = null;
  if (phase === 'feedback' && result) {
    const cont = (rev: boolean): SheetAction => ({
      label: 'Continue',
      onClick: () => finish(result, { revealed: rev, tries }),
    });
    const answerBody = (
      <>
        <b>The answer: {result.correctAnswer}.</b> {q.explanation}
      </>
    );
    const hints = q.hints ?? [];
    if (correct) {
      sheet = {
        tone: 'ok',
        title: tries === 1 ? 'Yes! ⭐ Spot on!' : 'Yes! ⭐ You worked it out!',
        body: q.explanation,
        primary: cont(false),
      };
    } else if (reveal) {
      sheet = {
        tone: 'hint',
        title:
          mode === 'check'
            ? 'Not quite — here’s how to get it next time 💡'
            : 'Let’s fix this one together 🛠️',
        body: answerBody,
        primary: cont(revealed),
      };
    } else if (mode === 'checkpoint') {
      sheet = {
        tone: 'hint',
        title: 'Almost! Here’s a clue 💡',
        body: hints[0] ?? CLUE,
        primary: { label: 'Try again', onClick: tryAgain },
        secondary: onWatchAgain ? { label: 'Watch that part again ▶️', onClick: watchAgain } : undefined,
      };
    } else if (tries === 1) {
      sheet = {
        tone: 'hint',
        title: 'Almost! Here’s a clue 💡',
        body: hints[0] ?? CLUE,
        primary: { label: 'Try again', onClick: tryAgain },
      };
    } else {
      sheet = onWatchAgain
        ? {
            tone: 'hint',
            title: 'Let’s watch that part again — it’ll click! ▶️',
            body: hints[1] ?? 'Then come back and have another go.',
            primary: { label: 'Try again', onClick: tryAgain },
            secondary: { label: 'Watch this bit again ▶️', onClick: watchAgain },
          }
        : {
            tone: 'hint',
            title: 'Almost! Here’s another clue 💡',
            body: hints[1] ?? hints[0] ?? CLUE,
            primary: { label: 'Try again', onClick: tryAgain },
          };
    }
  }

  /* ---------- self-check (short_answer, think_write) ---------- */
  const sc = response.type === 'self_check' ? response : undefined;
  const wrote = !!sc?.text.trim();
  const rating = sc?.rating;
  const keywords = q.keywords ?? [];
  const used = (k: string) => !!sc?.text.toLowerCase().includes(k.trim().toLowerCase());

  return (
    <div
      id={rootId}
      className={`ask${compact ? ' is-compact' : ''}`}
      style={{ ...style, paddingBottom: pad || undefined }}
      data-mode={mode}
    >
      <form className="ask-form" onSubmit={check} noValidate>
        <div className="ask-card">
          <QuestionView
            question={q}
            response={response}
            onChange={setResponse}
            locked={phase !== 'answer'}
            result={result}
            reveal={reveal}
          />
        </div>

        {selfCheck && phase === 'model' && (
          <section className="ask-card model" aria-labelledby={`${ratingName}-h`}>
            <h3 id={`${ratingName}-h`} className="model-h">
              <span aria-hidden="true">📖</span> Model answer
            </h3>
            <p className="model-text">
              <Highlighted text={q.modelAnswer ?? ''} keywords={keywords} />
            </p>
            {keywords.length > 0 && (
              <>
                <p className="model-sub">Words to look for:</p>
                <ul className="kw-list">
                  {keywords.map((k) => (
                    <li key={k} className={`kw-chip${used(k) ? ' is-used' : ''}`}>
                      {used(k) && <span aria-hidden="true">✓ </span>}
                      {k}
                      {used(k) && <span className="sr-only"> (you used this)</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="kolam-rule" />
            <fieldset className="rate">
              <legend className="model-h">How did you do?</legend>
              <div className="rate-row">
                {RATINGS.map((o) => (
                  <label key={o.value} className={`rate-opt${rating === o.value ? ' is-on' : ''}`}>
                    <input
                      className="sr-only"
                      type="radio"
                      name={ratingName}
                      value={o.value}
                      checked={rating === o.value}
                      onChange={() =>
                        sc && setResponse({ type: 'self_check', text: sc.text, rating: o.value })
                      }
                    />
                    <span className="rate-emoji" aria-hidden="true">
                      {o.emoji}
                    </span>
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        <div className="ask-action" style={{ visibility: phase === 'feedback' ? 'hidden' : undefined }}>
          <StarPop show={pop} onEnd={() => setPop(false)} />
          {!selfCheck && (
            <ChunkyButton type="submit" disabled={!isAnswered(q, response)}>
              Check my answer
            </ChunkyButton>
          )}
          {selfCheck && phase === 'answer' && (
            <ChunkyButton type="button" disabled={!wrote} onClick={() => setPhase('model')}>
              Show the model answer <span aria-hidden="true">📖</span>
            </ChunkyButton>
          )}
          {selfCheck && phase === 'model' && (
            <ChunkyButton
              type="button"
              disabled={!rating}
              onClick={() => finish(grade(q, response), { revealed: false, tries: 1 })}
            >
              Continue
            </ChunkyButton>
          )}
        </div>
      </form>

      <BottomSheet
        open={sheet !== null}
        tone={sheet?.tone ?? 'ok'}
        icon={sheet?.tone === 'hint' ? <Tara size="fill" label={null} /> : '⭐'}
        title={sheet?.title ?? ''}
        body={sheet?.body}
        primary={sheet?.primary ?? { label: 'Continue', onClick: () => undefined }}
        secondary={sheet?.secondary}
      />
    </div>
  );
}

/**
 * One question with its whole feedback flow (§6 step 4, §7.3, §15.2.5, Appendix E):
 *  practice   – clue → watch again / next clue → worked answer, never stuck
 *  checkpoint – clue + "Watch that part again" → answer + Continue
 *  check      – one try, then the answer and explanation
 *  self-check – write → model answer → Got it / Partly / Missed
 * Re-keyed per question, so a new question always starts fresh.
 */
export function AskQuestion(props: AskQuestionProps) {
  return <Ask key={props.question.id} {...props} />;
}
