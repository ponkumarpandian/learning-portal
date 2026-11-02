import { useId } from 'react';
import type { Question, VideoRef } from '@/content';
import type { GradeResult } from '@/engine/grading';
import './questions.css';

export interface CorrectionItem {
  question: Question;
  result: GradeResult;
}

export interface CorrectionReportProps {
  /** every answered question; the report shows the ones that were not fully right */
  items: CorrectionItem[];
  /** "Watch this bit again ▶️" (shown when the question has a videoRef) */
  onWatch?: (videoRef: VideoRef) => void;
  /** "Try a similar one 🔁" (shown only when a variant exists, see hasSimilar) */
  onTrySimilar?: (question: Question) => void;
  /** does a variant of this question exist? Defaults to "yes" whenever onTrySimilar is given */
  hasSimilar?: (question: Question) => boolean;
  /** heading level for the report title (default 2) */
  headingLevel?: 2 | 3;
}

/** Match answers read "A → x · B → y": one pair per line is easier to compare. */
function Lines({ text }: { text: string }) {
  const parts = text.split(' · ');
  if (parts.length < 2) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className="fixr-line">
          {p}
        </span>
      ))}
    </>
  );
}

/**
 * The correction report (§8.4): for every not-quite or partly-right answer, "Your answer | Correct
 * answer | Why — and how to get it next time", with "Watch this bit again" and "Try a similar one".
 * Three columns on a tablet, stacked cards on a phone (no sideways scrolling).
 */
export function CorrectionReport({
  items,
  onWatch,
  onTrySimilar,
  hasSimilar,
  headingLevel = 2,
}: CorrectionReportProps) {
  const titleId = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const fix = items.filter((i) => !i.result.correct);

  if (!fix.length) {
    return (
      <section className="fixr is-clear" aria-labelledby={titleId}>
        <H id={titleId} className="fixr-title">
          Nothing to fix — every answer was spot on! ⭐
        </H>
      </section>
    );
  }

  return (
    <section className="fixr" aria-labelledby={titleId}>
      <H id={titleId} className="fixr-title">
        Let’s fix these together 🛠️ — each one makes you stronger.
      </H>
      <ol className="fixr-list">
        {fix.map(({ question: q, result: r }) => {
          const partly = r.score > 0;
          const similar = onTrySimilar && (hasSimilar ? hasSimilar(q) : true);
          const watch = onWatch && q.videoRef;
          return (
            <li key={q.id} className="fixr-row">
              <p className="fixr-q">
                <span className={`fixr-badge${partly ? ' is-partly' : ''}`}>
                  {partly ? 'Partly there 🤏' : 'Let’s fix this one'}
                </span>
                <span className="fixr-prompt">{q.prompt}</span>
              </p>
              <dl className="fixr-cols">
                <div className="fixr-cell is-yours">
                  <dt>Your answer</dt>
                  <dd>
                    <Lines text={r.yourAnswer} />
                  </dd>
                </div>
                <div className="fixr-cell is-right">
                  <dt>Correct answer</dt>
                  <dd>
                    <Lines text={r.correctAnswer} />
                  </dd>
                </div>
                <div className="fixr-cell is-why">
                  <dt>Why — and how to get it next time</dt>
                  <dd>{q.explanation}</dd>
                </div>
              </dl>
              {(watch || similar) && (
                <div className="fixr-actions">
                  {watch && q.videoRef && (
                    <button
                      type="button"
                      className="chunky soft fixr-btn"
                      onClick={() => onWatch(q.videoRef!)}
                    >
                      Watch this bit again ▶️
                    </button>
                  )}
                  {similar && (
                    <button type="button" className="chunky soft fixr-btn" onClick={() => onTrySimilar(q)}>
                      Try a similar one 🔁
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
