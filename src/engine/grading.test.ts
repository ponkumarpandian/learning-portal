import type { Question } from '@/content';
import {
  NO_ANSWER,
  SELF_CHECK_SCORE,
  correctAnswerText,
  emptyResponse,
  grade,
  isAnswered,
  marksFor,
  normalizeText,
  parseNumberWithUnit,
  responseTypeFor,
  type Response,
} from './grading';

const base = { prompt: 'Q?', difficulty: 'easy', marks: 1, explanation: 'Because.' } as const;
const q = (over: Partial<Question> & Pick<Question, 'type'>): Question => ({ id: 'q-1', ...base, ...over });

const mcq = q({ type: 'mcq', options: ['Solid', 'Liquid', 'Gas'], answer: 'Gas' });
const tf = q({ type: 'true_false', answer: false });
const fill = q({ type: 'fill_blank', answer: 'Definite Volume', accept: ['volume', 'fixed volume'] });
const fillNum = q({ type: 'fill_blank', answer: 12, tolerance: 0.5, unit: 'cm' });
const fillNumStr = q({ type: 'fill_blank', answer: '100', accept: ['hundred'] });
const numeric = q({ type: 'numeric', answer: 3.5, tolerance: 0.1, unit: 'kg' });
const numericExact = q({ type: 'numeric', answer: 0.3 });
const match = q({
  type: 'match',
  marks: 3,
  pairs: [
    ['Clear glass', 'Transparent'],
    ['Wood', 'Opaque'],
    ['Butter paper', 'Translucent'],
  ],
});
const order = q({ type: 'order', marks: 2, sequence: ['Source', 'Object', 'Screen', 'Shadow'] });
const label = q({
  type: 'label_diagram',
  marks: 3,
  image: 'media/images/x.svg',
  hotspots: [
    { id: 'h1', x: 15, y: 50, label: 'Plunger' },
    { id: 'h2', x: 67, y: 50, label: 'Water' },
    { id: 'h3', x: 94, y: 50, label: 'Sealed nozzle' },
  ],
});
const short = q({
  type: 'short_answer',
  marks: 2,
  modelAnswer: 'Solids keep their shape.',
  keywords: ['shape'],
});
const think = q({ type: 'think_write', marks: 3, modelAnswer: 'Because particles move.' });

describe('responseTypeFor / emptyResponse', () => {
  it.each([
    [mcq, 'mcq'],
    [tf, 'true_false'],
    [fill, 'fill_blank'],
    [numeric, 'numeric'],
    [match, 'match'],
    [order, 'order'],
    [label, 'label_diagram'],
    [short, 'self_check'],
    [think, 'self_check'],
  ] as const)('%#: %s → %s', (question, type) => {
    expect(responseTypeFor(question)).toBe(type);
    const empty = emptyResponse(question);
    expect(empty.type).toBe(type);
    // an empty response is never "answered" and grades as 0 with "(no answer)"
    expect(isAnswered(question, empty)).toBe(false);
    const g = grade(question, empty);
    expect(g.score).toBe(0);
    expect(g.correct).toBe(false);
    expect(g.yourAnswer).toBe(NO_ANSWER);
  });
});

describe('isAnswered', () => {
  it.each<[string, Question, Response | undefined, boolean]>([
    ['undefined', mcq, undefined, false],
    ['wrong shape', mcq, { type: 'true_false', value: true }, false],
    ['mcq chosen', mcq, { type: 'mcq', choice: 'Gas' }, true],
    ['mcq blank', mcq, { type: 'mcq', choice: '  ' }, false],
    ['tf false chosen', tf, { type: 'true_false', value: false }, true],
    ['tf null', tf, { type: 'true_false', value: null }, false],
    ['fill text', fill, { type: 'fill_blank', text: 'x' }, true],
    ['fill spaces', fill, { type: 'fill_blank', text: '   ' }, false],
    ['numeric 0', numeric, { type: 'numeric', value: 0 }, true],
    ['numeric NaN', numeric, { type: 'numeric', value: Number.NaN }, false],
    ['match partial', match, { type: 'match', pairs: { 'Clear glass': 'Opaque' } }, false],
    [
      'match all',
      match,
      { type: 'match', pairs: { 'Clear glass': 'Opaque', Wood: 'Opaque', 'Butter paper': 'Opaque' } },
      true,
    ],
    ['order permutation', order, { type: 'order', sequence: ['Shadow', 'Screen', 'Object', 'Source'] }, true],
    ['order missing item', order, { type: 'order', sequence: ['Shadow', 'Screen', 'Object'] }, false],
    ['order foreign item', order, { type: 'order', sequence: ['Shadow', 'Screen', 'Object', 'Sun'] }, false],
    ['label partial', label, { type: 'label_diagram', placed: { h1: 'Water', h2: 'Plunger' } }, false],
    [
      'label all',
      label,
      { type: 'label_diagram', placed: { h1: 'Water', h2: 'Plunger', h3: 'Sealed nozzle' } },
      true,
    ],
    ['self-check text but no rating', short, { type: 'self_check', text: 'Shape' }, false],
    ['self-check rated', think, { type: 'self_check', text: '', rating: 'missed' }, true],
  ])('%s → %s', (_name, question, r, expected) => {
    expect(isAnswered(question, r)).toBe(expected);
  });
});

