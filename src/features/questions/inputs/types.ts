import type { Question } from '@/content';
import type { GradeResult, Response } from '@/engine/grading';

/** What every per-type input gets from QuestionView. */
export interface InputProps {
  q: Question;
  response: Response | undefined;
  onChange: (r: Response) => void;
  locked: boolean;
  result: GradeResult | undefined;
  /** Show the right answers (after the hint ladder, or in check mode) */
  reveal: boolean;
  /** id of the prompt element, for aria-labelledby */
  promptId: string;
}
