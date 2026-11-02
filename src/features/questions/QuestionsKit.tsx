import { useState } from 'react';
import {
  approvedChapters,
  QUESTION_TYPES,
  type ContentBundle,
  type Question,
  type QuestionType,
} from '@/content';
import { emptyResponse, grade, type Response } from '@/engine/grading';
import { useBundle } from '@/state/content';
import { AskQuestion, type AskMode, type AskOutcome } from './AskQuestion';
import { CorrectionReport, type CorrectionItem } from './CorrectionReport';
import './questions.css';

/** Prefer these real questions where they exist (the label_diagram from Fig. 3.9, etc.). */
const PREFERRED: Partial<Record<QuestionType, string>> = {
  label_diagram: 'che-matter-1-p3',
  mcq: 'che-matter-1-p4',
  match: 'che-matter-1-q5',
  order: 'che-matter-2-q4',
};

const MODES: Partial<Record<QuestionType, AskMode>> = { true_false: 'check', fill_blank: 'checkpoint' };

interface Sample {
  type: QuestionType;
  question: Question | undefined;
  subjectId: string;
}

function samples(b: ContentBundle): Sample[] {
  const pool = approvedChapters(b).flatMap((c) =>
    [...c.lessons.flatMap((l) => [...l.practice, ...l.check]), ...c.questionBank].map((q) => ({
      q,
      subject: c.subject,
    })),
  );
  return QUESTION_TYPES.map((type) => {
    const hit =
      pool.find((x) => x.q.id === PREFERRED[type]) ??
      pool.find((x) => x.q.type === type && x.subject === 'chemistry') ??
      pool.find((x) => x.q.type === type);
    return { type, question: hit?.q, subjectId: hit?.subject ?? 'chemistry' };
  });
}

/** A not-quite response for the correction-report sample (built from the question itself). */
function notQuite(q: Question): Response {
  switch (q.type) {
    case 'mcq':
      return { type: 'mcq', choice: q.options?.find((o) => o !== q.answer) ?? '' };
    case 'fill_blank':
      return { type: 'fill_blank', text: 'not sure' };
    case 'match': {
      const pairs = q.pairs ?? [];
      return {
        type: 'match',
        // swap the first two answers: partly right
        pairs: Object.fromEntries(pairs.map(([l, r], i) => [l, i < 2 ? (pairs[1 - i]?.[1] ?? r) : r])),
      };
    }
    default:
      return emptyResponse(q);
  }
}

function KitAsk({ sample }: { sample: Sample }) {
  const [round, setRound] = useState(0);
  const [log, setLog] = useState<string>('');
  const [watched, setWatched] = useState(0);
  const q = sample.question;
  if (!q) {
    return <p className="muted">No {sample.type} question in /content yet.</p>;
  }
  const mode = MODES[sample.type] ?? 'practice';
  const done = (o: AskOutcome) => {
    setLog(
      `onDone → score ${o.result.score}, tries ${o.tries}${o.revealed ? ', revealed' : ''}` +
        (watched ? ` · watch-again ×${watched}` : ''),
    );
    setRound((r) => r + 1);
  };
  return (
    <div className="kit-q">
      <p className="eyebrow">
        {sample.type} · {mode} · <code>{q.id}</code>
      </p>
      <AskQuestion
        key={round}
        question={q}
        mode={mode}
        subjectId={sample.subjectId}
        compact={mode === 'checkpoint'}
        onDone={done}
        onWatchAgain={() => setWatched((n) => n + 1)}
      />
      {log && <p className="muted">{log}</p>}
    </div>
  );
}

/**
 * Dev /kit gallery section for the question UI: one AskQuestion per question type, all picked from
 * the real content bundle, plus a correction report built from not-quite answers to real questions.
 * (Mounted inside KitScreen by the integrator.)
 */
export function QuestionsKit() {
  const bundle = useBundle();
  const list = samples(bundle);
  const report: CorrectionItem[] = list
    .filter((s) => s.question && ['mcq', 'fill_blank', 'match'].includes(s.type))
    .map((s) => ({ question: s.question!, result: grade(s.question!, notQuite(s.question!)) }));

  return (
    <section className="kit-questions" aria-labelledby="kit-questions-h">
      <h2 id="kit-questions-h">Questions</h2>
      {list.map((s) => (
        <KitAsk key={s.type} sample={s} />
      ))}
      <CorrectionReport
        items={report}
        headingLevel={3}
        onWatch={() => undefined}
        onTrySimilar={() => undefined}
        hasSimilar={(q) => q.type === 'mcq'}
      />
    </section>
  );
}