describe('grade: mcq / true_false', () => {
  it.each<[Question, Response, boolean, string]>([
    [mcq, { type: 'mcq', choice: 'Gas' }, true, 'Gas'],
    [mcq, { type: 'mcq', choice: 'Solid' }, false, 'Solid'],
    [tf, { type: 'true_false', value: false }, true, 'False'],
    [tf, { type: 'true_false', value: true }, false, 'True'],
  ])('%#', (question, r, correct, yours) => {
    const g = grade(question, r);
    expect(g.correct).toBe(correct);
    expect(g.score).toBe(correct ? 1 : 0);
    expect(g.yourAnswer).toBe(yours);
    expect(g.parts).toBeUndefined();
  });

  it('a response of another shape scores 0', () => {
    expect(grade(mcq, { type: 'fill_blank', text: 'Gas' })).toMatchObject({
      score: 0,
      yourAnswer: NO_ANSWER,
    });
  });
});

describe('grade: fill_blank', () => {
  it.each<[string, Question, string, boolean]>([
    ['exact', fill, 'Definite Volume', true],
    ['case + extra spaces', fill, '  definite    VOLUME ', true],
    ['trailing full stop', fill, 'definite volume.', true],
    ['accept[] item', fill, 'Volume', true],
    ['another accept[] item', fill, 'fixed  volume', true],
    ['not quite', fill, 'shape', false],
    ['blank', fill, '', false],
    ['number exact', fillNum, '12', true],
    ['number in tolerance with unit', fillNum, '12.4 cm', true],
    ['number with unit, no space, caps', fillNum, '11.5CM', true],
    ['number outside tolerance', fillNum, '12.6', false],
    ['number with another unit', fillNum, '12 mm', false],
    ['text for a number answer', fillNum, 'twelve', false],
    ['numeric string answer', fillNumStr, '100', true],
    ['numeric string answer, decimals', fillNumStr, '100.0', true],
    ['accept word for numeric string', fillNumStr, 'Hundred', true],
    ['numeric string, other number', fillNumStr, '101', false],
  ])('%s: "%s"', (_name, question, text, correct) => {
    expect(grade(question, { type: 'fill_blank', text }).correct).toBe(correct);
  });

  it('reports tidy text', () => {
    const g = grade(fill, { type: 'fill_blank', text: '  the   shape ' });
    expect(g.yourAnswer).toBe('the shape');
    expect(g.correctAnswer).toBe('Definite Volume');
    expect(grade(fillNum, { type: 'fill_blank', text: '12' }).correctAnswer).toBe('12 cm');
  });
});

