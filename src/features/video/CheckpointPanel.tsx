import { AskQuestion, type AskOutcome } from '@/features/questions';
import type { Question } from '@/content';

export interface CheckpointPanelProps {
  question: Question;
  subjectId?: string;
  onDone: (o: AskOutcome) => void;
  onWatchAgain: () => void;
}

/** A ⭐ checkpoint question in the video frame (§7.3): it pauses the video and never traps her. */
export function CheckpointPanel({ question, subjectId, onDone, onWatchAgain }: CheckpointPanelProps) {
  return (
    <div className="vcheck" role="group" aria-label="Star question">
      <p className="vcheck-head">
        <span className="vstar" aria-hidden="true">
          ⭐
        </span>
        Quick question!
      </p>
      <AskQuestion
        key={question.id}
        question={question}
        mode="checkpoint"
        subjectId={subjectId}
        compact
        onDone={onDone}
        onWatchAgain={onWatchAgain}
      />
    </div>
  );
}
