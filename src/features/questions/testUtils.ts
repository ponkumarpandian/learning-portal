import { loadContent, QuestionSchema, type Question } from '@/content';

const bundle = loadContent();
const all: Question[] = [
  ...bundle.chapters.flatMap((c) => [
    ...c.questionBank,
    ...c.lessons.flatMap((l) => [...l.practice, ...l.check]),
  ]),
  ...bundle.explainers.flatMap((e) => e.questions),
];

/** A real question from /content by id (tests use real content wherever it exists). */
export function realQuestion(id: string): Question {
  const q = all.find((x) => x.id === id);
  if (!q) throw new Error(`No question "${id}" in /content`);
  return q;
}

/** There is no numeric question in /content yet, so tests use this validated fixture. */
export const NUMERIC_FIXTURE: Question = QuestionSchema.parse({
  id: 'test-numeric',
  type: 'numeric',
  prompt: 'How long is the pencil?',
  difficulty: 'easy',
  marks: 1,
  answer: 12,
  unit: 'cm',
  explanation: 'Read the ruler from 0 to the tip.',
});