describe('grade: numeric', () => {
  it.each<[string, Question, Response, boolean]>([
    ['exact', numeric, { type: 'numeric', value: 3.5 }, true],
    ['in tolerance', numeric, { type: 'numeric', value: 3.6 }, true],
    ['outside tolerance', numeric, { type: 'numeric', value: 3.61 }, false],
    ['same unit', numeric, { type: 'numeric', value: 3.5, unit: 'KG' }, true],
    ['blank unit', numeric, { type: 'numeric', value: 3.5, unit: ' ' }, true],
    ['other unit', numeric, { type: 'numeric', value: 3.5, unit: 'g' }, false],
    ['null', numeric, { type: 'numeric', value: null }, false],
    ['float slack, tolerance 0', numericExact, { type: 'numeric', value: 0.1 + 0.2 }, true],
    ['unit given, question has none', numericExact, { type: 'numeric', value: 0.3, unit: 'm' }, true],
  ])('%s', (_name, question, r, correct) => {
    expect(grade(question, r).correct).toBe(correct);
  });

  it('reports value and unit', () => {
    const g = grade(numeric, { type: 'numeric', value: 4, unit: 'kg' });
    expect(g.yourAnswer).toBe('4 kg');
    expect(g.correctAnswer).toBe('3.5 kg');
    expect(grade(numericExact, { type: 'numeric', value: 1 }).yourAnswer).toBe('1');
  });

  it('a numeric question without a number answer never matches', () => {
    expect(grade(q({ type: 'numeric', answer: 'abc' }), { type: 'numeric', value: 1 }).correct).toBe(false);
  });
});

describe('grade: match (partial marks per pair)', () => {
  it.each<[string, Record<string, string>, number]>([
    ['all right', { 'Clear glass': 'Transparent', Wood: 'Opaque', 'Butter paper': 'Translucent' }, 1],
    ['two of three', { 'Clear glass': 'transparent ', Wood: 'Opaque', 'Butter paper': 'Opaque' }, 2 / 3],
    ['one of three', { 'Clear glass': 'Opaque', Wood: 'Opaque', 'Butter paper': 'Transparent' }, 1 / 3],
    ['none', {}, 0],
  ])('%s', (_name, pairs, score) => {
    const g = grade(match, { type: 'match', pairs });
    expect(g.score).toBeCloseTo(score);
    expect(g.correct).toBe(score === 1);
    expect(g.parts).toHaveLength(3);
    expect(g.parts?.map((p) => p.key)).toEqual(['Clear glass', 'Wood', 'Butter paper']);
  });

  it('per-part flags and report text', () => {
    const g = grade(match, { type: 'match', pairs: { 'Clear glass': 'Transparent', Wood: 'Translucent' } });
    expect(g.parts).toEqual([
      { key: 'Clear glass', correct: true },
      { key: 'Wood', correct: false },
      { key: 'Butter paper', correct: false },
    ]);
    expect(g.yourAnswer).toBe('Clear glass → Transparent · Wood → Translucent · Butter paper → ?');
    expect(g.correctAnswer).toBe('Clear glass → Transparent · Wood → Opaque · Butter paper → Translucent');
  });
});

describe('grade: order (partial marks per position)', () => {
  it.each<[string, string[], number]>([
    ['right order', ['Source', 'Object', 'Screen', 'Shadow'], 1],
    ['two swapped', ['Object', 'Source', 'Screen', 'Shadow'], 0.5],
    ['reversed', ['Shadow', 'Screen', 'Object', 'Source'], 0],
    ['three of four', ['Source', 'Object', 'Shadow', 'Screen'], 0.5],
    ['empty', [], 0],
  ])('%s', (_name, sequence, score) => {
    const g = grade(order, { type: 'order', sequence });
    expect(g.score).toBe(score);
    expect(g.parts).toHaveLength(4);
  });

  it('report text', () => {
    const g = grade(order, { type: 'order', sequence: ['Object', 'Source', 'Screen', 'Shadow'] });
    expect(g.yourAnswer).toBe('Object → Source → Screen → Shadow');
    expect(g.correctAnswer).toBe('Source → Object → Screen → Shadow');
    expect(g.parts?.[2]).toEqual({ key: 'Screen', correct: true });
  });
});

describe('grade: label_diagram (partial marks per label)', () => {
  it.each<[string, Record<string, string>, number]>([
    ['all right', { h1: 'Plunger', h2: 'Water', h3: 'Sealed nozzle' }, 1],
    ['one swap', { h1: 'Water', h2: 'Plunger', h3: 'sealed  nozzle' }, 1 / 3],
    ['two right, one blank', { h1: 'Plunger', h2: 'Water' }, 2 / 3],
    ['none placed', {}, 0],
  ])('%s', (_name, placed, score) => {
    const g = grade(label, { type: 'label_diagram', placed });
    expect(g.score).toBeCloseTo(score);
    expect(g.parts?.map((p) => p.key)).toEqual(['h1', 'h2', 'h3']);
  });

  it('report text', () => {
    const g = grade(label, { type: 'label_diagram', placed: { h1: 'Water', h3: 'Sealed nozzle' } });
    expect(g.yourAnswer).toBe('Water, ?, Sealed nozzle');
    expect(g.correctAnswer).toBe('Plunger, Water, Sealed nozzle');
  });
});

