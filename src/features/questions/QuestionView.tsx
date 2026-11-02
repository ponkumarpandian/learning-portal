import { useId, type ComponentType } from 'react';
import { subjectVars } from '@/components/colours';
import { getSubject, type Question, type QuestionType } from '@/content';
import type { GradeResult, Response } from '@/engine/grading';
import { useBundle } from '@/state/content';
import { LabelDiagramInput, MatchInput } from './inputs/BoardInputs';
import { McqInput, TrueFalseInput } from './inputs/ChoiceInputs';
import { OrderInput } from './inputs/OrderInput';
import { FillBlankInput, NumericInput, SelfCheckInput } from './inputs/TextInputs';
import type { InputProps } from './inputs/types';
import './questions.css';

export interface QuestionViewProps {
  question: Question;
  response: Response | undefined;
  onChange: (r: Response) => void;
  /** after the answer is checked: read-only */
  locked?: boolean;
  /** shows per-part right / not-quite marks when locked */
  result?: GradeResult;
  /** colours via subjectVars */
  subjectId?: string;
  /** also show the right answers (after the hint ladder, or in check mode) */
  reveal?: boolean;
}

const INPUTS: Record<QuestionType, ComponentType<InputProps>> = {
  mcq: McqInput,
  true_false: TrueFalseInput,
  fill_blank: FillBlankInput,
  numeric: NumericInput,
  match: MatchInput,
  order: OrderInput,
  label_diagram: LabelDiagramInput,
  short_answer: SelfCheckInput,
  think_write: SelfCheckInput,
};

/** The question's prompt plus the right input for its type (§8.2). */
export function QuestionView({
  question,
  response,
  onChange,
  locked = false,
  result,
  subjectId,
  reveal = false,
}: QuestionViewProps) {
  const bundle = useBundle();
  const promptId = useId();
  const Input = INPUTS[question.type];
  const style = subjectId ? subjectVars(getSubject(bundle, subjectId)) : undefined;
  return (
    <div className="qv" style={style} data-type={question.type}>
      {question.type !== 'fill_blank' && (
        <h2 className="question" id={promptId}>
          {question.prompt}
        </h2>
      )}
      <Input
        q={question}
        response={response}
        onChange={onChange}
        locked={locked}
        result={result}
        reveal={reveal}
        promptId={promptId}
      />
    </div>
  );
}
