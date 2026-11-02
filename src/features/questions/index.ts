/** Question UI (§8.2, §6 step 4, §7.3, §8.4): one input per type, the feedback flow, the correction report. */
export { QuestionView, type QuestionViewProps } from './QuestionView';
export { AskQuestion, type AskMode, type AskOutcome, type AskQuestionProps } from './AskQuestion';
export { CorrectionReport, type CorrectionItem, type CorrectionReportProps } from './CorrectionReport';
export { mediaUrl } from './media';
export { startResponse } from './responses';
export type { GradeResult, Response } from '@/engine/grading';