describe('grade: self-check (short_answer, think_write)', () => {
  it.each<[Question, 'got' | 'partly' | 'missed' | undefined, number]>([
    [short, 'got', 1],
    [short, 'partly', 0.5],
    [short, 'missed', 0],
    [think, 'got', 1],
    [think, undefined, 0],
  ])('%#: %s → %s', (question, rating, score) => {
    const r: Response = rating
      ? { type: 'self_check', text: 'My words', rating }
      : { type: 'self_check', text: '' };
    const g = grade(question, r);
    expect(g.score).toBe(score);
    expect(g.correct).toBe(score === 1);
    expect(g.correctAnswer).toBe(question.modelAnswer);
    expect(g.yourAnswer).toBe(rating ? 'My words' : NO_ANSWER);
  });

  it('SELF_CHECK_SCORE is 1 / 0.5 / 0', () => {
    expect(SELF_CHECK_SCORE).toEqual({ got: 1, partly: 0.5, missed: 0 });
  });
});

describe('correctAnswerText', () => {
  it.each<[Question, string]>([
    [mcq, 'Gas'],
    [tf, 'False'],
    [q({ type: 'true_false', answer: true }), 'True'],
    [fill, 'Definite Volume'],
    [fillNum, '12 cm'],
    [numeric, '3.5 kg'],
    [order, 'Source → Object → Screen → Shadow'],
    [label, 'Plunger, Water, Sealed nozzle'],
    [short, 'Solids keep their shape.'],
    [think, 'Because particles move.'],
    [q({ type: 'mcq', answer: ['a', 'b'] }), 'a, b'],
    [q({ type: 'mcq' }), ''],
    [q({ type: 'short_answer' }), ''],
    [q({ type: 'match' }), ''],
    [q({ type: 'order' }), ''],
    [q({ type: 'label_diagram' }), ''],
  ])('%#', (question, text) => {
    expect(correctAnswerText(question)).toBe(text);
  });
});

describe('marksFor (q.marks × score, rounded to 0.5)', () => {
  it.each<[number, number, number]>([
    [1, 1, 1],
    [1, 0, 0],
    [3, 2 / 3, 2],
    [3, 1 / 3, 1],
    [1, 1 / 3, 0.5], // 0.33 → 0.5
    [1, 2 / 3, 0.5], // 0.67 → 0.5
    [2, 0.5, 1],
    [3, 0.5, 1.5],
    [1, 0.25, 0.5], // 0.25 rounds up to 0.5
    [2, 3 / 4, 1.5],
    [3, 0.1, 0.5], // 0.3 → 0.5
    [3, 0.05, 0], // 0.15 → 0
  ])('%s marks × %s → %s', (marks, score, expected) => {
    expect(
      marksFor(q({ type: 'match', marks }), {
        score,
        correct: score === 1,
        yourAnswer: '',
        correctAnswer: '',
      }),
    ).toBe(expected);
  });

  it('works on a real grade', () => {
    const g = grade(label, { type: 'label_diagram', placed: { h1: 'Plunger', h2: 'Water' } });
    expect(marksFor(label, g)).toBe(2);
  });
});

describe('helpers', () => {
  it.each([
    ['  Hello   World. ', 'hello world'],
    ['ABC', 'abc'],
    ['', ''],
  ])('normalizeText(%j) → %j', (input, out) => {
    expect(normalizeText(input)).toBe(out);
  });

  it.each([
    ['12.5 cm', { value: 12.5, unit: 'cm' }],
    ['1,000', { value: 1000, unit: '' }],
    ['-3', { value: -3, unit: '' }],
    ['.5kg', { value: 0.5, unit: 'kg' }],
    ['abc', undefined],
    ['', undefined],
  ])('parseNumberWithUnit(%j)', (input, out) => {
    expect(parseNumberWithUnit(input)).toEqual(out);
  });
});
